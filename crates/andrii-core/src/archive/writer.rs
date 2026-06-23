use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use zeroize::Zeroizing;

use andrii_compress::{compress, decide_level, CompressionLevel};
use andrii_crypto::{
    cipher::{encrypt, generate_nonce},
    hash::hash_to_hex,
    kdf::{derive_key, generate_salt, KdfParams},
};

use crate::error::ArchiveError;
use crate::format::{
    entry::FileEntry,
    header::{Argon2ParamsJson, EncryptedHeader, FixedHeader, Footer, CHUNK_SIZE, FORMAT_VERSION},
};

/// Stage of archive creation, reported through the progress callback.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    /// Walking input paths and tallying totals.
    Scanning,
    /// Reading, compressing and encrypting file content (the dominant stage).
    Compressing,
    /// Streaming sealed blocks into the final archive while hashing.
    Writing,
    /// Writing the footer and atomically committing the archive.
    Finalizing,
}

impl Phase {
    pub fn as_str(self) -> &'static str {
        match self {
            Phase::Scanning => "scanning",
            Phase::Compressing => "compressing",
            Phase::Writing => "writing",
            Phase::Finalizing => "finalizing",
        }
    }
}

/// A snapshot of creation progress passed to the progress callback.
#[derive(Debug, Clone)]
pub struct Progress<'a> {
    pub phase: Phase,
    pub files_done: u64,
    pub files_total: u64,
    pub bytes_done: u64,
    pub bytes_total: u64,
    /// Archive-relative path of the file currently being processed (may be empty).
    pub current_file: &'a str,
}

/// Options for creating a new archive.
pub struct CreateArchiveOptions {
    /// Archive name (no extension).
    pub archive_name: String,
    /// Password to encrypt the archive with.
    pub password: String,
    /// Compression level (user-selected mode). Per-file the effective level may be
    /// downgraded to `None` for already-compressed data — see [`decide_level`].
    pub compression: CompressionLevel,
    /// Output file path (should end in .andrii).
    pub output_path: PathBuf,
    /// Optional progress callback. Called frequently (per chunk); the caller is
    /// responsible for throttling UI updates.
    pub progress_callback: Option<Box<dyn Fn(&Progress) + Send>>,
}

/// Result of archive creation.
#[derive(Debug)]
pub struct CreateArchiveResult {
    pub output_path: PathBuf,
    pub file_count: usize,
    pub total_original_size: u64,
    pub total_compressed_size: u64,
    pub compression_ratio: f64,
}

/// Builds a `.andrii` archive from a list of input paths.
pub struct ArchiveWriter {
    options: CreateArchiveOptions,
}

/// Whether `ANDRII_PROFILE` is set — gates stderr timing output. Read once.
fn profiling_enabled() -> bool {
    std::env::var_os("ANDRII_PROFILE").is_some()
}

impl ArchiveWriter {
    pub fn new(options: CreateArchiveOptions) -> Self {
        Self { options }
    }

    fn emit(&self, p: &Progress) {
        if let Some(cb) = &self.options.progress_callback {
            cb(p);
        }
    }

