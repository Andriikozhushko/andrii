use std::io::Read;

/// Compute BLAKE3 hash of a byte slice.
pub fn hash_bytes(data: &[u8]) -> [u8; 32] {
    *blake3::hash(data).as_bytes()
}

/// Compute BLAKE3 hash of a reader (streaming).
pub fn hash_reader<R: Read>(mut reader: R) -> std::io::Result<[u8; 32]> {
    let mut hasher = blake3::Hasher::new();
    let mut buf = vec![0u8; 65536];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(*hasher.finalize().as_bytes())
}

/// Encode a hash as a lowercase hex string.
pub fn hash_to_hex(hash: &[u8; 32]) -> String {
    hex::encode(hash)
}

/// Decode a hex string to a 32-byte hash.
pub fn hash_from_hex(s: &str) -> Result<[u8; 32], hex::FromHexError> {
    let bytes = hex::decode(s)?;
    if bytes.len() != 32 {
        return Err(hex::FromHexError::InvalidStringLength);
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_bytes_deterministic() {
        let h1 = hash_bytes(b"hello world");
        let h2 = hash_bytes(b"hello world");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_hash_bytes_different() {
        let h1 = hash_bytes(b"hello");
        let h2 = hash_bytes(b"world");
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_hash_reader_matches_bytes() {
        let data = b"streaming hash test data";
        let expected = hash_bytes(data);
        let actual = hash_reader(data.as_slice()).unwrap();
        assert_eq!(expected, actual);
    }

    #[test]
    fn test_hex_roundtrip() {
        let h = hash_bytes(b"roundtrip");
        let hex = hash_to_hex(&h);
        let decoded = hash_from_hex(&hex).unwrap();
        assert_eq!(h, decoded);
    }
}
