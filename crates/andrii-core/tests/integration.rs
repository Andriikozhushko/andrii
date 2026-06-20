//! Integration tests for the ANDRII archive format.
//!
//! Tests cover the full create → open → extract → verify pipeline
//! and all critical error paths.

use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

use andrii_compress::CompressionLevel;
use andrii_core::{
    ArchiveError, ArchiveReader, ArchiveWriter, CreateArchiveOptions, verify_archive,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

fn fixtures_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

fn fixture(name: &str) -> PathBuf {
    fixtures_dir().join(name)
}

fn make_archive(
    tmp: &TempDir,
    name: &str,
    files: &[PathBuf],
    password: &str,
    compression: CompressionLevel,
) -> PathBuf {
    let output = tmp.path().join(format!("{name}.andrii"));
    let opts = CreateArchiveOptions {
        archive_name: name.to_string(),
        password: password.to_string(),
        compression,
        output_path: output.clone(),
        progress_callback: None,
    };
    ArchiveWriter::new(opts)
        .create(files)
        .expect("archive creation failed");
    output
}

// ── 1. Create archive ─────────────────────────────────────────────────────────

#[test]
fn create_archive_from_single_file() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "single",
        &[fixture("hello.txt")],
        "StrongPass#1!",
        CompressionLevel::Balanced,
    );
    assert!(archive.exists(), "archive file should be created");
    assert!(archive.metadata().unwrap().len() > 100, "archive should not be empty");
}

#[test]
fn create_archive_from_multiple_files() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "multi",
        &[fixture("hello.txt"), fixture("binary.bin"), fixture("compressible.txt")],
        "StrongPass#1!",
        CompressionLevel::Balanced,
    );
    assert!(archive.exists());
    let info_result = ArchiveReader::open(&archive, "StrongPass#1!");
    assert!(info_result.is_ok());
    let info = info_result.unwrap().info();
    assert_eq!(info.file_count, 3);
}

#[test]
fn create_archive_from_directory() {
    let tmp = TempDir::new().unwrap();
    // Use the fixtures directory as input folder
    let archive = make_archive(
        &tmp,
        "from-dir",
        &[fixtures_dir()],
        "DirPass!99",
        CompressionLevel::Fast,
    );
    assert!(archive.exists());
    let reader = ArchiveReader::open(&archive, "DirPass!99").unwrap();
    assert!(reader.info().file_count >= 3, "should contain at least 3 fixture files");
}

#[test]
fn create_archive_with_empty_file() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "empty-file",
        &[fixture("empty.txt")],
        "EmptyPass!",
        CompressionLevel::Balanced,
    );
    let reader = ArchiveReader::open(&archive, "EmptyPass!").unwrap();
    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();
    let extracted = reader.extract_all(&out_dir).unwrap();
    assert_eq!(extracted.len(), 1);
    let content = fs::read(&extracted[0]).unwrap();
    assert!(content.is_empty(), "extracted empty file must be empty");
}

// ── 2. Open archive with correct password ────────────────────────────────────

#[test]
fn open_with_correct_password_succeeds() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "open-ok",
        &[fixture("hello.txt")],
        "CorrectPassword!42",
        CompressionLevel::Balanced,
    );
    let result = ArchiveReader::open(&archive, "CorrectPassword!42");
    assert!(result.is_ok(), "should open with correct password");
    let info = result.unwrap().info();
    assert_eq!(info.archive_name, "open-ok");
    assert_eq!(info.file_count, 1);
}

// ── 3. Reject wrong password ─────────────────────────────────────────────────

#[test]
fn open_with_wrong_password_fails() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "wrong-pass",
        &[fixture("hello.txt")],
        "RealPassword!99",
        CompressionLevel::Fast,
    );
    let err = ArchiveReader::open(&archive, "WrongPassword").err().unwrap();
    assert!(
        matches!(err, ArchiveError::InvalidPassword),
        "expected InvalidPassword, got: {err:?}"
    );
}

