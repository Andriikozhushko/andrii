use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use zeroize::Zeroizing;

use andrii_compress::{compress, CompressionLevel};
use andrii_crypto::{
    cipher::{encrypt, generate_nonce},
    hash::{hash_bytes, hash_to_hex},
    kdf::{derive_key, generate_salt, KdfParams},
};

use crate::error::ArchiveError;
use crate::format::{
    entry::FileEntry,
    header::{Argon2ParamsJson, EncryptedHeader, FixedHeader, Footer, FORMAT_VERSION},
};

/// Options for creating a new archive.
pub struct CreateArchiveOptions {
    /// Archive name (no extension).
    pub archive_name: String,
    /// Password to encrypt the archive with.
    pub password: String,
    /// Compression level.
    pub compression: CompressionLevel,
    /// Output file path (should end in .andrii).
    pub output_path: PathBuf,
    /// Optional progress callback: (current_file_index, total_files, current_file_name).
    pub progress_callback: Option<Box<dyn Fn(u64, u64, &str) + Send>>,
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

impl ArchiveWriter {
    pub fn new(options: CreateArchiveOptions) -> Self {
        Self { options }
    }

    /// Create the archive from a list of file/directory paths.
    ///
    /// Directories are recursively walked. Symlinks are skipped.
    pub fn create(&self, input_paths: &[PathBuf]) -> Result<CreateArchiveResult, ArchiveError> {
        // Collect all files to archive
        let files = collect_files(input_paths)?;
        let total_original_size: u64 = files.iter().map(|(_, meta)| meta.0).sum();

        // Derive master key
        let kdf_params = KdfParams::default();
        let salt = generate_salt()?;
        let master_key: Zeroizing<[u8; 32]> =
            derive_key(&self.options.password, &salt, &kdf_params)?;

        // Process each file: compress + encrypt, collect entries
        let mut entries: Vec<FileEntry> = Vec::with_capacity(files.len());
        let mut data_blocks: Vec<Vec<u8>> = Vec::with_capacity(files.len());
        let mut current_data_offset: u64 = 0;

        for (idx, (archive_path, (original_size, fs_path, modified_at, unix_mode))) in
            files.iter().enumerate()
        {
            if let Some(cb) = &self.options.progress_callback {
                cb(idx as u64, files.len() as u64, archive_path);
            }

            // Read file content
            let content = fs::read(fs_path)?;

            // Compute BLAKE3 hash of original content
            let blake3_hash = hash_bytes(&content);
            let blake3_hex = hash_to_hex(&blake3_hash);

            // Compress
            let compressed = compress(&content, self.options.compression)?;

            // Generate per-file nonce
            let content_nonce = generate_nonce()?;
            let nonce_b64 = URL_SAFE_NO_PAD.encode(content_nonce);

            // Encrypt with AAD = blake3_hash (binds content to its metadata)
            let encrypted = encrypt(&master_key, &content_nonce, &compressed, &blake3_hash)?;

            let compressed_encrypted_size = encrypted.len() as u64;

            entries.push(FileEntry {
                path: archive_path.clone(),
                original_size: *original_size,
                compressed_encrypted_size,
                content_nonce: nonce_b64,
                data_offset: current_data_offset,
                blake3_hash: blake3_hex,
                modified_at: *modified_at,
                unix_mode: *unix_mode,
            });

            current_data_offset += compressed_encrypted_size;
            data_blocks.push(encrypted);
        }

        let total_compressed_size: u64 =
            entries.iter().map(|e| e.compressed_encrypted_size).sum();

        let compression_ratio = if total_original_size > 0 {
            1.0 - (total_compressed_size as f64 / total_original_size as f64)
        } else {
            0.0
        };

        // Build encrypted header
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

        // Encrypt the header
        let header_nonce = generate_nonce()?;

        // The encrypted header length = plaintext_len + 16 (AEAD tag).
        // This is known before encryption, so we can build the fixed header first.
        // The fixed header bytes then serve as AAD for header encryption.
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

        // Write the archive file, computing BLAKE3 over all content for the footer
        let output_file = File::create(&self.options.output_path)?;
        let mut writer = BufWriter::new(output_file);
        let mut hasher = blake3::Hasher::new();

        macro_rules! write_and_hash {
            ($bytes:expr) => {{
                writer.write_all($bytes)?;
                hasher.update($bytes);
            }};
        }

        write_and_hash!(&fixed_header_bytes);
        write_and_hash!(&encrypted_header);
        for block in &data_blocks {
            write_and_hash!(block);
        }

        let archive_hash = *hasher.finalize().as_bytes();
        let footer = Footer::new(archive_hash);
        writer.write_all(&footer.to_bytes())?;
        writer.flush()?;

        let file_count = data_blocks.len();
        Ok(CreateArchiveResult {
            output_path: self.options.output_path.clone(),
            file_count,
            total_original_size,
            total_compressed_size,
            compression_ratio,
        })
    }
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
