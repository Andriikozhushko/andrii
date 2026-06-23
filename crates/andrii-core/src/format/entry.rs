use serde::{Deserialize, Serialize};

/// Metadata for a single file within the archive.
/// All fields are stored in the encrypted header.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    /// Relative path using forward slashes, UTF-8 encoded.
    pub path: String,

    /// Original (uncompressed) file size in bytes.
    pub original_size: u64,

    /// Size of the stored block: compressed + encrypted (including AEAD tags and,
    /// in v2, the per-chunk length prefixes). This is the on-disk region length.
    pub compressed_encrypted_size: u64,

    /// Base64url-encoded nonce for this file's content. v1: full 24-byte nonce.
    /// v2: 16-byte base nonce (the trailing 8 bytes are a per-chunk counter).
    pub content_nonce: String,

    /// Byte offset within the data section where this file's block begins.
    pub data_offset: u64,

    /// Hex-encoded BLAKE3 hash of the original (pre-compression) file content.
    pub blake3_hash: String,

    /// File modification time as Unix timestamp (seconds since epoch).
    pub modified_at: u64,

    /// Unix permission bits (e.g., 0o644 = 420). Zero on Windows.
    pub unix_mode: u32,

    /// v2: number of chunks the file's content is split into (0 for empty files).
    /// Absent (defaults 0) in v1 archives, which store a single block.
    #[serde(default)]
    pub chunk_count: u64,

    /// v2: true when the content was stored without zstd (already-compressed data).
    /// Absent (defaults false) in v1 archives.
    #[serde(default)]
    pub stored_raw: bool,

    /// v2: total compressed payload size (post-zstd, pre-encryption), summed over
    /// chunks — used for honest compression-ratio display. 0 in v1 (fall back to
    /// `compressed_encrypted_size`).
    #[serde(default)]
    pub compressed_size: u64,
}

impl FileEntry {
    /// Decode the content nonce from base64url.
    /// Returns an error string if decoding fails or the length is wrong.
    pub fn decode_nonce(&self) -> Result<[u8; 24], String> {
        use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
        let bytes = URL_SAFE_NO_PAD
            .decode(&self.content_nonce)
            .map_err(|e| format!("base64 decode error: {e}"))?;
        if bytes.len() != 24 {
            return Err(format!("nonce length {} != 24", bytes.len()));
        }
        let mut nonce = [0u8; 24];
        nonce.copy_from_slice(&bytes);
        Ok(nonce)
    }

    /// Decode the v2 16-byte base nonce from base64url.
    pub fn decode_base_nonce(&self) -> Result<[u8; 16], String> {
        use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
        let bytes = URL_SAFE_NO_PAD
            .decode(&self.content_nonce)
            .map_err(|e| format!("base64 decode error: {e}"))?;
        if bytes.len() != 16 {
            return Err(format!("base nonce length {} != 16", bytes.len()));
        }
        let mut nonce = [0u8; 16];
        nonce.copy_from_slice(&bytes);
        Ok(nonce)
    }

    /// Decode the BLAKE3 hash from hex.
    pub fn decode_hash(&self) -> Result<[u8; 32], hex::FromHexError> {
        andrii_crypto::hash_from_hex(&self.blake3_hash)
    }
}

/// Summary of a file entry for display in the GUI (no crypto material).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntrySummary {
    pub path: String,
    pub original_size: u64,
    pub compressed_size: u64,
    pub modified_at: u64,
    pub compression_ratio: f64,
}

impl From<&FileEntry> for FileEntrySummary {
    fn from(e: &FileEntry) -> Self {
        // v2 records the true compressed payload size; v1 only has the on-disk
        // block size, so approximate by removing the single AEAD tag.
        let compressed_size = if e.compressed_size > 0 {
            e.compressed_size
        } else {
            e.compressed_encrypted_size.saturating_sub(16)
        };
        let compression_ratio = if e.original_size > 0 {
            1.0 - (compressed_size as f64 / e.original_size as f64)
        } else {
            0.0
        };
        Self {
            path: e.path.clone(),
            original_size: e.original_size,
            compressed_size,
            modified_at: e.modified_at,
            compression_ratio,
        }
    }
}
