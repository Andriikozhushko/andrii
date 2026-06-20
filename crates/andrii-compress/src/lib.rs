pub mod error;

pub use error::CompressError;
use serde::{Deserialize, Serialize};

/// Compression level profile.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompressionLevel {
    /// Fast compression — zstd level 1. Best for large files or time-sensitive operations.
    Fast,
    /// Balanced compression — zstd level 6. Good ratio with reasonable speed.
    Balanced,
    /// Maximum compression — zstd level 19. Best ratio, slower.
    Maximum,
    /// No compression — store raw bytes. Useful for already-compressed content.
    None,
}

impl CompressionLevel {
    fn zstd_level(self) -> i32 {
        match self {
            Self::Fast => 1,
            Self::Balanced => 6,
            Self::Maximum => 19,
            Self::None => 0,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Fast => "Fast",
            Self::Balanced => "Balanced",
            Self::Maximum => "Maximum",
            Self::None => "None",
        }
    }
}

impl Default for CompressionLevel {
    fn default() -> Self {
        Self::Balanced
    }
}

/// Compress bytes using the specified level.
pub fn compress(data: &[u8], level: CompressionLevel) -> Result<Vec<u8>, CompressError> {
    if level == CompressionLevel::None {
        return Ok(data.to_vec());
    }
    zstd::encode_all(data, level.zstd_level()).map_err(CompressError::CompressionFailed)
}

/// Decompress bytes compressed with zstd.
pub fn decompress(data: &[u8], original_size_hint: Option<usize>) -> Result<Vec<u8>, CompressError> {
    let capacity = original_size_hint.unwrap_or(data.len() * 4).min(512 * 1024 * 1024);
    zstd::decode_all(data)
        .map_err(|e| CompressError::DecompressionFailed(e.to_string()))
        .map(|mut v| {
            // Shrink to fit to avoid holding excess memory
            v.shrink_to(capacity);
            v
        })
}

/// Estimate whether compression is beneficial for this data.
/// Returns false for already-compressed data (high entropy).
pub fn should_compress(data: &[u8]) -> bool {
    if data.len() < 64 {
        return false;
    }
    // Sample the first 4KB to estimate entropy
    let sample = &data[..data.len().min(4096)];
    let compressed = zstd::encode_all(sample, 1).unwrap_or_default();
    // If compression ratio < 0.95, compression is worthwhile
    (compressed.len() as f64 / sample.len() as f64) < 0.95
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_decompress_roundtrip() {
        let data = b"ANDRII secure archive test data - repeated pattern ".repeat(100);
        for level in [CompressionLevel::Fast, CompressionLevel::Balanced, CompressionLevel::Maximum] {
            let compressed = compress(&data, level).unwrap();
            let decompressed = decompress(&compressed, Some(data.len())).unwrap();
            assert_eq!(data.as_slice(), decompressed.as_slice(), "Roundtrip failed for {:?}", level);
        }
    }

    #[test]
    fn test_compress_reduces_size_for_repetitive_data() {
        let data = vec![0u8; 10_000];
        let compressed = compress(&data, CompressionLevel::Balanced).unwrap();
        assert!(compressed.len() < data.len() / 10, "Expected high compression ratio");
    }

    #[test]
    fn test_none_level_is_passthrough() {
        let data = b"raw bytes, no compression";
        let result = compress(data, CompressionLevel::None).unwrap();
        assert_eq!(result, data);
    }

    #[test]
    fn test_empty_data() {
        let compressed = compress(&[], CompressionLevel::Balanced).unwrap();
        let decompressed = decompress(&compressed, Some(0)).unwrap();
        assert!(decompressed.is_empty());
    }
}
