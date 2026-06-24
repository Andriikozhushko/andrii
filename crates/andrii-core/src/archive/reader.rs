use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use zeroize::Zeroizing;

use andrii_compress::decompress;
use andrii_crypto::{
    cipher::decrypt,
    hash::hash_bytes,
    kdf::{derive_key, KdfParams},
};

use crate::error::ArchiveError;
use crate::format::{
    entry::{FileEntry, FileEntrySummary},
    header::{EncryptedHeader, FixedHeader, CHUNK_SIZE, FIXED_HEADER_SIZE, GROUP_TARGET},
};

/// Information about an opened archive.
#[derive(Debug, Clone)]
pub struct ArchiveInfo {
    pub archive_name: String,
    pub created_at: u64,
    pub creator_version: String,
    pub compression: String,
    pub file_count: usize,
    pub total_original_size: u64,
    pub total_compressed_size: u64,
    pub format_version: u16,
    pub entries: Vec<FileEntrySummary>,
}

/// Reads and decrypts a `.andrii` archive.
pub struct ArchiveReader {
    path: PathBuf,
    #[allow(dead_code)]
    fixed_header: FixedHeader,
    encrypted_header: EncryptedHeader,
    master_key: Zeroizing<[u8; 32]>,
    data_section_start: u64,
}

impl ArchiveReader {
    /// Open an archive and decrypt its header using the provided password.
    ///
    /// Returns `ArchiveError::InvalidPassword` on wrong password or header corruption.
    pub fn open(archive_path: &Path, password: &str) -> Result<Self, ArchiveError> {
        let mut file = BufReader::new(File::open(archive_path)?);

        // Read fixed header
        let fixed_header = FixedHeader::read_from(&mut file)?;
        let fixed_header_bytes = fixed_header.to_bytes();

        // Derive master key from password + salt
        // Use default Argon2id parameters for key derivation.
        // The actual parameters used at creation time are stored in the encrypted header
        // (for auditing/re-keying), but key derivation always uses defaults on open.
        let kdf_params = KdfParams::default();
        let master_key = derive_key(password, &fixed_header.kdf_salt, &kdf_params)
            .map_err(|_| ArchiveError::InvalidPassword)?;

        // Read encrypted header block
        let enc_header_len = fixed_header.enc_header_len as usize;
        let mut encrypted_header_bytes = vec![0u8; enc_header_len];
        file.read_exact(&mut encrypted_header_bytes)?;

        // Decrypt header (AAD = fixed header bytes)
        let header_plaintext = Zeroizing::new(
            decrypt(
                &master_key,
                &fixed_header.header_nonce,
                &encrypted_header_bytes,
                &fixed_header_bytes,
            )
            .map_err(|_| ArchiveError::InvalidPassword)?,
        );

        // Parse JSON header
        let encrypted_header = EncryptedHeader::from_json(&header_plaintext)?;

        let data_section_start = (FIXED_HEADER_SIZE + enc_header_len) as u64;

        Ok(Self {
            path: archive_path.to_path_buf(),
            fixed_header,
            encrypted_header,
            master_key,
            data_section_start,
        })
    }

    /// Return archive metadata for display.
    pub fn info(&self) -> ArchiveInfo {
        let entries = self.encrypted_header.entries.clone();
        let total_original_size = entries.iter().map(|e| e.original_size).sum();
        // Prefer the recorded compressed payload (v2 per-file, v3 grouped share);
        // v1 only has the on-disk region size, so approximate by removing one tag.
        let total_compressed_size: u64 = entries
            .iter()
            .map(|e| {
                if e.compressed_size > 0 {
                    e.compressed_size
                } else {
                    e.compressed_encrypted_size.saturating_sub(16)
                }
            })
            .sum();

        ArchiveInfo {
            archive_name: self.encrypted_header.archive_name.clone(),
            created_at: self.encrypted_header.created_at,
            creator_version: self.encrypted_header.creator_version.clone(),
            compression: self.encrypted_header.compression.clone(),
            file_count: entries.len(),
            total_original_size,
            total_compressed_size,
            format_version: self.fixed_header.version,
            entries: entries.iter().map(FileEntrySummary::from).collect(),
        }
    }