    /// Create the archive (format v2: per-file chunked streaming).
    ///
    /// Directories are recursively walked. Symlinks are skipped. Peak memory stays
    /// at roughly one [`CHUNK_SIZE`] chunk regardless of individual file size.
    pub fn create(&self, input_paths: &[PathBuf]) -> Result<CreateArchiveResult, ArchiveError> {
        let profile = profiling_enabled();
        let t_total = Instant::now();

        // ── Scan ────────────────────────────────────────────────────────────
        let t_scan = Instant::now();
        let files = collect_files(input_paths)?;
        if files.is_empty() {
            return Err(ArchiveError::Format("No files to add to the vault".to_string()));
        }
        let total_original_size: u64 = files.iter().map(|(_, meta)| meta.0).sum();
        let files_total = files.len() as u64;
        let dt_scan = t_scan.elapsed();
        self.emit(&Progress {
            phase: Phase::Scanning,
            files_done: 0,
            files_total,
            bytes_done: 0,
            bytes_total: total_original_size,
            current_file: "",
        });

        // ── Derive master key ───────────────────────────────────────────────
        let t_kdf = Instant::now();
        let kdf_params = KdfParams::default();
        let salt = generate_salt()?;
        let master_key: Zeroizing<[u8; 32]> =
            derive_key(&self.options.password, &salt, &kdf_params)?;
        let dt_kdf = t_kdf.elapsed();

        // Temp files kept on the same volume as the output for an atomic rename.
        let output_path = self.options.output_path.clone();
        let dir = output_path
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        let stamp = format!(
            "{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0)
        );
        let spool_path = dir.join(format!(".andrii-spool-{stamp}.tmp"));
        let tmp_path = dir.join(format!(".andrii-build-{stamp}.tmp"));

        let mut spool = BufWriter::new(
            OpenOptions::new()
                .read(true)
                .write(true)
                .create_new(true)
                .open(&spool_path)?,
        );
        let mut entries: Vec<FileEntry> = Vec::with_capacity(files.len());
        let mut current_data_offset: u64 = 0;
        let mut bytes_done: u64 = 0;

        // ── Per-file chunked seal ───────────────────────────────────────────
        let t_seal = Instant::now();
        let seal_result = (|| -> Result<(), ArchiveError> {
            for (idx, (archive_path, (original_size, fs_path, modified_at, unix_mode))) in
                files.iter().enumerate()
            {
                self.emit(&Progress {
                    phase: Phase::Compressing,
                    files_done: idx as u64,
                    files_total,
                    bytes_done,
                    bytes_total: total_original_size,
                    current_file: archive_path,
                });

                let mut reader = BufReader::new(File::open(fs_path)?);

                // Read the first chunk to decide the effective compression level.
                let mut current = read_chunk(&mut reader)?;
                let level = decide_level(archive_path, &current, self.options.compression);
                let stored_raw = level == CompressionLevel::None;

                // Per-file 16-byte base nonce; per-chunk nonce = base ‖ counter.
                let nonce24 = generate_nonce()?;
                let mut base16 = [0u8; 16];
                base16.copy_from_slice(&nonce24[..16]);
                let nonce_b64 = URL_SAFE_NO_PAD.encode(base16);

                let mut hasher = blake3::Hasher::new();
                let mut chunk_index: u64 = 0;
                let mut region_size: u64 = 0;
                let mut compressed_payload: u64 = 0;

                // Empty file → zero chunks; its BLAKE3 is the hash of no bytes.
                while !current.is_empty() {
                    let next = read_chunk(&mut reader)?;
                    let is_last = next.is_empty();

                    hasher.update(&current);

                    // nonce = base16 ‖ chunk_index(BE u64); AAD binds order + truncation.
                    let mut nonce = [0u8; 24];
                    nonce[..16].copy_from_slice(&base16);
                    nonce[16..24].copy_from_slice(&chunk_index.to_be_bytes());
                    let mut aad = [0u8; 9];
                    aad[..8].copy_from_slice(&chunk_index.to_be_bytes());
                    aad[8] = is_last as u8;

                    let (sealed, payload_len) = if stored_raw {
                        (encrypt(&master_key, &nonce, &current, &aad)?, current.len())
                    } else {
                        let comp = Zeroizing::new(compress(&current, level)?);
                        let len = comp.len();
                        (encrypt(&master_key, &nonce, &comp, &aad)?, len)
                    };
                    compressed_payload += payload_len as u64;

                    spool.write_all(&(sealed.len() as u32).to_le_bytes())?;
                    spool.write_all(&sealed)?;
                    region_size += 4 + sealed.len() as u64;

                    bytes_done += current.len() as u64;
                    chunk_index += 1;
                    self.emit(&Progress {
                        phase: Phase::Compressing,
                        files_done: idx as u64,
                        files_total,
                        bytes_done,
                        bytes_total: total_original_size,
                        current_file: archive_path,
                    });

                    if is_last {
                        break;
                    }
                    current = next;
                }

                let blake3_hex = hash_to_hex(hasher.finalize().as_bytes());

                entries.push(FileEntry {
                    path: archive_path.clone(),
                    original_size: *original_size,
                    compressed_encrypted_size: region_size,
                    content_nonce: nonce_b64,
                    data_offset: current_data_offset,
                    blake3_hash: blake3_hex,
                    modified_at: *modified_at,
                    unix_mode: *unix_mode,
                    chunk_count: chunk_index,
                    stored_raw,
                    compressed_size: compressed_payload,
                });
                current_data_offset += region_size;
            }
            Ok(())
        })();

        if let Err(e) = seal_result {
            drop(spool);
            let _ = fs::remove_file(&spool_path);
            return Err(e);
        }
        spool.flush()?;
        let mut spool = spool.into_inner().map_err(|e| ArchiveError::Io(e.into_error()))?;
        let dt_seal = t_seal.elapsed();

        let total_compressed_size: u64 = entries.iter().map(|e| e.compressed_size).sum();
        let file_count = entries.len();
        let compression_ratio = if total_original_size > 0 {
            1.0 - (total_compressed_size as f64 / total_original_size as f64)
        } else {
            0.0
        };

        // ── Build encrypted header ──────────────────────────────────────────
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let enc_header = EncryptedHeader {
            archive_name: self.options.archive_name.clone(),
            created_at: now,
            creator_version: format!("andrii/{}", env!("CARGO_PKG_VERSION")),
            compression: format!("{:?}", self.options.compression),
            argon2_params: Argon2ParamsJson {
                m_cost: kdf_params.m_cost,
                t_cost: kdf_params.t_cost,
                p_cost: kdf_params.p_cost,
            },
            extra: serde_json::Value::Object(serde_json::Map::new()),
            entries,
        };

        let header_json = enc_header.to_json()?;
        let header_nonce = generate_nonce()?;
        let enc_header_len = (header_json.len() + 16) as u64;

        let fixed_header = FixedHeader {
            version: FORMAT_VERSION,
            flags: 0,
            kdf_salt: salt,
            header_nonce,
            enc_header_len,
        };
        let fixed_header_bytes = fixed_header.to_bytes();
        let encrypted_header =
            encrypt(&master_key, &header_nonce, &header_json, &fixed_header_bytes)?;

        // ── Assemble + hash ─────────────────────────────────────────────────
        self.emit(&Progress {
            phase: Phase::Writing,
            files_done: files_total,
            files_total,
            bytes_done: total_original_size,
            bytes_total: total_original_size,
            current_file: "",
        });
        let t_asm = Instant::now();
        let build = (|| -> Result<(), ArchiveError> {
            let final_file = File::create(&tmp_path)?;
            let mut writer = BufWriter::new(final_file);
            let mut hasher = blake3::Hasher::new();

            writer.write_all(&fixed_header_bytes)?;
            hasher.update(&fixed_header_bytes);
            writer.write_all(&encrypted_header)?;
            hasher.update(&encrypted_header);

            spool.seek(SeekFrom::Start(0))?;
            let mut buf = vec![0u8; CHUNK_SIZE];
            loop {
                let n = spool.read(&mut buf)?;
                if n == 0 {
                    break;
                }
                writer.write_all(&buf[..n])?;
                hasher.update(&buf[..n]);
            }

            self.emit(&Progress {
                phase: Phase::Finalizing,
                files_done: files_total,
                files_total,
                bytes_done: total_original_size,
                bytes_total: total_original_size,
                current_file: "",
            });
            let archive_hash = *hasher.finalize().as_bytes();
            let footer = Footer::new(archive_hash);
            writer.write_all(&footer.to_bytes())?;
            writer.flush()?;
            Ok(())
        })();

        drop(spool);
        let _ = fs::remove_file(&spool_path);

        if let Err(e) = build {
            let _ = fs::remove_file(&tmp_path);
            return Err(e);
        }
        let dt_asm = t_asm.elapsed();

        // ── Atomic commit ───────────────────────────────────────────────────
        let t_rename = Instant::now();
        if let Err(e) = fs::rename(&tmp_path, &output_path) {
            let _ = fs::remove_file(&tmp_path);
            return Err(ArchiveError::Io(e));
        }
        let dt_rename = t_rename.elapsed();

        if profile {
            eprintln!(
                "[andrii-profile] create: total={:?} scan={:?} kdf={:?} seal={:?} assemble={:?} rename={:?} | files={} orig={}B stored={}B ratio={:.1}%",
                t_total.elapsed(), dt_scan, dt_kdf, dt_seal, dt_asm, dt_rename,
                file_count, total_original_size, total_compressed_size, compression_ratio * 100.0,
            );
        }

        Ok(CreateArchiveResult {
            output_path,
            file_count,
            total_original_size,
            total_compressed_size,
            compression_ratio,
        })
    }
}

