use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;

use andrii_compress::CompressionLevel;
use andrii_core::{
    ArchiveReader, ArchiveWriter, CreateArchiveOptions, Phase, Progress, VerifyResult,
    verify_archive,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::error::{CommandResult, to_command_error};

#[derive(Debug, Deserialize)]
pub struct CreateArchiveRequest {
    pub file_paths: Vec<String>,
    pub output_path: String,
    pub archive_name: String,
    pub password: String,
    pub compression: String,
}

#[derive(Debug, Serialize)]
pub struct CreateArchiveResponse {
    pub output_path: String,
    pub file_count: usize,
    pub total_original_size: u64,
    pub total_compressed_size: u64,
    pub compression_ratio: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProgressEvent {
    /// "scanning" | "compressing" | "writing" | "finalizing".
    pub phase: String,
    pub files_done: u64,
    pub files_total: u64,
    pub bytes_done: u64,
    pub bytes_total: u64,
    /// 0..100, derived from bytes (falls back to files when sizes are unknown).
    pub percent: f64,
    pub current_file: String,
}

impl ProgressEvent {
    fn from_progress(p: &Progress) -> Self {
        let percent = if p.bytes_total > 0 {
            (p.bytes_done as f64 / p.bytes_total as f64) * 100.0
        } else if p.files_total > 0 {
            (p.files_done as f64 / p.files_total as f64) * 100.0
        } else {
            0.0
        }
        .clamp(0.0, 100.0);
        ProgressEvent {
            phase: p.phase.as_str().to_string(),
            files_done: p.files_done,
            files_total: p.files_total,
            bytes_done: p.bytes_done,
            bytes_total: p.bytes_total,
            percent,
            current_file: p.current_file.to_string(),
        }
    }
}

/// Create a new .andrii archive.
#[tauri::command]
pub async fn create_archive(
    app: AppHandle,
    request: CreateArchiveRequest,
) -> CommandResult<CreateArchiveResponse> {
    let compression = match request.compression.as_str() {
        "Fast" => CompressionLevel::Fast,
        "Maximum" => CompressionLevel::Maximum,
        _ => CompressionLevel::Balanced,
    };

    let input_paths: Vec<PathBuf> = request.file_paths.iter().map(PathBuf::from).collect();
    let output_path = PathBuf::from(&request.output_path);

    // Validate inputs
    if request.password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }
    if input_paths.is_empty() {
        return Err("No files selected".to_string());
    }

    let app_clone = app.clone();
    let result = tokio::task::spawn_blocking(move || {
        // Throttle UI updates to ~30/s, but always emit on a phase change so the
        // label flips promptly. A 1 GB file's ~1000 chunks won't flood the channel.
        let last: Mutex<(Instant, &'static str)> = Mutex::new((Instant::now(), ""));
        let opts = CreateArchiveOptions {
            archive_name: request.archive_name,
            password: request.password,
            compression,
            output_path: output_path.clone(),
            progress_callback: Some(Box::new(move |p: &Progress| {
                let phase = p.phase.as_str();
                let emit = {
                    let mut g = last.lock().unwrap();
                    let changed = g.1 != phase;
                    if changed || g.0.elapsed().as_millis() >= 33 {
                        *g = (Instant::now(), phase);
                        true
                    } else {
                        false
                    }
                };
                // Always surface the terminal Finalizing tick.
                if emit || p.phase == Phase::Finalizing {
                    let _ = app_clone.emit("archive-progress", ProgressEvent::from_progress(p));
                }
            })),
            force_legacy_v2: false,
        };

        let writer = ArchiveWriter::new(opts);
        writer.create(&input_paths)
    })
    .await
    .map_err(|e| to_command_error(format!("Task error: {}", e)))?
    .map_err(to_command_error)?;

    Ok(CreateArchiveResponse {
        output_path: result.output_path.to_string_lossy().to_string(),
        file_count: result.file_count,
        total_original_size: result.total_original_size,
        total_compressed_size: result.total_compressed_size,
        compression_ratio: result.compression_ratio,
    })
}

#[derive(Debug, Deserialize)]
pub struct OpenArchiveRequest {
    pub archive_path: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct ArchiveFileEntry {
    pub path: String,
    pub original_size: u64,
    pub compressed_size: u64,
    pub modified_at: u64,
    pub compression_ratio: f64,
}

#[derive(Debug, Serialize)]
pub struct OpenArchiveResponse {
    pub archive_name: String,
    pub created_at: u64,
    pub creator_version: String,
    pub compression: String,
    pub file_count: usize,
    pub total_original_size: u64,
    pub total_compressed_size: u64,
    pub format_version: u16,
    pub entries: Vec<ArchiveFileEntry>,
}

/// Open and decrypt the header of a .andrii archive.
#[tauri::command]
pub async fn open_archive(request: OpenArchiveRequest) -> CommandResult<OpenArchiveResponse> {
    let archive_path = PathBuf::from(&request.archive_path);

    let result = tokio::task::spawn_blocking(move || {
        ArchiveReader::open(&archive_path, &request.password)
    })
    .await
    .map_err(|e| to_command_error(format!("Task error: {}", e)))?
    .map_err(to_command_error)?;

    let info = result.info();

    Ok(OpenArchiveResponse {
        archive_name: info.archive_name,
        created_at: info.created_at,
        creator_version: info.creator_version,
        compression: info.compression,
        file_count: info.file_count,
        total_original_size: info.total_original_size,
        total_compressed_size: info.total_compressed_size,
        format_version: info.format_version,
        entries: info
            .entries
            .into_iter()
            .map(|e| ArchiveFileEntry {
                path: e.path,
                original_size: e.original_size,
                compressed_size: e.compressed_size,
                modified_at: e.modified_at,
                compression_ratio: e.compression_ratio,
            })
            .collect(),
    })
}

#[derive(Debug, Deserialize)]
pub struct ExtractArchiveRequest {
    pub archive_path: String,
    pub password: String,
    pub output_dir: String,
    /// If None, extract all files.
    pub selected_files: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct ExtractArchiveResponse {
    pub extracted_count: usize,
    pub output_dir: String,
}

/// Extract files from a .andrii archive.
#[tauri::command]
pub async fn extract_archive(
    _app: AppHandle,
    request: ExtractArchiveRequest,
) -> CommandResult<ExtractArchiveResponse> {
    let archive_path = PathBuf::from(&request.archive_path);
    let output_dir = PathBuf::from(&request.output_dir);

    let result = tokio::task::spawn_blocking(move || {
        let reader = ArchiveReader::open(&archive_path, &request.password)?;

        let extracted = match request.selected_files {
            Some(files) => {
                let mut paths = Vec::new();
                for f in &files {
                    let p = reader.extract_file(f, &output_dir)?;
                    paths.push(p);
                }
                paths
            }
            None => reader.extract_all(&output_dir)?,
        };

        Ok::<_, andrii_core::ArchiveError>(extracted)
    })
    .await
    .map_err(|e| to_command_error(format!("Task error: {}", e)))?
    .map_err(to_command_error)?;

    Ok(ExtractArchiveResponse {
        extracted_count: result.len(),
        output_dir: request.output_dir,
    })
}

#[derive(Debug, Deserialize)]
pub struct VerifyArchiveRequest {
    pub archive_path: String,
}

/// Verify archive integrity (no password required).
#[tauri::command]
pub async fn verify_archive_cmd(
    request: VerifyArchiveRequest,
) -> CommandResult<VerifyResult> {
    let archive_path = PathBuf::from(&request.archive_path);

    let result = tokio::task::spawn_blocking(move || verify_archive(&archive_path))
        .await
        .map_err(|e| to_command_error(format!("Task error: {}", e)))?
        .map_err(to_command_error)?;

    Ok(result)
}
