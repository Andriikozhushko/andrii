use std::io::{Read, Write};
use serde::{Deserialize, Serialize};

use crate::error::ArchiveError;
use super::entry::FileEntry;

/// Archive magic bytes.
pub const MAGIC: &[u8; 6] = b"ANDRII";

/// Current format version written by this build.
///
/// - v1: each file stored as one compressed+encrypted block (whole-file buffered).
/// - v2: each file stored as a sequence of independently-sealed 1 MiB chunks, so
///   writing/reading holds ~one chunk regardless of file size. The reader still
///   opens v1 archives.
pub const FORMAT_VERSION: u16 = 2;

/// v2 plaintext chunk size (1 MiB). Bounds peak memory during create/extract.
pub const CHUNK_SIZE: usize = 1 << 20;

/// Footer magic bytes.
pub const FOOTER_MAGIC: &[u8; 4] = b"ENDR";

/// Size of the fixed (unencrypted) header in bytes.
pub const FIXED_HEADER_SIZE: usize = 76;

/// Size of the footer in bytes.
pub const FOOTER_SIZE: usize = 548;

/// Archive flags.
pub mod flags {
    pub const HAS_SIGNATURE: u32 = 1 << 0;
    pub const COMPRESSED_HEADER: u32 = 1 << 1;
    pub const MULTI_RECIPIENT: u32 = 1 << 2;
}

/// The unencrypted fixed header at the start of every .andrii file.
///
/// Layout (76 bytes, all LE):
/// - [0..6]  magic: b"ANDRII"
/// - [6..8]  version: u16
/// - [8..12] flags: u32
/// - [12..44] kdf_salt: [u8; 32]
/// - [44..68] header_nonce: [u8; 24]
/// - [68..76] enc_header_len: u64
#[derive(Debug, Clone)]
pub struct FixedHeader {
    pub version: u16,
    pub flags: u32,
    pub kdf_salt: [u8; 32],
    pub header_nonce: [u8; 24],
    pub enc_header_len: u64,
}

impl FixedHeader {
    /// Serialize to bytes (76 bytes).
    pub fn to_bytes(&self) -> [u8; FIXED_HEADER_SIZE] {
        let mut buf = [0u8; FIXED_HEADER_SIZE];
        buf[0..6].copy_from_slice(MAGIC);
        buf[6..8].copy_from_slice(&self.version.to_le_bytes());
        buf[8..12].copy_from_slice(&self.flags.to_le_bytes());
        buf[12..44].copy_from_slice(&self.kdf_salt);
        buf[44..68].copy_from_slice(&self.header_nonce);
        buf[68..76].copy_from_slice(&self.enc_header_len.to_le_bytes());
        buf
    }

    /// Parse from bytes (76 bytes).
    pub fn from_bytes(buf: &[u8; FIXED_HEADER_SIZE]) -> Result<Self, ArchiveError> {
        if &buf[0..6] != MAGIC {
            return Err(ArchiveError::InvalidMagic);
        }
        let version = u16::from_le_bytes([buf[6], buf[7]]);
        if version > FORMAT_VERSION {
            return Err(ArchiveError::UnsupportedVersion(version, FORMAT_VERSION));
        }
        let flags = u32::from_le_bytes([buf[8], buf[9], buf[10], buf[11]]);
        let mut kdf_salt = [0u8; 32];
        kdf_salt.copy_from_slice(&buf[12..44]);
        let mut header_nonce = [0u8; 24];
        header_nonce.copy_from_slice(&buf[44..68]);
        let enc_header_len = u64::from_le_bytes(buf[68..76].try_into().unwrap());

        Ok(Self { version, flags, kdf_salt, header_nonce, enc_header_len })
    }

    /// Read from a reader.
    pub fn read_from<R: Read>(reader: &mut R) -> Result<Self, ArchiveError> {
        let mut buf = [0u8; FIXED_HEADER_SIZE];
        reader.read_exact(&mut buf)?;
        Self::from_bytes(&buf)
    }

    /// Write to a writer.
    pub fn write_to<W: Write>(&self, writer: &mut W) -> Result<(), ArchiveError> {
        writer.write_all(&self.to_bytes())?;
        Ok(())
    }
}

/// Argon2id parameters as stored in the encrypted header JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Argon2ParamsJson {
    pub m_cost: u32,
    pub t_cost: u32,
    pub p_cost: u32,
}

/// The decrypted archive header containing all metadata and the file table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedHeader {
    pub archive_name: String,
    pub created_at: u64,
    pub creator_version: String,
    pub compression: String,
    pub argon2_params: Argon2ParamsJson,
    #[serde(default)]
    pub extra: serde_json::Value,
    pub entries: Vec<FileEntry>,
}

impl EncryptedHeader {
    pub fn to_json(&self) -> Result<Vec<u8>, ArchiveError> {
        serde_json::to_vec(self).map_err(ArchiveError::from)
    }

    pub fn from_json(data: &[u8]) -> Result<Self, ArchiveError> {
        serde_json::from_slice(data).map_err(ArchiveError::from)
    }
}

/// The archive footer.
///
/// Layout (548 bytes):
/// - [0..4]   footer_magic: b"ENDR"
/// - [4..36]  archive_hash: [u8; 32]
/// - [36..548] signature_block: [u8; 512] (zeroed in v1)
#[derive(Debug, Clone)]
pub struct Footer {
    pub archive_hash: [u8; 32],
    pub signature_block: [u8; 512],
}

impl Footer {
    pub fn new(archive_hash: [u8; 32]) -> Self {
        Self {
            archive_hash,
            signature_block: [0u8; 512],
        }
    }

    pub fn to_bytes(&self) -> [u8; FOOTER_SIZE] {
        let mut buf = [0u8; FOOTER_SIZE];
        buf[0..4].copy_from_slice(FOOTER_MAGIC);
        buf[4..36].copy_from_slice(&self.archive_hash);
        buf[36..548].copy_from_slice(&self.signature_block);
        buf
    }

    pub fn from_bytes(buf: &[u8; FOOTER_SIZE]) -> Result<Self, ArchiveError> {
        if &buf[0..4] != FOOTER_MAGIC {
            return Err(ArchiveError::Corrupted("Invalid footer magic".to_string()));
        }
        let mut archive_hash = [0u8; 32];
        archive_hash.copy_from_slice(&buf[4..36]);
        let mut signature_block = [0u8; 512];
        signature_block.copy_from_slice(&buf[36..548]);
        Ok(Self { archive_hash, signature_block })
    }
}
