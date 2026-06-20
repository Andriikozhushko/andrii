use serde::Serialize;

/// Password strength score.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub enum StrengthLevel {
    VeryWeak,
    Weak,
    Fair,
    Strong,
    VeryStrong,
}

impl StrengthLevel {
    pub fn label(&self) -> &'static str {
        match self {
            Self::VeryWeak => "Very Weak",
            Self::Weak => "Weak",
            Self::Fair => "Fair",
            Self::Strong => "Strong",
            Self::VeryStrong => "Very Strong",
        }
    }

    pub fn score(&self) -> u8 {
        match self {
            Self::VeryWeak => 0,
            Self::Weak => 1,
            Self::Fair => 2,
            Self::Strong => 3,
            Self::VeryStrong => 4,
        }
    }
}

/// Result of password strength analysis.
#[derive(Debug, Clone, Serialize)]
pub struct PasswordAnalysis {
    pub level: StrengthLevel,
    pub label: String,
    pub score: u8,
    pub entropy_bits: f64,
    pub estimated_crack_time: String,
    pub has_lowercase: bool,
    pub has_uppercase: bool,
    pub has_digits: bool,
    pub has_symbols: bool,
    pub length: usize,
    pub suggestions: Vec<String>,
}

const COMMON_PASSWORDS: &[&str] = &[
    "password", "123456", "12345678", "qwerty", "abc123", "password1",
    "111111", "123123", "admin", "letmein", "welcome", "monkey", "dragon",
    "master", "login", "pass", "test", "iloveyou", "sunshine", "princess",
    "football", "shadow", "superman", "michael", "jessica", "qwerty123",
];

/// Analyze password strength and return detailed metrics.
pub fn analyze_password(password: &str) -> PasswordAnalysis {
    let length = password.len();
    let has_lowercase = password.chars().any(|c| c.is_ascii_lowercase());
    let has_uppercase = password.chars().any(|c| c.is_ascii_uppercase());
    let has_digits = password.chars().any(|c| c.is_ascii_digit());
    let has_symbols = password.chars().any(|c| !c.is_alphanumeric());

    // Check for common passwords
    let is_common = COMMON_PASSWORDS.contains(&password.to_lowercase().as_str());

    // Calculate character pool size
    let mut pool_size: u32 = 0;
    if has_lowercase { pool_size += 26; }
    if has_uppercase { pool_size += 26; }
    if has_digits { pool_size += 10; }
    if has_symbols { pool_size += 32; }
    if pool_size == 0 { pool_size = 1; }

    // Entropy in bits: log2(pool_size) * length
    let entropy_bits = if length == 0 {
        0.0
    } else {
        (pool_size as f64).log2() * length as f64
    };

    // Apply penalties
    let effective_entropy = if is_common {
        0.0
    } else {
        let repetition_penalty = calculate_repetition_penalty(password);
        let sequence_penalty = calculate_sequence_penalty(password);
        (entropy_bits - repetition_penalty - sequence_penalty).max(0.0)
    };

    let level = entropy_to_level(effective_entropy, is_common);
    let estimated_crack_time = entropy_to_crack_time(effective_entropy);

    let mut suggestions = Vec::new();
    if length < 12 {
        suggestions.push("Use at least 12 characters".to_string());
    }
    if !has_uppercase {
        suggestions.push("Add uppercase letters".to_string());
    }
    if !has_digits {
        suggestions.push("Add numbers".to_string());
    }
    if !has_symbols {
        suggestions.push("Add symbols (!, @, #, ...)".to_string());
    }
    if is_common {
        suggestions.push("This is a commonly used password — choose something unique".to_string());
    }
    if length >= 16 && has_lowercase && has_uppercase && has_digits && has_symbols && suggestions.is_empty() {
        suggestions.push("Excellent password strength".to_string());
    }

    PasswordAnalysis {
        label: level.label().to_string(),
        score: level.score(),
        level,
        entropy_bits: effective_entropy,
        estimated_crack_time,
        has_lowercase,
        has_uppercase,
        has_digits,
        has_symbols,
        length,
        suggestions,
    }
}

fn entropy_to_level(entropy: f64, is_common: bool) -> StrengthLevel {
    if is_common || entropy < 28.0 {
        StrengthLevel::VeryWeak
    } else if entropy < 36.0 {
        StrengthLevel::Weak
    } else if entropy < 50.0 {
        StrengthLevel::Fair
    } else if entropy < 70.0 {
        StrengthLevel::Strong
    } else {
        StrengthLevel::VeryStrong
    }
}

fn entropy_to_crack_time(entropy: f64) -> String {
    // Assume attacker with Argon2id at ~2 attempts/second (GPU-limited by memory)
    // 2^entropy / 2 = expected guesses for 50% probability
    if entropy <= 0.0 {
        return "Instantly".to_string();
    }

    // Expected guesses = 2^(entropy-1)
    // At 2 attempts/second: seconds = 2^(entropy-1) / 2 = 2^(entropy-2)
    let log2_seconds = entropy - 2.0;

    if log2_seconds < 0.0 {
        "Less than a second".to_string()
    } else if log2_seconds < 5.0 {
        // < 32 seconds
        "A few seconds".to_string()
    } else if log2_seconds < 11.0 {
        // < ~34 minutes
        format!("{} minutes", (2f64.powf(log2_seconds) / 60.0).ceil() as u64)
    } else if log2_seconds < 16.6 {
        // < ~1 day
        format!("{} hours", (2f64.powf(log2_seconds) / 3600.0).ceil() as u64)
    } else if log2_seconds < 21.0 {
        // < ~1 year
        let days = (2f64.powf(log2_seconds) / 86400.0).ceil() as u64;
        format!("{} days", days)
    } else if log2_seconds < 31.5 {
        let years = (2f64.powf(log2_seconds) / (86400.0 * 365.25)).ceil() as u64;
        if years < 1000 {
            format!("{} years", years)
        } else {
            format!("{:.0}K years", years as f64 / 1000.0)
        }
    } else if log2_seconds < 51.6 {
        "Millions of years".to_string()
    } else {
        "Billions of years (effectively uncrackable)".to_string()
    }
}

fn calculate_repetition_penalty(password: &str) -> f64 {
    let chars: Vec<char> = password.chars().collect();
    let mut penalty = 0.0;
    for window in chars.windows(3) {
        if window[0] == window[1] && window[1] == window[2] {
            penalty += 5.0;
        }
    }
    penalty
}

fn calculate_sequence_penalty(password: &str) -> f64 {
    let chars: Vec<char> = password.chars().collect();
    let mut penalty = 0.0;
    for window in chars.windows(3) {
        let a = window[0] as i32;
        let b = window[1] as i32;
        let c = window[2] as i32;
        if (b - a == 1 && c - b == 1) || (b - a == -1 && c - b == -1) {
            penalty += 3.0;
        }
    }
    penalty
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_common_password_very_weak() {
        let a = analyze_password("password");
        assert_eq!(a.level, StrengthLevel::VeryWeak);
    }

    #[test]
    fn test_short_password_weak() {
        let a = analyze_password("Abc1!");
        assert!(a.score <= 2);
    }

    #[test]
    fn test_strong_password() {
        let a = analyze_password("X7$kP2@mQ9!vL4#nR");
        assert!(a.score >= 3, "Expected strong, got {:?}", a.level);
    }

    #[test]
    fn test_empty_password() {
        let a = analyze_password("");
        assert_eq!(a.level, StrengthLevel::VeryWeak);
        assert_eq!(a.length, 0);
    }
}
