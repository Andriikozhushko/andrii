use serde::{Deserialize, Serialize};

/// Metadata for a single file within the archive.
/// All fields are stored in the encrypted header.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    /// Relative path using forward slashes, UTF-8 encoded.
    pub path: String,

    /// Original (uncompressed) file size in bytes.
    pub original_size: u64,

    /// Size of the stored block: compressed + encrypted (including 16-byte AEAD tag).
    pub compressed_encrypted_size: u64,

    /// Base64url-encoded 24-byte XChaCha20-Poly1305 nonce for this file's content.
    pub content_nonce: String,

    /// Byte offset within the data section where this file's block begins.
    pub data_offset: u64,

    /// Hex-encoded BLAKE3 hash of the original (pre-compression) file content.
    pub blake3_hash: String,

    /// File modification time as Unix timestamp (seconds since epoch).
    pub modified_at: u64,

    /// Unix permission bits (e.g., 0o644 = 420). Zero on Windows.
    pub unix_mode: u32,
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
        let compressed_size = e.compressed_encrypted_size.saturating_sub(16); // subtract AEAD tag
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
