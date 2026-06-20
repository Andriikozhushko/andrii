use andrii_crypto::password::analyze_password;
use serde::Serialize;

use crate::error::CommandResult;

#[derive(Debug, Serialize)]
pub struct PasswordStrengthResult {
    pub score: u8,
    pub label: String,
    pub entropy_bits: f64,
    pub estimated_crack_time: String,
    pub has_lowercase: bool,
    pub has_uppercase: bool,
    pub has_digits: bool,
    pub has_symbols: bool,
    pub length: usize,
    pub suggestions: Vec<String>,
}

/// Analyze password strength. Called on every keystroke from the frontend.
#[tauri::command]
pub fn analyze_password_strength(password: String) -> CommandResult<PasswordStrengthResult> {
    let analysis = analyze_password(&password);
    Ok(PasswordStrengthResult {
        score: analysis.score,
        label: analysis.label,
        entropy_bits: analysis.entropy_bits,
        estimated_crack_time: analysis.estimated_crack_time,
        has_lowercase: analysis.has_lowercase,
        has_uppercase: analysis.has_uppercase,
        has_digits: analysis.has_digits,
        has_symbols: analysis.has_symbols,
        length: analysis.length,
        suggestions: analysis.suggestions,
    })
}
