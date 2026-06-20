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
    /// Crack time with Argon2id protection (~2 guesses/sec per GPU).
    pub estimated_crack_time: String,
    /// Crack time without KDF protection (GPU at ~10^10 hashes/sec).
    /// Shows the intrinsic password strength, not ANDRII's protection.
    pub gpu_crack_time: String,
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
    "password123", "1234567", "12345", "1234567890", "000000", "654321",
    "123456789", "passw0rd", "aaaaaa", "mustang", "access", "hello",
    "charlie", "donald", "batman", "trustno1", "12341234", "1q2w3e",
    "pass123", "test123", "admin123", "root", "toor", "secret",
];

/// Analyze password strength and return detailed metrics.
pub fn analyze_password(password: &str) -> PasswordAnalysis {
    let length = password.len();
    let has_lowercase = password.chars().any(|c| c.is_ascii_lowercase());
    let has_uppercase = password.chars().any(|c| c.is_ascii_uppercase());
    let has_digits = password.chars().any(|c| c.is_ascii_digit());
    let has_symbols = password.chars().any(|c| !c.is_alphanumeric());

    let is_common = COMMON_PASSWORDS.contains(&password.to_lowercase().as_str());

    // Calculate character pool size
    let mut pool_size: u32 = 0;
    if has_lowercase { pool_size += 26; }
    if has_uppercase { pool_size += 26; }
    if has_digits { pool_size += 10; }
    if has_symbols { pool_size += 32; }
    if pool_size == 0 { pool_size = 1; }

    // Pool-based entropy
    let pool_entropy = if length == 0 {
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
        let pattern_entropy = detect_pattern_entropy(password);

        // Use the minimum of pool-based entropy and pattern-based entropy
        let base = pool_entropy.min(pattern_entropy);
        (base - repetition_penalty - sequence_penalty).max(0.0)
    };

    let level = entropy_to_level(effective_entropy, is_common);
    let estimated_crack_time = entropy_to_argon2id_time(effective_entropy);
    let gpu_crack_time = entropy_to_gpu_time(effective_entropy);

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
    if length >= 16 && has_lowercase && has_uppercase && has_digits && has_symbols && !is_common && suggestions.is_empty() {
        suggestions.push("Excellent password strength".to_string());
    }

    PasswordAnalysis {
        label: level.label().to_string(),
        score: level.score(),
        level,
        entropy_bits: effective_entropy,
        estimated_crack_time,
        gpu_crack_time,
        has_lowercase,
        has_uppercase,
        has_digits,
        has_symbols,
        length,
        suggestions,
    }
}