/// Read up to `CHUNK_SIZE` bytes, returning fewer only at EOF. Plaintext is
/// zeroized on drop.
fn read_chunk<R: Read>(reader: &mut R) -> Result<Zeroizing<Vec<u8>>, ArchiveError> {
    let mut buf = vec![0u8; CHUNK_SIZE];
    let mut filled = 0;
    while filled < CHUNK_SIZE {
        let n = reader.read(&mut buf[filled..])?;
        if n == 0 {
            break;
        }
        filled += n;
    }
    buf.truncate(filled);
    Ok(Zeroizing::new(buf))
}

/// (archive_relative_path, (original_size, fs_path, modified_at, unix_mode))
type FileRecord = (String, (u64, PathBuf, u64, u32));

/// Walk input paths and collect all files with their metadata.
fn collect_files(input_paths: &[PathBuf]) -> Result<Vec<FileRecord>, ArchiveError> {
    let mut files: Vec<FileRecord> = Vec::new();

    for input in input_paths {
        let input = fs::canonicalize(input).unwrap_or_else(|_| input.clone());
        if input.is_file() {
            let name = input
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("file")
                .to_string();
            let meta = fs::metadata(&input)?;
            let original_size = meta.len();
            let modified_at = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            #[cfg(unix)]
            let unix_mode = {
                use std::os::unix::fs::MetadataExt;
                meta.mode()
            };
            #[cfg(not(unix))]
            let unix_mode = 0u32;

            files.push((name, (original_size, input.clone(), modified_at, unix_mode)));
        } else if input.is_dir() {
            collect_dir_recursive(&input, &input, &mut files)?;
        }
    }

    Ok(files)
}

fn collect_dir_recursive(
    root: &Path,
    dir: &Path,
    files: &mut Vec<FileRecord>,
) -> Result<(), ArchiveError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_symlink() {
            continue; // skip symlinks
        }
        if path.is_dir() {
            collect_dir_recursive(root, &path, files)?;
        } else if path.is_file() {
            let rel = path
                .strip_prefix(root)
                .map_err(|_| ArchiveError::Format("Path strip error".to_string()))?;
            let archive_path = rel.to_string_lossy().replace('\\', "/");

            let meta = fs::metadata(&path)?;
            let original_size = meta.len();
            let modified_at = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            #[cfg(unix)]
            let unix_mode = {
                use std::os::unix::fs::MetadataExt;
                meta.mode()
            };
            #[cfg(not(unix))]
            let unix_mode = 0u32;

            files.push((
                archive_path,
                (original_size, path, modified_at, unix_mode),
            ));
        }
    }
    Ok(())
}
