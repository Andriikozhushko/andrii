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
    entry::{FileEntry, GroupEntry},
    header::{
        Argon2ParamsJson, EncryptedHeader, FixedHeader, Footer, CHUNK_SIZE, GROUP_TARGET,
    },
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
    /// Force the legacy v2 (per-file) layout even when `Maximum` is selected.
    /// Production callers leave this `false`; it exists so the benchmark/tests can
    /// produce a Maximum-mode v2 baseline to compare against v3 solid groups. It
    /// never weakens security — v2 is the same authenticated-encryption format.
    pub force_legacy_v2: bool,
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
        // ── Plan the layout ─────────────────────────────────────────────────
        // Fast/Balanced (and any `force_legacy_v2`) write the v2 per-file layout.
        // Maximum attempts v3 solid groups: bundle the compressible, small-enough
        // files into ≤16 MiB groups, leaving incompressible/large files as v2
        // per-file regions in the same archive. If grouping wouldn't actually
        // bundle anything (no group with ≥2 files), fall back to v2 so v3 is
        // never worse than v2.
        let attempt_v3 = !self.options.force_legacy_v2
            && self.options.compression == CompressionLevel::Maximum;
        let eligible_mask = if attempt_v3 {
            classify_eligibility(&files)?
        } else {
            vec![false; files.len()]
        };
        let eligible: Vec<usize> = (0..files.len()).filter(|&i| eligible_mask[i]).collect();
        let buckets = if eligible.len() >= 2 {
            bucket_groups(&files, &eligible)
        } else {
            Vec::new()
        };
        let use_v3 = buckets.iter().any(|b| b.len() >= 2);
        let format_version: u16 = if use_v3 { 3 } else { 2 };
        let (buckets, raw_indices): (Vec<Vec<usize>>, Vec<usize>) = if use_v3 {
            let raw = (0..files.len()).filter(|&i| !eligible_mask[i]).collect();
            (buckets, raw)
        } else {
            (Vec::new(), (0..files.len()).collect())
        };

        // ── Seal: groups (v3) then per-file regions (v2-style) ──────────────
        let t_seal = Instant::now();
        let mut entry_slots: Vec<Option<FileEntry>> = (0..files.len()).map(|_| None).collect();
        let mut groups: Vec<GroupEntry> = Vec::with_capacity(buckets.len());
        let mut current_data_offset: u64 = 0;
        let mut bytes_done: u64 = 0;
        let mut files_done: u64 = 0;

        let seal_result = (|| -> Result<(), ArchiveError> {
            for (gid, bucket) in buckets.iter().enumerate() {
                let (group, member_entries, region) = self.seal_group(
                    &mut spool,
                    &master_key,
                    gid as u32,
                    bucket,
                    &files,
                    current_data_offset,
                    &mut bytes_done,
                    &mut files_done,
                    files_total,
                    total_original_size,
                )?;
                current_data_offset += region;
                groups.push(group);
                for (&idx, entry) in bucket.iter().zip(member_entries) {
                    entry_slots[idx] = Some(entry);
                }
            }

            for &idx in &raw_indices {
                let rec = &files[idx];
                self.emit(&Progress {
                    phase: Phase::Compressing,
                    files_done,
                    files_total,
                    bytes_done,
                    bytes_total: total_original_size,
                    current_file: &rec.0,
                });
                let (entry, region) = self.seal_file_region(
                    &mut spool,
                    rec,
                    &master_key,
                    current_data_offset,
                    files_done,
                    files_total,
                    &mut bytes_done,
                    total_original_size,
                )?;
                current_data_offset += region;
                entry_slots[idx] = Some(entry);
                files_done += 1;
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

        // Every slot was filled (groups cover eligible indices, raw covers the rest).
        let entries: Vec<FileEntry> = entry_slots
            .into_iter()
            .map(|e| e.expect("every file slot must be sealed"))
            .collect();

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
            groups,
        };

        let header_json = enc_header.to_json()?;
        let header_nonce = generate_nonce()?;
        let enc_header_len = (header_json.len() + 16) as u64;

        let fixed_header = FixedHeader {
            version: format_version,
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

    /// Seal one file as a v2-style per-file region (a sequence of independently
    /// sealed chunks). Returns its `FileEntry` and the on-disk region size.
    /// Used for Fast/Balanced, for v3 incompressible/large files, and for any
    /// archive that falls back to v2. Peak memory stays at ~one chunk.
    #[allow(clippy::too_many_arguments)]
    fn seal_file_region<W: Write>(
        &self,
        spool: &mut W,
        rec: &FileRecord,
        master_key: &Zeroizing<[u8; 32]>,
        data_offset: u64,
        files_done: u64,
        files_total: u64,
        bytes_done: &mut u64,
        total_original_size: u64,
    ) -> Result<(FileEntry, u64), ArchiveError> {
        let (archive_path, (original_size, fs_path, modified_at, unix_mode)) = rec;
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
                (encrypt(master_key, &nonce, &current, &aad)?, current.len())
            } else {
                let comp = Zeroizing::new(compress(&current, level)?);
                let len = comp.len();
                (encrypt(master_key, &nonce, &comp, &aad)?, len)
            };
            compressed_payload += payload_len as u64;

            spool.write_all(&(sealed.len() as u32).to_le_bytes())?;
            spool.write_all(&sealed)?;
            region_size += 4 + sealed.len() as u64;

            *bytes_done += current.len() as u64;
            chunk_index += 1;
            self.emit(&Progress {
                phase: Phase::Compressing,
                files_done,
                files_total,
                bytes_done: *bytes_done,
                bytes_total: total_original_size,
                current_file: archive_path,
            });

            if is_last {
                break;
            }
            current = next;
        }

        let blake3_hex = hash_to_hex(hasher.finalize().as_bytes());

        let entry = FileEntry {
            path: archive_path.clone(),
            original_size: *original_size,
            compressed_encrypted_size: region_size,
            content_nonce: nonce_b64,
            data_offset,
            blake3_hash: blake3_hex,
            modified_at: *modified_at,
            unix_mode: *unix_mode,
            chunk_count: chunk_index,
            stored_raw,
            compressed_size: compressed_payload,
            group_id: None,
            group_offset: 0,
        };
        Ok((entry, region_size))
    }

    /// Seal one v3 solid group: concatenate the bucket's files into a single
    /// plaintext buffer (bounded by [`GROUP_TARGET`] + one file), record each
    /// file's BLAKE3 and offset, compress the whole buffer as one zstd stream,
    /// then split into 1 MiB chunks sealed exactly like a v2 region. Returns the
    /// `GroupEntry`, the member `FileEntry`s (in bucket order), and the on-disk
    /// region size.
    #[allow(clippy::too_many_arguments)]
    fn seal_group<W: Write>(
        &self,
        spool: &mut W,
        master_key: &Zeroizing<[u8; 32]>,
        group_id: u32,
        bucket: &[usize],
        files: &[FileRecord],
        data_offset: u64,
        bytes_done: &mut u64,
        files_done: &mut u64,
        files_total: u64,
        total_original_size: u64,
    ) -> Result<(GroupEntry, Vec<FileEntry>, u64), ArchiveError> {
        // Concatenate plaintext and build per-file entries (hash + offset).
        let mut plain: Zeroizing<Vec<u8>> = Zeroizing::new(Vec::new());
        let mut member_entries: Vec<FileEntry> = Vec::with_capacity(bucket.len());
        for &idx in bucket {
            let (archive_path, (original_size, fs_path, modified_at, unix_mode)) = &files[idx];
            let group_offset = plain.len() as u64;
            let data = Zeroizing::new(fs::read(fs_path)?);
            // Guard: the file may have changed since scan; trust the bytes read.
            let blake3_hex = hash_to_hex(blake3::hash(&data).as_bytes());
            plain.extend_from_slice(&data);

            member_entries.push(FileEntry {
                path: archive_path.clone(),
                original_size: *original_size,
                compressed_encrypted_size: 0,
                content_nonce: String::new(),
                data_offset: 0,
                blake3_hash: blake3_hex,
                modified_at: *modified_at,
                unix_mode: *unix_mode,
                chunk_count: 0,
                stored_raw: false,
                compressed_size: 0,
                group_id: Some(group_id),
                group_offset,
            });

            *bytes_done += data.len() as u64;
            *files_done += 1;
            self.emit(&Progress {
                phase: Phase::Compressing,
                files_done: *files_done,
                files_total,
                bytes_done: *bytes_done,
                bytes_total: total_original_size,
                current_file: archive_path,
            });
        }
        let uncompressed_size = plain.len() as u64;

        // Compress the whole group as one zstd stream. If that doesn't shrink the
        // data (rare for an all-compressible bucket, but possible), store raw so a
        // group is never larger than its concatenation.
        let compressed = Zeroizing::new(compress(&plain, CompressionLevel::Maximum)?);
        let (stream, stored_raw): (&[u8], bool) = if compressed.len() < plain.len() {
            (&compressed, false)
        } else {
            (&plain, true)
        };
        let compressed_size = stream.len() as u64;

        // Per-group 16-byte base nonce; per-chunk nonce = base ‖ counter — same
        // sealing as a v2 file region (AAD = chunk_index ‖ last_flag).
        let nonce24 = generate_nonce()?;
        let mut base16 = [0u8; 16];
        base16.copy_from_slice(&nonce24[..16]);
        let nonce_b64 = URL_SAFE_NO_PAD.encode(base16);

        let mut region_size: u64 = 0;
        let mut chunk_index: u64 = 0;
        let total_chunks = if stream.is_empty() {
            0
        } else {
            (stream.len() as u64).div_ceil(CHUNK_SIZE as u64)
        };
        for chunk in stream.chunks(CHUNK_SIZE) {
            let is_last = chunk_index + 1 == total_chunks;
            let mut nonce = [0u8; 24];
            nonce[..16].copy_from_slice(&base16);
            nonce[16..24].copy_from_slice(&chunk_index.to_be_bytes());
            let mut aad = [0u8; 9];
            aad[..8].copy_from_slice(&chunk_index.to_be_bytes());
            aad[8] = is_last as u8;

            let sealed = encrypt(master_key, &nonce, chunk, &aad)?;
            spool.write_all(&(sealed.len() as u32).to_le_bytes())?;
            spool.write_all(&sealed)?;
            region_size += 4 + sealed.len() as u64;
            chunk_index += 1;
        }

        // Distribute the group's compressed payload across members proportionally
        // to original size, for an honest per-file ratio display. Remainder goes
        // to the last file so the sum equals `compressed_size` exactly.
        if !member_entries.is_empty() {
            let mut assigned = 0u64;
            let last = member_entries.len() - 1;
            for (i, e) in member_entries.iter_mut().enumerate() {
                if i == last {
                    e.compressed_size = compressed_size.saturating_sub(assigned);
                } else {
                    let share = if uncompressed_size > 0 {
                        compressed_size * e.original_size / uncompressed_size
                    } else {
                        0
                    };
                    e.compressed_size = share;
                    assigned += share;
                }
            }
        }

        let group = GroupEntry {
            group_id,
            data_offset,
            chunk_count: total_chunks,
            stored_size: region_size,
            content_nonce: nonce_b64,
            compressed_size,
            uncompressed_size,
            stored_raw,
        };
        Ok((group, member_entries, region_size))
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

/// Decide, for v3, which files are eligible for solid grouping. A file is
/// eligible when it is compressible (by the same `decide_level` policy used for
/// per-file content, sampling its leading bytes) **and** small enough that
/// bundling helps (≤ [`GROUP_TARGET`]). Large files already build an adequate
/// zstd dictionary on their own and would blow the group memory bound, so they
/// stay per-file. Incompressible files (media/archives) are never grouped.
fn classify_eligibility(files: &[FileRecord]) -> Result<Vec<bool>, ArchiveError> {
    let mut mask = vec![false; files.len()];
    for (i, (archive_path, (original_size, fs_path, _, _))) in files.iter().enumerate() {
        // Empty files carry no content but still benefit from skipping a whole
        // per-file region; group them (they contribute 0 bytes to the stream).
        if *original_size == 0 {
            mask[i] = true;
            continue;
        }
        if *original_size > GROUP_TARGET {
            continue;
        }
        // Sample the leading bytes to classify, mirroring the per-file decision.
        let sample = read_sample(fs_path)?;
        let level = decide_level(archive_path, &sample, CompressionLevel::Maximum);
        mask[i] = level != CompressionLevel::None;
    }
    Ok(mask)
}

/// Read up to a 4 KiB classification sample from a file's head.
fn read_sample(path: &Path) -> Result<Vec<u8>, ArchiveError> {
    let mut f = File::open(path)?;
    let mut buf = vec![0u8; 4096];
    let mut filled = 0;
    while filled < buf.len() {
        let n = f.read(&mut buf[filled..])?;
        if n == 0 {
            break;
        }
        filled += n;
    }
    buf.truncate(filled);
    Ok(buf)
}

/// Bucket the eligible file indices into solid groups bounded by [`GROUP_TARGET`]
/// uncompressed bytes. Files are first sorted by archive path so that files
/// sharing a directory (and thus likely sharing content patterns) land in the
/// same group — improving the cross-file dictionary gain. A greedy fill keeps
/// each group at or below the target; a single file never exceeds it because the
/// caller only marks files ≤ target as eligible.
fn bucket_groups(files: &[FileRecord], eligible: &[usize]) -> Vec<Vec<usize>> {
    let mut sorted: Vec<usize> = eligible.to_vec();
    sorted.sort_by(|&a, &b| files[a].0.cmp(&files[b].0));

    let mut buckets: Vec<Vec<usize>> = Vec::new();
    let mut current: Vec<usize> = Vec::new();
    let mut current_size: u64 = 0;
    for idx in sorted {
        let size = files[idx].1 .0;
        if !current.is_empty() && current_size + size > GROUP_TARGET {
            buckets.push(std::mem::take(&mut current));
            current_size = 0;
        }
        current.push(idx);
        current_size += size;
    }
    if !current.is_empty() {
        buckets.push(current);
    }
    buckets
}

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
