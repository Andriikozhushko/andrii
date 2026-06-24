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

    /// v3: when `Some(g)`, this file lives inside solid group `g` (see
    /// [`GroupEntry`]) rather than its own data-section region. `None` (the
    /// default) means a per-file region, identical to v1/v2.
    ///
    /// For grouped files, `data_offset`, `content_nonce`, `chunk_count` and
    /// `compressed_encrypted_size` are not used for content location (they are 0
    /// / empty); the file is located via the group's stream plus `group_offset`.
    #[serde(default)]
    pub group_id: Option<u32>,

    /// v3: byte offset of this file within its group's *decompressed* plaintext.
    /// Only meaningful when `group_id` is `Some`. The file occupies
    /// `[group_offset .. group_offset + original_size]` of the inflated group.
    #[serde(default)]
    pub group_offset: u64,
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

/// Metadata for a single v3 solid group: a bundle of compressible files
/// concatenated, compressed as one zstd stream, then split into 1 MiB chunks and
/// sealed exactly like a v2 file region (nonce = base16 ‖ chunk_index,
/// AAD = chunk_index ‖ last_flag). Stored in the encrypted header.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupEntry {
    /// 0-based group id, matching `FileEntry::group_id`.
    pub group_id: u32,

    /// Byte offset of the group's first chunk within the data section.
    pub data_offset: u64,

    /// Number of 1 MiB chunks the compressed stream is split into.
    pub chunk_count: u64,

    /// On-disk bytes of the group region (Σ chunk ciphertext + 4-byte length
    /// prefixes + AEAD tags). This is the region length in the data section.
    pub stored_size: u64,

    /// Base64url-encoded 16-byte base nonce; the trailing 8 bytes are the
    /// per-chunk counter, identical to a v2 file region.
    pub content_nonce: String,

    /// Post-zstd, pre-encryption size of the group stream — for honest ratio.
    pub compressed_size: u64,

    /// Σ original (uncompressed) sizes of the files in this group. Bounded by
    /// [`super::header::GROUP_TARGET`] and used as the inflate capacity hint.
    pub uncompressed_size: u64,

    /// True when the concatenated stream was stored without zstd (the group turned
    /// out incompressible, so compressing would only add overhead). Slicing is
    /// unchanged — the inflated bytes equal the raw concatenation.
    #[serde(default)]
    pub stored_raw: bool,
}

impl GroupEntry {
    /// Decode the 16-byte base nonce from base64url.
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
