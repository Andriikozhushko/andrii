use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng, Payload},
    XChaCha20Poly1305, XNonce,
};
use zeroize::Zeroizing;

use crate::error::CryptoError;

pub const NONCE_LEN: usize = 24;
pub const TAG_LEN: usize = 16;

/// Generate a random 192-bit nonce for XChaCha20-Poly1305.
pub fn generate_nonce() -> Result<[u8; NONCE_LEN], CryptoError> {
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    Ok(nonce.into())
}

/// Encrypt plaintext with XChaCha20-Poly1305.
///
/// Returns `ciphertext || poly1305_tag` (plaintext_len + 16 bytes).
/// The `aad` (additional authenticated data) is authenticated but not encrypted.
pub fn encrypt(
    key: &Zeroizing<[u8; 32]>,
    nonce: &[u8; NONCE_LEN],
    plaintext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    let cipher = XChaCha20Poly1305::new(key.as_ref().into());
    let xnonce = XNonce::from_slice(nonce);

    cipher
        .encrypt(xnonce, Payload { msg: plaintext, aad })
        .map_err(|_| CryptoError::EncryptionFailed)
}

/// Decrypt ciphertext (with appended tag) using XChaCha20-Poly1305.
///
/// Returns the original plaintext on success.
/// Returns `DecryptionFailed` on wrong key, wrong nonce, tampered ciphertext, or wrong AAD.
pub fn decrypt(
    key: &Zeroizing<[u8; 32]>,
    nonce: &[u8; NONCE_LEN],
    ciphertext_with_tag: &[u8],
    aad: &[u8],
) -> Result<Zeroizing<Vec<u8>>, CryptoError> {
    let cipher = XChaCha20Poly1305::new(key.as_ref().into());
    let xnonce = XNonce::from_slice(nonce);

    let plaintext = cipher
        .decrypt(xnonce, Payload { msg: ciphertext_with_tag, aad })
        .map_err(|_| CryptoError::DecryptionFailed)?;

    Ok(Zeroizing::new(plaintext))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kdf::{derive_key, KdfParams};

    fn test_key() -> Zeroizing<[u8; 32]> {
        let salt = [0u8; 32];
        derive_key("testkey", &salt, &KdfParams { m_cost: 1024, t_cost: 1, p_cost: 1 }).unwrap()
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = test_key();
        let nonce = generate_nonce().unwrap();
        let plaintext = b"Hello, ANDRII secure archive!";
        let aad = b"associated data";

        let ct = encrypt(&key, &nonce, plaintext, aad).unwrap();
        let pt = decrypt(&key, &nonce, &ct, aad).unwrap();

        assert_eq!(pt.as_slice(), plaintext);
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = test_key();
        let key2 = derive_key(
            "other",
            &[1u8; 32],
            &KdfParams { m_cost: 1024, t_cost: 1, p_cost: 1 },
        )
        .unwrap();
        let nonce = generate_nonce().unwrap();
        let ct = encrypt(&key1, &nonce, b"secret", b"").unwrap();
        assert!(decrypt(&key2, &nonce, &ct, b"").is_err());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let key = test_key();
        let nonce = generate_nonce().unwrap();
        let mut ct = encrypt(&key, &nonce, b"secret data", b"").unwrap();
        ct[5] ^= 0xFF;
        assert!(decrypt(&key, &nonce, &ct, b"").is_err());
    }

    #[test]
    fn test_wrong_aad_fails() {
        let key = test_key();
        let nonce = generate_nonce().unwrap();
        let ct = encrypt(&key, &nonce, b"secret", b"correct aad").unwrap();
        assert!(decrypt(&key, &nonce, &ct, b"wrong aad").is_err());
    }

    #[test]
    fn test_ciphertext_length() {
        let key = test_key();
        let nonce = generate_nonce().unwrap();
        let plaintext = b"exactly 32 bytes of plaintext!!!";
        let ct = encrypt(&key, &nonce, plaintext, b"").unwrap();
        assert_eq!(ct.len(), plaintext.len() + TAG_LEN);
    }
}
