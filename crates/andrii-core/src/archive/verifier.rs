use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

use serde::Serialize;

use crate::error::ArchiveError;
use crate::format::header::{FixedHeader, Footer, FIXED_HEADER_SIZE, FOOTER_SIZE};

/// Result of archive verification.
#[derive(Debug, Clone, Serialize)]
pub struct VerifyResult {
    pub is_valid: bool,
    pub has_valid_magic: bool,
    pub format_version: u16,
    pub version_supported: bool,
    pub integrity_hash_valid: bool,
    pub file_size: u64,
    pub error: Option<String>,
}

/// Verify archive integrity without decrypting content.
///
/// This checks:
/// 1. Valid magic bytes
/// 2. Supported format version
/// 3. Footer BLAKE3 hash matches all content
///
/// Password is not required for basic integrity verification.
pub fn verify_archive(archive_path: &Path) -> Result<VerifyResult, ArchiveError> {
    let mut file = BufReader::new(File::open(archive_path)?);

    let file_size = {
        let meta = std::fs::metadata(archive_path)?;
        meta.len()
    };

    // Minimum valid archive size: fixed header + empty encrypted header + footer
    if file_size < (FIXED_HEADER_SIZE + FOOTER_SIZE) as u64 {
        return Ok(VerifyResult {
            is_valid: false,
            has_valid_magic: false,
            format_version: 0,
            version_supported: false,
            integrity_hash_valid: false,
            file_size,
            error: Some("File too small to be a valid ANDRII archive".to_string()),
        });
    }

    // Read fixed header
    let fixed_header = match FixedHeader::read_from(&mut file) {
        Ok(h) => h,
        Err(ArchiveError::InvalidMagic) => {
            return Ok(VerifyResult {
                is_valid: false,
                has_valid_magic: false,
                format_version: 0,
                version_supported: false,
                integrity_hash_valid: false,
                file_size,
                error: Some("Not a valid ANDRII archive (invalid magic bytes)".to_string()),
            });
        }
        Err(e) => return Err(e),
    };

    let version_supported = matches!(fixed_header.version, 1);

    if !version_supported {
        return Ok(VerifyResult {
            is_valid: false,
            has_valid_magic: true,
            format_version: fixed_header.version,
            version_supported: false,
            integrity_hash_valid: false,
            file_size,
            error: Some(format!(
                "Archive version {} is not supported (max supported: 1)",
                fixed_header.version
            )),
        });
    }

    // Stream all bytes before the footer through BLAKE3 (bounded memory), then
    // compare with the footer hash. Any read/parse error => not valid, never a
    // crash: a corrupted archive deterministically reports as compromised.
    let integrity = (|| -> Result<bool, ArchiveError> {
        let content_len = file_size - FOOTER_SIZE as u64;
        file.seek(SeekFrom::Start(0))?;

        let mut hasher = blake3::Hasher::new();
        let mut remaining = content_len;
        let mut buf = [0u8; 1 << 16];
        while remaining > 0 {
            let to_read = remaining.min(buf.len() as u64) as usize;
            file.read_exact(&mut buf[..to_read])?;
            hasher.update(&buf[..to_read]);
            remaining -= to_read as u64;
        }
        let actual_hash = *hasher.finalize().as_bytes();

        let mut footer_bytes = [0u8; FOOTER_SIZE];
        file.read_exact(&mut footer_bytes)?;
        let footer = Footer::from_bytes(&footer_bytes)?;

        Ok(actual_hash == footer.archive_hash)
    })();

    let integrity_hash_valid = integrity.unwrap_or(false);

    Ok(VerifyResult {
        is_valid: integrity_hash_valid,
        has_valid_magic: true,
        format_version: fixed_header.version,
        version_supported: true,
        integrity_hash_valid,
        file_size,
        error: if integrity_hash_valid {
            None
        } else {
            Some("Archive integrity check failed: content may be corrupted or tampered".to_string())
        },
    })
}
