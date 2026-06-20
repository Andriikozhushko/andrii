use thiserror::Error;

#[derive(Debug, Error)]
pub enum ArchiveError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Cryptographic error: {0}")]
    Crypto(#[from] andrii_crypto::CryptoError),

    #[error("Compression error: {0}")]
    Compress(#[from] andrii_compress::CompressError),

    #[error("Not a valid ANDRII archive")]
    InvalidMagic,

    #[error("Unsupported archive version: {0} (this application supports up to version {1})")]
    UnsupportedVersion(u16, u16),

    #[error("Invalid password or corrupted archive header")]
    InvalidPassword,

    #[error("Archive is corrupted: {0}")]
    Corrupted(String),

    #[error("File integrity check failed for: {0}")]
    IntegrityFailed(String),

    #[error("File not found in archive: {0}")]
    FileNotFound(String),

    #[error("Header serialization error: {0}")]
    Serialization(String),

    #[error("Archive format error: {0}")]
    Format(String),
}

impl From<serde_json::Error> for ArchiveError {
    fn from(e: serde_json::Error) -> Self {
        Self::Serialization(e.to_string())
    }
}

impl From<hex::FromHexError> for ArchiveError {
    fn from(e: hex::FromHexError) -> Self {
        Self::Format(format!("Hex decode error: {}", e))
    }
}
