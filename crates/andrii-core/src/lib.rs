pub mod archive;
pub mod error;
pub mod format;

pub use archive::{
    ArchiveInfo, ArchiveReader, ArchiveWriter, CreateArchiveOptions, Phase, Progress, VerifyResult,
    verify_archive,
};
pub use error::ArchiveError;
pub use format::entry::{FileEntry, FileEntrySummary};

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use tempfile::TempDir;

    use andrii_compress::CompressionLevel;

    use crate::archive::{ArchiveWriter, CreateArchiveOptions, ArchiveReader, verify_archive};

    fn create_test_archive(tmp: &TempDir, password: &str) -> PathBuf {
        // Create some test files
        let file1 = tmp.path().join("hello.txt");
        let file2 = tmp.path().join("data.bin");
        std::fs::write(&file1, b"Hello, ANDRII! This is a test file with some content.").unwrap();
        std::fs::write(&file2, &vec![0x42u8; 1024]).unwrap();

        let output = tmp.path().join("test.andrii");
        let opts = CreateArchiveOptions {
            archive_name: "test".to_string(),
            password: password.to_string(),
            compression: CompressionLevel::Fast,
            output_path: output.clone(),
            progress_callback: None,
            force_legacy_v2: false,
        };
        let writer = ArchiveWriter::new(opts);
        writer.create(&[file1, file2]).unwrap();
        output
    }

    #[test]
    fn test_create_and_verify() {
        let tmp = TempDir::new().unwrap();
        let archive_path = create_test_archive(&tmp, "test-password-secure");

        let result = verify_archive(&archive_path).unwrap();
        assert!(result.is_valid, "Archive should be valid: {:?}", result.error);
        assert!(result.integrity_hash_valid);
    }

    #[test]
    fn test_open_correct_password() {
        let tmp = TempDir::new().unwrap();
        let archive_path = create_test_archive(&tmp, "my-secure-password");

        let reader = ArchiveReader::open(&archive_path, "my-secure-password").unwrap();
        let info = reader.info();
        assert_eq!(info.file_count, 2);
        assert_eq!(info.archive_name, "test");
    }

    #[test]
    fn test_open_wrong_password_fails() {
        let tmp = TempDir::new().unwrap();
        let archive_path = create_test_archive(&tmp, "correct-password");

        let result = ArchiveReader::open(&archive_path, "wrong-password");
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_all_roundtrip() {
        let tmp = TempDir::new().unwrap();
        let archive_path = create_test_archive(&tmp, "extract-test-pass");

        let reader = ArchiveReader::open(&archive_path, "extract-test-pass").unwrap();
        let out_dir = tmp.path().join("extracted");
        std::fs::create_dir_all(&out_dir).unwrap();

        let extracted = reader.extract_all(&out_dir).unwrap();
        assert_eq!(extracted.len(), 2);

        // Verify content
        let hello = std::fs::read(out_dir.join("hello.txt")).unwrap();
        assert_eq!(hello, b"Hello, ANDRII! This is a test file with some content.");

        let data = std::fs::read(out_dir.join("data.bin")).unwrap();
        assert_eq!(data, vec![0x42u8; 1024]);
    }

    #[test]
    fn test_verify_invalid_file() {
        let tmp = TempDir::new().unwrap();
        let not_archive = tmp.path().join("fake.andrii");
        std::fs::write(&not_archive, b"this is not an archive").unwrap();

        let result = verify_archive(&not_archive).unwrap();
        assert!(!result.is_valid);
        assert!(!result.has_valid_magic);
    }

    /// The v2 reader must still open legacy v1 archives (single block per file).
    /// We hand-build a v1 archive from the format primitives to prove it.
    #[test]
    fn v1_archive_opens_and_extracts() {
        use crate::format::entry::FileEntry;
        use crate::format::header::{Argon2ParamsJson, EncryptedHeader, FixedHeader, Footer};
        use andrii_compress::compress;
        use andrii_crypto::{
            cipher::{encrypt, generate_nonce},
            hash::{hash_bytes, hash_to_hex},
            kdf::{derive_key, generate_salt, KdfParams},
        };
        use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};

        let tmp = TempDir::new().unwrap();
        let pw = "v1-back-compat-pass";
        let salt = generate_salt().unwrap();
        let key = derive_key(pw, &salt, &KdfParams::default()).unwrap();

        let inputs: Vec<(&str, Vec<u8>)> = vec![
            ("hello.txt", b"Hello from a legacy v1 archive!".to_vec()),
            ("data.bin", vec![7u8; 5000]),
        ];

        // Data section: one compressed+encrypted block per file (v1 layout).
        let mut data_section = Vec::new();
        let mut entries = Vec::new();
        let mut offset = 0u64;
        for (path, content) in &inputs {
            let h = hash_bytes(content);
            let compressed = compress(content, CompressionLevel::Balanced).unwrap();
            let nonce = generate_nonce().unwrap();
            let enc = encrypt(&key, &nonce, &compressed, &h).unwrap();
            entries.push(FileEntry {
                path: path.to_string(),
                original_size: content.len() as u64,
                compressed_encrypted_size: enc.len() as u64,
                content_nonce: URL_SAFE_NO_PAD.encode(nonce),
                data_offset: offset,
                blake3_hash: hash_to_hex(&h),
                modified_at: 0,
                unix_mode: 0,
                chunk_count: 0,   // v1 entries lack these (serde default)
                stored_raw: false,
                compressed_size: 0,
                group_id: None,
                group_offset: 0,
            });
            offset += enc.len() as u64;
            data_section.extend_from_slice(&enc);
        }

        let header = EncryptedHeader {
            archive_name: "v1".into(),
            created_at: 0,
            creator_version: "andrii/1.0.0".into(),
            compression: "Balanced".into(),
            argon2_params: Argon2ParamsJson { m_cost: 65536, t_cost: 3, p_cost: 4 },
            extra: serde_json::Value::Object(Default::default()),
            entries,
            groups: Vec::new(),
        };
        let json = header.to_json().unwrap();
        let hnonce = generate_nonce().unwrap();
        let enc_header_len = (json.len() + 16) as u64;
        let fixed = FixedHeader { version: 1, flags: 0, kdf_salt: salt, header_nonce: hnonce, enc_header_len };
        let fixed_bytes = fixed.to_bytes();
        let enc_header = encrypt(&key, &hnonce, &json, &fixed_bytes).unwrap();

        let mut bytes = Vec::new();
        bytes.extend_from_slice(&fixed_bytes);
        bytes.extend_from_slice(&enc_header);
        bytes.extend_from_slice(&data_section);
        let hash = blake3::hash(&bytes);
        bytes.extend_from_slice(&Footer::new(*hash.as_bytes()).to_bytes());

        let path = tmp.path().join("legacy.andrii");
        std::fs::write(&path, &bytes).unwrap();

        assert!(verify_archive(&path).unwrap().is_valid, "v1 archive should verify");
        let reader = ArchiveReader::open(&path, pw).unwrap();
        assert_eq!(reader.info().format_version, 1);
        let out = tmp.path().join("out");
        std::fs::create_dir_all(&out).unwrap();
        reader.extract_all(&out).unwrap();
        for (p, c) in &inputs {
            assert_eq!(&std::fs::read(out.join(p)).unwrap(), c, "v1 extract mismatch for {p}");
        }
    }
}