    /// Extract a single file by its archive path to the given output directory.
    pub fn extract_file(
        &self,
        archive_path: &str,
        output_dir: &Path,
    ) -> Result<PathBuf, ArchiveError> {
        let entry = self
            .encrypted_header
            .entries
            .iter()
            .find(|e| e.path == archive_path)
            .ok_or_else(|| ArchiveError::FileNotFound(archive_path.to_string()))?;

        self.extract_entry(entry, output_dir)
    }

    /// Extract all files to the given output directory.
    ///
    /// For v3 archives, each solid group is inflated **once** and all its member
    /// files are sliced out of the single decompressed buffer — more efficient
    /// than re-inflating per file. Per-file (ungrouped) entries use the v1/v2 path.
    pub fn extract_all(&self, output_dir: &Path) -> Result<Vec<PathBuf>, ArchiveError> {
        let entries = self.encrypted_header.entries.clone();
        let mut extracted = Vec::with_capacity(entries.len());

        if self.fixed_header.version >= 3 && !self.encrypted_header.groups.is_empty() {
            // Inflate each group once, slice out every member, then handle the
            // remaining ungrouped (per-file) entries normally.
            use std::collections::BTreeMap;
            let mut by_group: BTreeMap<u32, Vec<&FileEntry>> = BTreeMap::new();
            for e in &entries {
                if let Some(g) = e.group_id {
                    by_group.entry(g).or_default().push(e);
                }
            }
            for (gid, members) in by_group {
                let plain = self.inflate_group(gid)?;
                for entry in members {
                    let path = self.write_group_member(entry, &plain, output_dir)?;
                    extracted.push(path);
                }
            }
            for entry in &entries {
                if entry.group_id.is_none() {
                    extracted.push(self.extract_entry(entry, output_dir)?);
                }
            }
        } else {
            for entry in &entries {
                extracted.push(self.extract_entry(entry, output_dir)?);
            }
        }
        Ok(extracted)
    }

    fn extract_entry(&self, entry: &FileEntry, output_dir: &Path) -> Result<PathBuf, ArchiveError> {
        if let Some(gid) = entry.group_id {
            // v3 grouped file: inflate its group, slice, verify, write.
            let plain = self.inflate_group(gid)?;
            self.write_group_member(entry, &plain, output_dir)
        } else if self.fixed_header.version >= 2 {
            self.extract_entry_v2(entry, output_dir)
        } else {
            self.extract_entry_v1(entry, output_dir)
        }
    }

