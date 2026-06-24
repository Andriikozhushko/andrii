//! Integration tests for the v3 solid-group format (Maximum mode only).
//!
//! These verify that Maximum mode produces v3 grouped archives, that grouping
//! preserves every v2 guarantee (round-trip, per-file integrity, fail-closed
//! tamper detection, selected extraction), that Fast/Balanced keep writing v2,
//! and that v3 actually improves compression on many-small-file workloads.

use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

use andrii_compress::CompressionLevel;
use andrii_core::{
    ArchiveError, ArchiveReader, ArchiveWriter, CreateArchiveOptions, verify_archive,
};

// ── Helpers ────────────────────────────────────────────────────────────────

fn make_opts(
    name: &str,
    out: &Path,
    password: &str,
    compression: CompressionLevel,
    force_legacy_v2: bool,
) -> CreateArchiveOptions {
    CreateArchiveOptions {
        archive_name: name.to_string(),
        password: password.to_string(),
        compression,
        output_path: out.to_path_buf(),
        progress_callback: None,
        force_legacy_v2,
    }
}

fn create(
    tmp: &TempDir,
    name: &str,
    inputs: &[PathBuf],
    password: &str,
    compression: CompressionLevel,
    force_legacy_v2: bool,
) -> PathBuf {
    let out = tmp.path().join(format!("{name}.andrii"));
    let opts = make_opts(name, &out, password, compression, force_legacy_v2);
    ArchiveWriter::new(opts).create(inputs).expect("create failed");
    out
}

/// Build a directory of `count` small, highly-compressible text files that
/// share a lot of boilerplate — the exact workload solid grouping targets.
fn many_small_text_files(dir: &Path, count: usize) -> Vec<PathBuf> {
    fs::create_dir_all(dir).unwrap();
    let mut out = Vec::new();
    for i in 0..count {
        // Shared boilerplate (re-learned per file in v2; deduped in a solid group).
        let body = format!(
            "// module {i}\nimport {{ helper }} from \"../common/helper\";\n\
             export const config = {{ id: {i}, name: \"item-{i}\", \
             enabled: true, retries: 3, timeout: 30000 }};\n\
             export function run() {{ return helper(config); }}\n",
        );
        let p = dir.join(format!("mod-{i:04}.ts"));
        fs::write(&p, body).unwrap();
        out.push(p);
    }
    out
}

fn read_all(dir: &Path, files: &[PathBuf]) -> Vec<(String, Vec<u8>)> {
    files
        .iter()
        .map(|p| {
            let rel = p.file_name().unwrap().to_string_lossy().to_string();
            let bytes = fs::read(dir.join(&rel)).unwrap();
            (rel, bytes)
        })
        .collect()
}

// ── 1. Maximum writes v3; Fast/Balanced write v2 ─────────────────────────────

#[test]
fn maximum_many_small_files_writes_v3() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 60);
    let archive = create(&tmp, "v3", &files, "Pass!v3#1", CompressionLevel::Maximum, false);

    let info = ArchiveReader::open(&archive, "Pass!v3#1").unwrap().info();
    assert_eq!(info.format_version, 3, "Maximum + many small files must be v3");
    assert_eq!(info.file_count, 60);
}

#[test]
fn fast_and_balanced_write_v2() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 40);
    for mode in [CompressionLevel::Fast, CompressionLevel::Balanced] {
        let archive = create(&tmp, "v2", &files, "Pass!v2#1", mode, false);
        let info = ArchiveReader::open(&archive, "Pass!v2#1").unwrap().info();
        assert_eq!(info.format_version, 2, "{mode:?} must keep writing v2");
    }
}

#[test]
fn maximum_with_force_legacy_v2_writes_v2() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 40);
    let archive = create(&tmp, "forced", &files, "Pass!f#1", CompressionLevel::Maximum, true);
    let info = ArchiveReader::open(&archive, "Pass!f#1").unwrap().info();
    assert_eq!(info.format_version, 2, "force_legacy_v2 must override v3");
}

