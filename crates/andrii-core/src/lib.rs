pub mod archive;
pub mod error;
pub mod format;

pub use archive::{
    ArchiveInfo, ArchiveReader, ArchiveWriter, CreateArchiveOptions, VerifyResult, verify_archive,
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
}