#[test]
fn open_with_empty_password_fails() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "empty-pass",
        &[fixture("hello.txt")],
        "RealPassword!",
        CompressionLevel::Fast,
    );
    let err = ArchiveReader::open(&archive, "").err().unwrap();
    assert!(matches!(err, ArchiveError::InvalidPassword));
}

// ── 4. Extract selected files ─────────────────────────────────────────────────

#[test]
fn extract_selected_file_only() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "select",
        &[fixture("hello.txt"), fixture("binary.bin")],
        "SelectPass#7",
        CompressionLevel::Balanced,
    );
    let reader = ArchiveReader::open(&archive, "SelectPass#7").unwrap();
    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();

    // Extract only hello.txt
    let path = reader.extract_file("hello.txt", &out_dir).unwrap();
    assert!(path.exists(), "extracted file should exist");
    // binary.bin should NOT be present
    assert!(!out_dir.join("binary.bin").exists(), "binary.bin should not be extracted");
}

// ── 5. Extract all files ──────────────────────────────────────────────────────

#[test]
fn extract_all_files() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "extract-all",
        &[fixture("hello.txt"), fixture("binary.bin"), fixture("compressible.txt")],
        "ExtractAllPass!",
        CompressionLevel::Maximum,
    );
    let reader = ArchiveReader::open(&archive, "ExtractAllPass!").unwrap();
    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();

    let extracted = reader.extract_all(&out_dir).unwrap();
    assert_eq!(extracted.len(), 3, "should extract all 3 files");
    for p in &extracted {
        assert!(p.exists(), "extracted file missing: {}", p.display());
        assert!(p.metadata().unwrap().len() > 0, "expected non-empty file: {}", p.display());
    }
}

// ── 6. Byte-for-byte content preservation ────────────────────────────────────

#[test]
fn extracted_text_file_is_byte_identical() {
    let tmp = TempDir::new().unwrap();
    let original = fs::read(fixture("hello.txt")).unwrap();

    let archive = make_archive(
        &tmp,
        "text-exact",
        &[fixture("hello.txt")],
        "TextExactPass!",
        CompressionLevel::Balanced,
    );
    let reader = ArchiveReader::open(&archive, "TextExactPass!").unwrap();
    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();
    reader.extract_file("hello.txt", &out_dir).unwrap();

    let extracted = fs::read(out_dir.join("hello.txt")).unwrap();
    assert_eq!(original, extracted, "text content must be byte-identical");
}

#[test]
fn extracted_binary_file_is_byte_identical() {
    let tmp = TempDir::new().unwrap();
    let original = fs::read(fixture("binary.bin")).unwrap();

    let archive = make_archive(
        &tmp,
        "bin-exact",
        &[fixture("binary.bin")],
        "BinExactPass!",
        CompressionLevel::Fast,
    );
    let reader = ArchiveReader::open(&archive, "BinExactPass!").unwrap();
    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();
    reader.extract_file("binary.bin", &out_dir).unwrap();

    let extracted = fs::read(out_dir.join("binary.bin")).unwrap();
    assert_eq!(original, extracted, "binary content must be byte-identical");
}

#[test]
fn all_compression_levels_produce_identical_output() {
    let original = fs::read(fixture("compressible.txt")).unwrap();
    let levels = [CompressionLevel::Fast, CompressionLevel::Balanced, CompressionLevel::Maximum];

    for level in levels {
        let tmp = TempDir::new().unwrap();
        let archive = make_archive(
            &tmp,
            "compress-level",
            &[fixture("compressible.txt")],
            "LevelPass!",
            level,
        );
        let reader = ArchiveReader::open(&archive, "LevelPass!").unwrap();
        let out_dir = tmp.path().join("out");
        fs::create_dir_all(&out_dir).unwrap();
        reader.extract_file("compressible.txt", &out_dir).unwrap();
        let extracted = fs::read(out_dir.join("compressible.txt")).unwrap();
        assert_eq!(
            original, extracted,
            "content mismatch at compression level {level:?}"
        );
    }
}