/// Detect if the password follows a human-chosen pattern (word+digits, etc.)
/// and return a realistic "dictionary attack" entropy estimate in bits.
/// Returns f64::MAX if no pattern detected (fall back to pool entropy).
fn detect_pattern_entropy(password: &str) -> f64 {
    let bytes = password.as_bytes();
    let len = bytes.len();
    if len == 0 {
        return 0.0;
    }

    // Find split point between alpha prefix and digit/symbol suffix
    let alpha_len = bytes.iter().take_while(|b| b.is_ascii_alphabetic()).count();
    let digits_len = bytes[alpha_len..].iter().take_while(|b| b.is_ascii_digit()).count();
    let symbols_len = bytes[alpha_len + digits_len..].iter().take_while(|b| !b.is_ascii_alphanumeric()).count();

    // Pattern: pure alpha word + digits (optionally trailing symbols)
    if alpha_len >= 3 && alpha_len <= 8 && (digits_len + symbols_len) > 0
        && alpha_len + digits_len + symbols_len == len
    {
        // Dictionary attack: ~10,000 common words, digit suffix = 10^digit_count
        let word_space = 10_000.0_f64;
        let digit_space = 10_f64.powi(digits_len as i32).max(1.0);
        let symbol_space = 32_f64.powi(symbols_len as i32).max(1.0);
        return (word_space * digit_space * symbol_space).log2();
    }

    // Pattern: pure alpha word + alpha word (two concatenated words)
    let first_word = bytes.iter().take_while(|b| b.is_ascii_lowercase()).count();
    let second_word = bytes[first_word..].iter().take_while(|b| b.is_ascii_lowercase()).count();
    if first_word >= 3 && second_word >= 3 && first_word + second_word == len {
        // Two lowercase words: word_space^2
        let word_space = 10_000.0_f64;
        return (word_space * word_space).log2(); // ~26.5 bits
    }

    // Pattern: all digits
    if bytes.iter().all(|b| b.is_ascii_digit()) {
        return (10_f64.powi(len as i32)).log2();
    }

    // Pattern: repeated character (aaaaaa, 111111)
    if bytes.windows(2).all(|w| w[0] == w[1]) {
        return 6.0; // log2(94 * length) would be too generous; treat as near-zero
    }

    f64::MAX // no pattern detected, use pool entropy
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

/// Crack time with Argon2id protection (~2 guesses/sec, GPU memory-limited).
fn entropy_to_argon2id_time(entropy: f64) -> String {
    if entropy <= 0.0 {
        return "Instantly".to_string();
    }
    // Expected guesses = 2^(entropy-1), at 2/sec: seconds = 2^(entropy-2)
    let log2_seconds = entropy - 2.0;
    format_time_from_log2_seconds(log2_seconds)
}

/// Crack time without KDF protection (GPU brute-force, ~10^10 hashes/sec).
/// This shows the intrinsic password strength as a raw secret.
fn entropy_to_gpu_time(entropy: f64) -> String {
    if entropy <= 0.0 {
        return "Instantly".to_string();
    }
    // 10^10 guesses/sec ≈ 2^33.2
    // seconds = 2^(entropy-1) / 10^10 = 2^(entropy - 1 - 33.2) = 2^(entropy - 34.2)
    let log2_seconds = entropy - 34.2;
    if log2_seconds < 0.0 {
        return "< 1 second".to_string();
    }
    format_time_from_log2_seconds(log2_seconds)
}

fn format_time_from_log2_seconds(log2_seconds: f64) -> String {
    if log2_seconds < 0.0 {
        "Less than a second".to_string()
    } else if log2_seconds < 5.0 {
        "A few seconds".to_string()
    } else if log2_seconds < 11.0 {
        format!("{} minutes", (2f64.powf(log2_seconds) / 60.0).ceil() as u64)
    } else if log2_seconds < 16.6 {
        format!("{} hours", (2f64.powf(log2_seconds) / 3600.0).ceil() as u64)
    } else if log2_seconds < 21.0 {
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
        "Billions of years".to_string()
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
    fn test_test123_is_weak_not_strong() {
        let a = analyze_password("test123");
        // Must be weak — crack time should be days, not decades
        assert!(a.score <= 1, "test123 should be Weak or Very Weak, got {:?}", a.level);
    }

    #[test]
    fn test_test123_crack_time_is_realistic() {
        let a = analyze_password("test123");
        // test123 is a known common password → GPU cracks it instantly (wordlist attack)
        // Accept "Instantly", "< 1 second", or "A few seconds" — all realistic for a known-bad password
        let fast = ["Instantly", "< 1 second", "second"];
        assert!(
            fast.iter().any(|s| a.gpu_crack_time.contains(s)),
            "test123 without KDF should crack instantly or in seconds, got: {}",
            a.gpu_crack_time
        );
    }

    #[test]
    fn test_123456_instant() {
        let a = analyze_password("123456");
        assert_eq!(a.level, StrengthLevel::VeryWeak);
        assert_eq!(a.estimated_crack_time, "Instantly");
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
    fn test_strong_password_crack_time_long() {
        let a = analyze_password("X7$kP2@mQ9!vL4#nR");
        // Should crack in millions+ of years even with GPU
        assert!(
            a.gpu_crack_time.contains("years") || a.gpu_crack_time.contains("Millions"),
            "Strong password GPU crack time should be years, got: {}",
            a.gpu_crack_time
        );
    }

    #[test]
    fn test_empty_password() {
        let a = analyze_password("");
        assert_eq!(a.level, StrengthLevel::VeryWeak);
        assert_eq!(a.length, 0);
    }

    #[test]
    fn test_all_digits_pattern() {
        let a = analyze_password("98765432");
        // 8 digits without KDF: 10^8 / 10^10 = 0.01 seconds
        assert!(
            a.gpu_crack_time.contains("< 1 second") || a.gpu_crack_time.contains("second"),
            "8-digit number should crack quickly: {}",
            a.gpu_crack_time
        );
    }
}
