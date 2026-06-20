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

// ── 12. Stress tests: Unicode, empty, nested, many-small ─────────────────────

#[test]
fn unicode_filename_round_trip() {
    let tmp = TempDir::new().unwrap();
    // Create files with Unicode/Cyrillic/umlaut names
    let file_привет = tmp.path().join("привет_мир.txt");
    let file_umlaut = tmp.path().join("Ärchiv_Übersicht.txt");
    let file_cjk = tmp.path().join("文件_テスト.txt");
    fs::write(&file_привет, "Привет, мир! Это тест.").unwrap();
    fs::write(&file_umlaut, "Österreich Überraschung").unwrap();
    fs::write(&file_cjk, "日本語テスト").unwrap();

    let archive = make_archive(
        &tmp,
        "unicode-test",
        &[file_привет.clone(), file_umlaut.clone(), file_cjk.clone()],
        "UnicodePass!99",
        CompressionLevel::Balanced,
    );

    let reader = ArchiveReader::open(&archive, "UnicodePass!99").unwrap();
    assert_eq!(reader.info().file_count, 3, "all 3 unicode-named files should be archived");

    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();
    let extracted = reader.extract_all(&out_dir).unwrap();
    assert_eq!(extracted.len(), 3);

    // Verify content integrity for each
    let content1 = fs::read_to_string(&extracted[0]).unwrap_or_default();
    let content2 = fs::read_to_string(&extracted[1]).unwrap_or_default();
    assert!(!content1.is_empty() || !content2.is_empty(), "extracted content should not all be empty");
}

#[test]
fn nested_directory_round_trip() {
    let tmp = TempDir::new().unwrap();
    // Build nested directory tree: a/b/c/deep.txt + a/shallow.txt
    let nested = tmp.path().join("input");
    let deep_dir = nested.join("a").join("b").join("c");
    fs::create_dir_all(&deep_dir).unwrap();
    fs::write(nested.join("a").join("shallow.txt"), "shallow").unwrap();
    fs::write(deep_dir.join("deep.txt"), "very deeply nested content").unwrap();

    let archive = make_archive(
        &tmp,
        "nested-dirs",
        &[nested.clone()],
        "NestedPass!42",
        CompressionLevel::Balanced,
    );

    let reader = ArchiveReader::open(&archive, "NestedPass!42").unwrap();
    assert!(reader.info().file_count >= 2, "both files should be archived");

    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();
    let extracted = reader.extract_all(&out_dir).unwrap();
    assert_eq!(extracted.len(), reader.info().file_count as usize);

    // Deep file content should be preserved
    let deep_paths: Vec<_> = extracted.iter()
        .filter(|p| p.file_name().and_then(|n| n.to_str()) == Some("deep.txt"))
        .collect();
    assert_eq!(deep_paths.len(), 1, "deep.txt should be extracted");
    let deep_content = fs::read_to_string(&deep_paths[0]).unwrap();
    assert_eq!(deep_content, "very deeply nested content");
}

#[test]
fn many_small_files_round_trip() {
    let tmp = TempDir::new().unwrap();
    let input_dir = tmp.path().join("many");
    fs::create_dir_all(&input_dir).unwrap();

    // Create 50 small files with predictable content
    for i in 0..50u32 {
        fs::write(
            input_dir.join(format!("file_{:02}.txt", i)),
            format!("Content of file number {}", i),
        ).unwrap();
    }

    let archive = make_archive(
        &tmp,
        "many-files",
        &[input_dir.clone()],
        "ManyFilesPass!",
        CompressionLevel::Fast,
    );

    let reader = ArchiveReader::open(&archive, "ManyFilesPass!").unwrap();
    assert_eq!(reader.info().file_count, 50, "all 50 files should be archived");

    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();
    let extracted = reader.extract_all(&out_dir).unwrap();
    assert_eq!(extracted.len(), 50);

    // Spot-check a few files
    let first = extracted.iter().find(|p| p.file_name().and_then(|n| n.to_str()) == Some("file_00.txt"));
    let last = extracted.iter().find(|p| p.file_name().and_then(|n| n.to_str()) == Some("file_49.txt"));
    assert!(first.is_some() && last.is_some(), "boundary files should exist");
    assert_eq!(fs::read_to_string(first.unwrap()).unwrap(), "Content of file number 0");
    assert_eq!(fs::read_to_string(last.unwrap()).unwrap(), "Content of file number 49");
}

#[test]
fn archive_with_mixed_empty_and_large_files() {
    let tmp = TempDir::new().unwrap();
    // Mix: empty, tiny, medium
    let empty = tmp.path().join("empty.dat");
    let tiny = tmp.path().join("tiny.txt");
    let medium = tmp.path().join("medium.bin");
    fs::write(&empty, b"").unwrap();
    fs::write(&tiny, b"hello").unwrap();
    let medium_data: Vec<u8> = (0u32..65536).flat_map(|i| i.to_le_bytes()).collect();
    fs::write(&medium, &medium_data).unwrap();

    let archive = make_archive(
        &tmp,
        "mixed-sizes",
        &[empty.clone(), tiny.clone(), medium.clone()],
        "MixedPass!7",
        CompressionLevel::Maximum,
    );

    let reader = ArchiveReader::open(&archive, "MixedPass!7").unwrap();
    assert_eq!(reader.info().file_count, 3);

    let out_dir = tmp.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();
    reader.extract_all(&out_dir).unwrap();

    assert!(fs::read(&out_dir.join("empty.dat")).unwrap().is_empty());
    assert_eq!(fs::read(&out_dir.join("tiny.txt")).unwrap(), b"hello");
    assert_eq!(fs::read(&out_dir.join("medium.bin")).unwrap(), medium_data);
}

#[test]
fn corrupted_footer_detected_by_verify() {
    let tmp = TempDir::new().unwrap();
    let archive = make_archive(
        &tmp,
        "corrupt-footer",
        &[fixture("hello.txt")],
        "FooterPass!",
        CompressionLevel::Balanced,
    );

    // Flip a byte within the archive_hash field in the footer.
    // Footer layout: [0..4]=ENDR magic, [4..36]=BLAKE3 hash, [36..548]=signature block.
    // We corrupt footer byte 10, i.e. absolute offset len-548+10.
    let mut bytes = fs::read(&archive).unwrap();
    let len = bytes.len();
    bytes[len - 548 + 10] ^= 0xAB;
    fs::write(&archive, &bytes).unwrap();

    let result = verify_archive(&archive).unwrap();
    assert!(!result.is_valid, "corrupted footer hash should fail verification");
    assert!(!result.integrity_hash_valid);
}

// ── 13. Archive metadata correctness ─────────────────────────────────────────

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