// ── 7. Verify valid archive ───────────────────────────────────────────────────

#[test]
fn verify_valid_archive_passes() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "verify-ok",
        &[fixture("hello.txt"), fixture("binary.bin")],
        "VerifyPass!",
        CompressionLevel::Balanced,
    );
    let result = verify_archive(&archive).unwrap();
    assert!(result.is_valid, "valid archive should pass: {:?}", result.error);
    assert!(result.integrity_hash_valid);
    assert!(result.has_valid_magic);
    assert!(result.version_supported);
    assert_eq!(result.format_version, 1);
}

// ── 8. Detect tampered archive ───────────────────────────────────────────────

#[test]
fn verify_detects_tampered_data() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "tampered",
        &[fixture("hello.txt")],
        "TamperPass!",
        CompressionLevel::Balanced,
    );

    // Flip a byte in the middle of the archive (data section)
    let mut bytes = fs::read(&archive).unwrap();
    let mid = bytes.len() / 2;
    bytes[mid] ^= 0xFF;
    fs::write(&archive, &bytes).unwrap();

    let result = verify_archive(&archive).unwrap();
    assert!(!result.is_valid, "tampered archive should fail integrity check");
    assert!(!result.integrity_hash_valid);
}

#[test]
fn open_detects_tampered_header() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "tampered-hdr",
        &[fixture("hello.txt")],
        "TamperHdrPass!",
        CompressionLevel::Balanced,
    );

    // Flip a byte in the encrypted header block (bytes 80-90)
    let mut bytes = fs::read(&archive).unwrap();
    bytes[80] ^= 0xFF;
    fs::write(&archive, &bytes).unwrap();

    let err = ArchiveReader::open(&archive, "TamperHdrPass!").err().unwrap();
    assert!(
        matches!(err, ArchiveError::InvalidPassword),
        "tampered header should look like wrong password: {err:?}"
    );
}

#[test]
fn extract_detects_tampered_content() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "tampered-content",
        &[fixture("hello.txt")],
        "TamperContentPass!",
        CompressionLevel::Balanced,
    );

    // Get archive file size to find data section (after header)
    let bytes_orig = fs::read(&archive).unwrap();
    let len = bytes_orig.len();
    // Corrupt a byte near the end of the data section (before the 548-byte footer)
    let mut bytes = bytes_orig.clone();
    let data_byte = len - 548 - 10;
    bytes[data_byte] ^= 0xFF;
    fs::write(&archive, &bytes).unwrap();

    let reader = ArchiveReader::open(&archive, "TamperContentPass!");
    if let Ok(r) = reader {
        let out_dir = tmp.path().join("out");
        fs::create_dir_all(&out_dir).unwrap();
        let err = r.extract_all(&out_dir).unwrap_err();
        assert!(
            matches!(err, ArchiveError::Corrupted(_)),
            "expected content authentication failure, got: {err:?}"
        );
    }
    // If open itself fails (tampered header), that's also a valid detection
}

// ── 9. Invalid file / not an archive ─────────────────────────────────────────

#[test]
fn verify_rejects_non_archive_file() {
    let tmp = TempDir::new().unwrap();
    let fake = tmp.path().join("fake.andrii");
    fs::write(&fake, b"this is not an andrii archive").unwrap();

    let result = verify_archive(&fake).unwrap();
    assert!(!result.is_valid);
    assert!(!result.has_valid_magic);
}

#[test]
fn open_rejects_non_archive_file() {
    let tmp = TempDir::new().unwrap();
    let fake = tmp.path().join("fake.andrii");
    fs::write(&fake, b"not an archive").unwrap();

    let err = ArchiveReader::open(&fake, "anypassword").err().unwrap();
    assert!(matches!(err, ArchiveError::InvalidMagic | ArchiveError::Io(_)));
}