#[test]
fn maximum_all_incompressible_falls_back_to_v2() {
    // No groupable files → v3 grouping can't help → fall back to v2.
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path().join("media");
    fs::create_dir_all(&dir).unwrap();
    let mut x: u64 = 0xDEAD_BEEF;
    let mut files = Vec::new();
    for i in 0..4 {
        let mut buf = vec![0u8; 256 * 1024];
        for b in buf.iter_mut() {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            *b = (x >> 24) as u8;
        }
        let p = dir.join(format!("clip-{i}.jpg"));
        fs::write(&p, &buf).unwrap();
        files.push(p);
    }
    let archive = create(&tmp, "media", &files, "Pass!m#1", CompressionLevel::Maximum, false);
    let info = ArchiveReader::open(&archive, "Pass!m#1").unwrap().info();
    assert_eq!(info.format_version, 2, "all-media Maximum must fall back to v2");
}

// ── 2. Round-trip: extract all ───────────────────────────────────────────────

#[test]
fn v3_extract_all_round_trip() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 75);
    let originals = files
        .iter()
        .map(|p| (p.file_name().unwrap().to_string_lossy().to_string(), fs::read(p).unwrap()))
        .collect::<Vec<_>>();

    let archive = create(&tmp, "rt", &files, "Pass!rt#1", CompressionLevel::Maximum, false);
    assert!(verify_archive(&archive).unwrap().is_valid);

    let reader = ArchiveReader::open(&archive, "Pass!rt#1").unwrap();
    assert_eq!(reader.info().format_version, 3);
    let out = tmp.path().join("out");
    fs::create_dir_all(&out).unwrap();
    let extracted = reader.extract_all(&out).unwrap();
    assert_eq!(extracted.len(), 75);

    for (name, orig) in &originals {
        let got = fs::read(out.join(name)).unwrap();
        assert_eq!(&got, orig, "round-trip mismatch for {name}");
    }
}

#[test]
fn v3_round_trip_with_mixed_compressible_and_media() {
    // A v3 archive containing BOTH a solid group and per-file (raw) regions.
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path().join("mixed");
    let mut files = many_small_text_files(&dir, 30);
    // Add an incompressible file → it becomes a per-file region in the v3 archive.
    let mut x: u64 = 0x1234_5678;
    let mut blob = vec![0u8; 300 * 1024];
    for b in blob.iter_mut() {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        *b = (x >> 24) as u8;
    }
    let media = dir.join("photo.jpg");
    fs::write(&media, &blob).unwrap();
    files.push(media.clone());

    let archive = create(&tmp, "mix", &files, "Pass!mx#1", CompressionLevel::Maximum, false);
    let reader = ArchiveReader::open(&archive, "Pass!mx#1").unwrap();
    assert_eq!(reader.info().format_version, 3);
    let out = tmp.path().join("out");
    fs::create_dir_all(&out).unwrap();
    reader.extract_all(&out).unwrap();

    // The media file (per-file region) and a grouped file both round-trip.
    assert_eq!(fs::read(out.join("photo.jpg")).unwrap(), blob);
    assert_eq!(fs::read(out.join("mod-0000.ts")).unwrap(), fs::read(&files[0]).unwrap());
}

// ── 3. Selected extraction (only the file's group is inflated) ───────────────

#[test]
fn v3_extract_selected_file_only() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 50);
    let archive = create(&tmp, "sel", &files, "Pass!sel#1", CompressionLevel::Maximum, false);

    let reader = ArchiveReader::open(&archive, "Pass!sel#1").unwrap();
    assert_eq!(reader.info().format_version, 3);
    let out = tmp.path().join("out");
    fs::create_dir_all(&out).unwrap();

    let path = reader.extract_file("mod-0007.ts", &out).unwrap();
    assert!(path.exists());
    assert_eq!(fs::read(&path).unwrap(), fs::read(&files[7]).unwrap());
    // No other member of the group should have been written.
    assert!(!out.join("mod-0008.ts").exists());
    assert!(!out.join("mod-0000.ts").exists());
}

// ── 4. Wrong password ────────────────────────────────────────────────────────

#[test]
fn v3_wrong_password_fails() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 20);
    let archive = create(&tmp, "wp", &files, "RightPass!#1", CompressionLevel::Maximum, false);

    let err = ArchiveReader::open(&archive, "WrongPass!").err().unwrap();
    assert!(matches!(err, ArchiveError::InvalidPassword), "got {err:?}");
}

// ── 5. Tamper detection (fail-closed) ────────────────────────────────────────

#[test]
fn v3_verify_detects_tampered_group() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 30);
    let archive = create(&tmp, "tv", &files, "Pass!tv#1", CompressionLevel::Maximum, false);

    let mut bytes = fs::read(&archive).unwrap();
    let mid = bytes.len() / 2;
    bytes[mid] ^= 0xFF;
    fs::write(&archive, &bytes).unwrap();

    let result = verify_archive(&archive).unwrap();
    assert!(!result.is_valid, "tampered v3 archive must fail integrity");
}