    /// v3: decrypt and inflate one solid group's chunks into its full
    /// decompressed plaintext (bounded by the group's `uncompressed_size`, which
    /// the writer caps at `GROUP_TARGET`). Fail-closed: any chunk that fails AEAD
    /// authentication, or a decompression failure, aborts before any file is
    /// written. The chunk AAD (`chunk_index ‖ last_flag`) authenticates ordering
    /// and truncation, exactly as for a v2 file region.
    fn inflate_group(&self, group_id: u32) -> Result<Zeroizing<Vec<u8>>, ArchiveError> {
        let group = self
            .encrypted_header
            .groups
            .iter()
            .find(|g| g.group_id == group_id)
            .ok_or_else(|| ArchiveError::Corrupted(format!("Missing group {group_id}")))?;

        let base16 = group
            .decode_base_nonce()
            .map_err(|e| ArchiveError::Format(format!("Invalid group {group_id} nonce: {e}")))?;
        let abs_offset = self.data_section_start + group.data_offset;

        let mut reader = BufReader::new(File::open(&self.path)?);
        reader.seek(SeekFrom::Start(abs_offset))?;

        // Reassemble the compressed (or raw) stream from its sealed chunks.
        let mut stream: Zeroizing<Vec<u8>> = Zeroizing::new(Vec::with_capacity(
            group.compressed_size.min(GROUP_TARGET) as usize,
        ));
        for i in 0..group.chunk_count {
            let mut len_buf = [0u8; 4];
            reader.read_exact(&mut len_buf)?;
            let sealed_len = u32::from_le_bytes(len_buf) as usize;
            let mut sealed = vec![0u8; sealed_len];
            reader.read_exact(&mut sealed)?;

            let mut nonce = [0u8; 24];
            nonce[..16].copy_from_slice(&base16);
            nonce[16..24].copy_from_slice(&i.to_be_bytes());
            let mut aad = [0u8; 9];
            aad[..8].copy_from_slice(&i.to_be_bytes());
            aad[8] = (i + 1 == group.chunk_count) as u8;

            let payload = decrypt(&self.master_key, &nonce, &sealed, &aad).map_err(|_| {
                ArchiveError::Corrupted(format!("Group {group_id} authentication failed"))
            })?;
            stream.extend_from_slice(&payload);
        }

        let plain: Zeroizing<Vec<u8>> = if group.stored_raw {
            stream
        } else {
            Zeroizing::new(decompress(&stream, Some(group.uncompressed_size as usize))?)
        };

        // Length sanity: the inflated group must match its recorded plaintext size
        // so member offset/length slicing is always in-bounds (fail-closed).
        if plain.len() as u64 != group.uncompressed_size {
            return Err(ArchiveError::Corrupted(format!(
                "Group {group_id} size mismatch: got {}, expected {}",
                plain.len(),
                group.uncompressed_size
            )));
        }
        Ok(plain)
    }

