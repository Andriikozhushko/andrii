use serde::Serialize;
use thiserror::Error;

/// Application-level error that can be serialized and sent to the frontend.
#[derive(Debug, Error, Serialize)]
pub enum AppError {
    #[error("Archive error: {0}")]
    Archive(String),

    #[error("I/O error: {0}")]
    Io(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Operation cancelled")]
    Cancelled,
}

impl From<andrii_core::ArchiveError> for AppError {
    fn from(e: andrii_core::ArchiveError) -> Self {
        Self::Archive(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}

/// Tauri requires `Result<T, E>` where E implements `Serialize`.
/// We wrap AppError in a string to ensure compatibility.
pub type CommandResult<T> = Result<T, String>;

pub fn to_command_error(e: impl std::fmt::Display) -> String {
    e.to_string()
}