#[test]
fn v3_extract_tampered_group_fails_closed() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 30);
    let archive = create(&tmp, "tx", &files, "Pass!tx#1", CompressionLevel::Maximum, false);

    // Corrupt a byte inside the data section (after the header, before the footer).
    let mut bytes = fs::read(&archive).unwrap();
    let pos = bytes.len() - 548 - 20;
    bytes[pos] ^= 0xFF;
    fs::write(&archive, &bytes).unwrap();

    if let Ok(reader) = ArchiveReader::open(&archive, "Pass!tx#1") {
        let out = tmp.path().join("out");
        fs::create_dir_all(&out).unwrap();
        let err = reader.extract_all(&out).unwrap_err();
        assert!(
            matches!(err, ArchiveError::Corrupted(_) | ArchiveError::IntegrityFailed(_)),
            "tampered group must fail closed, got {err:?}"
        );
        // Fail-closed: no member file from the corrupted group was committed.
        assert!(!out.join("mod-0000.ts").exists(), "no file may be written on failure");
    }
}

// ── 6. Per-file integrity is enforced after inflating the group ──────────────

#[test]
fn v3_per_file_integrity_holds_for_all_members() {
    // Every extracted member is re-hashed against its stored BLAKE3; an honest
    // archive passes for all of them. (Mismatch is unreachable without forging a
    // valid AEAD tag — the chunk AEAD authenticates content before this check.)
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 40);
    let archive = create(&tmp, "pf", &files, "Pass!pf#1", CompressionLevel::Maximum, false);

    let reader = ArchiveReader::open(&archive, "Pass!pf#1").unwrap();
    let out = tmp.path().join("out");
    fs::create_dir_all(&out).unwrap();
    let extracted = reader.extract_all(&out).unwrap();
    assert_eq!(extracted.len(), 40);
    // Spot-check byte-identity across the whole group.
    for (name, content) in read_all(&out, &files) {
        let orig = fs::read(tmp.path().join("src").join(&name)).unwrap();
        assert_eq!(content, orig, "integrity/byte mismatch for {name}");
    }
}

// ── 7. v3 improves compression over v2 Maximum on many small files ───────────

#[test]
fn v3_beats_v2_maximum_on_many_small_files() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 300);

    let v3 = create(&tmp, "max-v3", &files, "Pass!cmp#1", CompressionLevel::Maximum, false);
    let v2 = create(&tmp, "max-v2", &files, "Pass!cmp#1", CompressionLevel::Maximum, true);

    let v3_size = fs::metadata(&v3).unwrap().len();
    let v2_size = fs::metadata(&v2).unwrap().len();

    assert_eq!(ArchiveReader::open(&v3, "Pass!cmp#1").unwrap().info().format_version, 3);
    assert_eq!(ArchiveReader::open(&v2, "Pass!cmp#1").unwrap().info().format_version, 2);
    assert!(
        v3_size < v2_size,
        "v3 solid ({v3_size} B) must be smaller than v2 Maximum ({v2_size} B)"
    );
    // The win on this boilerplate-heavy workload should be substantial.
    let saved = 1.0 - v3_size as f64 / v2_size as f64;
    assert!(saved > 0.20, "expected >20% improvement, got {:.1}%", saved * 100.0);
}

// ── 8. Backward compatibility: a v2 archive still opens under the v3 build ────

#[test]
fn v2_archive_still_reads_under_v3_build() {
    let tmp = TempDir::new().unwrap();
    let files = many_small_text_files(&tmp.path().join("src"), 25);
    // Balanced → v2 layout, written and read by the same (v3-capable) build.
    let archive = create(&tmp, "compat", &files, "Pass!c#1", CompressionLevel::Balanced, false);

    let reader = ArchiveReader::open(&archive, "Pass!c#1").unwrap();
    assert_eq!(reader.info().format_version, 2);
    let out = tmp.path().join("out");
    fs::create_dir_all(&out).unwrap();
    let extracted = reader.extract_all(&out).unwrap();
    assert_eq!(extracted.len(), 25);
    for p in &files {
        let name = p.file_name().unwrap();
        assert_eq!(fs::read(out.join(name)).unwrap(), fs::read(p).unwrap());
    }
}
