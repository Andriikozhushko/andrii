use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("Encryption failed")]
    EncryptionFailed,

    #[error("Decryption failed: invalid password or corrupted data")]
    DecryptionFailed,

    #[error("Key derivation failed: {0}")]
    KdfFailed(String),

    #[error("Random number generation failed")]
    RngFailed,

    #[error("Invalid key length: expected {expected}, got {got}")]
    InvalidKeyLength { expected: usize, got: usize },

    #[error("Invalid nonce length: expected {expected}, got {got}")]
    InvalidNonceLength { expected: usize, got: usize },
}