#[test]
fn open_returns_error_for_missing_file() {
    let tmp = TempDir::new().unwrap();
    let missing = tmp.path().join("does_not_exist.andrii");

    let err = ArchiveReader::open(&missing, "pass").err().unwrap();
    assert!(matches!(err, ArchiveError::Io(_)));
}

#[test]
fn extract_returns_error_for_missing_file_in_archive() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "missing-entry",
        &[fixture("hello.txt")],
        "MissingPass!",
        CompressionLevel::Fast,
    );
    let reader = ArchiveReader::open(&archive, "MissingPass!").unwrap();
    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();

    let err = reader.extract_file("does_not_exist.txt", &out_dir).unwrap_err();
    assert!(
        matches!(err, ArchiveError::FileNotFound(_)),
        "expected FileNotFound, got: {err:?}"
    );
}

// ── 10. Unsupported version ───────────────────────────────────────────────────

#[test]
fn verify_rejects_unsupported_version() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "version-test",
        &[fixture("hello.txt")],
        "VersionPass!",
        CompressionLevel::Fast,
    );

    // Overwrite the version field (bytes 6..8) with 0xFF 0x00 = version 255.
    // FixedHeader::from_bytes propagates UnsupportedVersion as a hard error (not VerifyResult).
    let mut bytes = fs::read(&archive).unwrap();
    bytes[6] = 0xFF;
    bytes[7] = 0x00;
    fs::write(&archive, &bytes).unwrap();

    let err = verify_archive(&archive).unwrap_err();
    assert!(
        matches!(err, ArchiveError::UnsupportedVersion(255, 1)),
        "expected UnsupportedVersion(255, 1), got: {err:?}"
    );
}

// ── 11. Large-ish file round-trip ────────────────────────────────────────────

#[test]
fn large_file_round_trip() {
    let tmp = TempDir::new().unwrap();

    // Create a 1 MiB file with mixed content
    let large_file = tmp.path().join("large.bin");
    let mut data = Vec::with_capacity(1024 * 1024);
    for i in 0u64..131072 {
        let bytes = (i.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407))
            .to_le_bytes();
        data.extend_from_slice(&bytes);
    }
    fs::write(&large_file, &data).unwrap();

    let archive = make_archive(
        &tmp,
        "large-rt",
        &[large_file.clone()],
        "LargeFilePass!99",
        CompressionLevel::Fast,
    );

    let reader = ArchiveReader::open(&archive, "LargeFilePass!99").unwrap();
    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();
    reader.extract_all(&out_dir).unwrap();

    let extracted = fs::read(out_dir.join("large.bin")).unwrap();
    assert_eq!(data, extracted, "1MiB file must be byte-identical after round-trip");
}

// ── 12. Archive metadata correctness ─────────────────────────────────────────

#[test]
fn archive_info_fields_are_correct() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "my-archive",
        &[fixture("hello.txt"), fixture("binary.bin")],
        "InfoPass!",
        CompressionLevel::Balanced,
    );
    let reader = ArchiveReader::open(&archive, "InfoPass!").unwrap();
    let info = reader.info();

    assert_eq!(info.archive_name, "my-archive");
    assert_eq!(info.file_count, 2);
    assert!(info.creator_version.starts_with("andrii/"));
    assert!(info.created_at > 0, "timestamp must be set");
    assert!(info.total_original_size > 0);
    assert_eq!(info.entries.len(), 2);
}

#[test]
fn file_entries_have_correct_sizes() {
    let tmp = TempDir::new().unwrap();
    let original_size = fs::metadata(fixture("hello.txt")).unwrap().len();

    let archive = make_archive(
        &tmp,
        "sizes",
        &[fixture("hello.txt")],
        "SizesPass!",
        CompressionLevel::Balanced,
    );
    let reader = ArchiveReader::open(&archive, "SizesPass!").unwrap();
    let entry = &reader.info().entries[0];

    assert_eq!(entry.original_size, original_size);
    assert_eq!(entry.path, "hello.txt");
}
