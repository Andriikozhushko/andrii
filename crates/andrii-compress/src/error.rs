use thiserror::Error;

#[derive(Debug, Error)]
pub enum CompressError {
    #[error("Compression failed: {0}")]
    CompressionFailed(#[from] std::io::Error),

    #[error("Decompression failed: {0}")]
    DecompressionFailed(String),
}
