use std::path::PathBuf;

use andrii_compress::CompressionLevel;
use andrii_core::{ArchiveReader, ArchiveWriter, CreateArchiveOptions, VerifyResult, verify_archive};
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
    pub current: u64,
    pub total: u64,
    pub current_file: String,
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
        let opts = CreateArchiveOptions {
            archive_name: request.archive_name,
            password: request.password,
            compression,
            output_path: output_path.clone(),
            progress_callback: Some(Box::new(move |current, total, file| {
                let _ = app_clone.emit(
                    "archive-progress",
                    ProgressEvent {
                        current,
                        total,
                        current_file: file.to_string(),
                    },
                );
            })),
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