    /// v3: slice one member file out of its already-inflated group plaintext,
    /// verify its per-file BLAKE3 (fail-closed), and atomically write it.
    fn write_group_member(
        &self,
        entry: &FileEntry,
        group_plain: &[u8],
        output_dir: &Path,
    ) -> Result<PathBuf, ArchiveError> {
        let start = entry.group_offset as usize;
        let end = start
            .checked_add(entry.original_size as usize)
            .filter(|&e| e <= group_plain.len())
            .ok_or_else(|| {
                ArchiveError::Corrupted(format!("File {} out of group bounds", entry.path))
            })?;
        let content = &group_plain[start..end];

        let expected_hash = entry.decode_hash()?;
        // Fail-closed: never write content that doesn't match its per-file hash.
        if hash_bytes(content) != expected_hash {
            return Err(ArchiveError::IntegrityFailed(entry.path.clone()));
        }

        let out_path = output_dir.join(&entry.path);
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let tmp_path = out_path.with_extension(format!("andrii-x-{}.tmp", std::process::id()));
        if let Err(e) = fs::write(&tmp_path, content) {
            let _ = fs::remove_file(&tmp_path);
            return Err(ArchiveError::Io(e));
        }
        fs::rename(&tmp_path, &out_path).map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            ArchiveError::Io(e)
        })?;
        restore_mode(&out_path, entry.unix_mode);
        Ok(out_path)
    }

    /// v1: a single compressed+encrypted block per file (whole file buffered).
    fn extract_entry_v1(&self, entry: &FileEntry, output_dir: &Path) -> Result<PathBuf, ArchiveError> {
        let abs_offset = self.data_section_start + entry.data_offset;

        let mut file = File::open(&self.path)?;
        file.seek(SeekFrom::Start(abs_offset))?;
        let mut encrypted_block = vec![0u8; entry.compressed_encrypted_size as usize];
        file.read_exact(&mut encrypted_block)?;

        let nonce = entry
            .decode_nonce()
            .map_err(|e| ArchiveError::Format(format!("Invalid nonce for {}: {}", entry.path, e)))?;
        let expected_hash = entry.decode_hash()?;

        // Decrypt: AAD = blake3 hash (binds block to its metadata entry).
        let compressed = Zeroizing::new(
            decrypt(&self.master_key, &nonce, &encrypted_block, &expected_hash)
                .map_err(|_| ArchiveError::Corrupted(format!("Content authentication failed for: {}", entry.path)))?,
        );

        let content = Zeroizing::new(decompress(&compressed, Some(entry.original_size as usize))?);

        // Fail-closed: never write content that doesn't match its hash.
        if hash_bytes(&content) != expected_hash {
            return Err(ArchiveError::IntegrityFailed(entry.path.clone()));
        }

        let out_path = output_dir.join(&entry.path);
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&out_path, content.as_slice())?;
        restore_mode(&out_path, entry.unix_mode);
        Ok(out_path)
    }

    /// v2: a sequence of independently-sealed chunks. Streams chunk→decrypt→
    /// decompress→write to a temp file, verifies the full-file BLAKE3, then
    /// atomically renames — so corrupt content is never committed and peak
    /// memory stays at ~one chunk.
    fn extract_entry_v2(&self, entry: &FileEntry, output_dir: &Path) -> Result<PathBuf, ArchiveError> {
        let abs_offset = self.data_section_start + entry.data_offset;
        let base16 = entry
            .decode_base_nonce()
            .map_err(|e| ArchiveError::Format(format!("Invalid nonce for {}: {}", entry.path, e)))?;
        let expected_hash = entry.decode_hash()?;

        let out_path = output_dir.join(&entry.path);
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let tmp_path = out_path.with_extension(format!(
            "andrii-x-{}.tmp",
            std::process::id()
        ));

        let result = (|| -> Result<(), ArchiveError> {
            let mut reader = BufReader::new(File::open(&self.path)?);
            reader.seek(SeekFrom::Start(abs_offset))?;
            let mut writer = BufWriter::new(File::create(&tmp_path)?);
            let mut hasher = blake3::Hasher::new();

            for i in 0..entry.chunk_count {
                let mut len_buf = [0u8; 4];
                reader.read_exact(&mut len_buf)?;
                let sealed_len = u32::from_le_bytes(len_buf) as usize;
                let mut sealed = vec![0u8; sealed_len];
                reader.read_exact(&mut sealed)?;

                let mut nonce = [0u8; 24];
                nonce[..16].copy_from_slice(&base16);
                nonce[16..24].copy_from_slice(&i.to_be_bytes());
                let mut aad = [0u8; 9];
                aad[..8].copy_from_slice(&i.to_be_bytes());
                aad[8] = (i + 1 == entry.chunk_count) as u8;

                let payload = decrypt(&self.master_key, &nonce, &sealed, &aad)
                    .map_err(|_| ArchiveError::Corrupted(format!("Content authentication failed for: {}", entry.path)))?;

                let plain: Zeroizing<Vec<u8>> = if entry.stored_raw {
                    payload
                } else {
                    Zeroizing::new(decompress(&payload, Some(CHUNK_SIZE))?)
                };
                hasher.update(&plain);
                writer.write_all(&plain)?;
            }
            writer.flush()?;

            // Fail-closed: never commit content that doesn't match its hash.
            if hasher.finalize().as_bytes() != &expected_hash {
                return Err(ArchiveError::IntegrityFailed(entry.path.clone()));
            }
            Ok(())
        })();

        if let Err(e) = result {
            let _ = fs::remove_file(&tmp_path);
            return Err(e);
        }
        fs::rename(&tmp_path, &out_path).map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            ArchiveError::Io(e)
        })?;
        restore_mode(&out_path, entry.unix_mode);
        Ok(out_path)
    }
}

/// Restore unix permission bits when present (no-op on Windows / mode 0).
fn restore_mode(_path: &Path, _unix_mode: u32) {
    #[cfg(unix)]
    if _unix_mode != 0 {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(_unix_mode);
        let _ = fs::set_permissions(_path, perms);
    }
}
