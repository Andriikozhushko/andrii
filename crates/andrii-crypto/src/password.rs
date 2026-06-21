use serde::Serialize;

/// Password strength score.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub enum StrengthLevel {
    VeryWeak,
    Weak,
    Fair,
    Strong,
    Excellent,
}

impl StrengthLevel {
    pub fn label(&self) -> &'static str {
        match self {
            Self::VeryWeak => "Very weak",
            Self::Weak => "Weak",
            Self::Fair => "Fair",
            Self::Strong => "Strong",
            Self::Excellent => "Excellent",
        }
    }

    pub fn score(&self) -> u8 {
        match self {
            Self::VeryWeak => 0,
            Self::Weak => 1,
            Self::Fair => 2,
            Self::Strong => 3,
            Self::Excellent => 4,
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
    /// Conservative, human-readable time bucket derived from the strength level.
    /// Never reports absurd estimates ("millions of years").
    pub estimated_crack_time: String,
    /// Kept for API compatibility; same conservative bucket as `estimated_crack_time`.
    pub gpu_crack_time: String,
    pub has_lowercase: bool,
    pub has_uppercase: bool,
    pub has_digits: bool,
    pub has_symbols: bool,
    pub length: usize,
    pub suggestions: Vec<String>,
}

/// Known weak passwords (also matched as a base word before a digit/symbol suffix).
const COMMON_PASSWORDS: &[&str] = &[
    "password", "passwort", "passw0rd", "123456", "12345678", "1234567",
    "12345", "1234567890", "123456789", "qwerty", "qwertyuiop", "qwerty123",
    "abc123", "password1", "111111", "000000", "123123", "112233", "121212",
    "admin", "administrator", "letmein", "welcome", "monkey", "dragon",
    "master", "login", "pass", "test", "testing", "iloveyou", "sunshine",
    "princess", "football", "baseball", "shadow", "superman", "michael",
    "jessica", "ashley", "qazwsx", "zxcvbn", "zxcvbnm", "asdf", "asdfgh",
    "asdfghjkl", "asdasd", "654321", "passw0rd", "mustang", "access",
    "hello", "hello123", "charlie", "donald", "batman", "trustno1",
    "12341234", "1q2w3e", "1q2w3e4r", "1qaz2wsx", "pass123", "test123",
    "admin123", "root", "toor", "secret", "changeme", "default", "guest",
    "user", "abcdef", "abcd1234", "qwe123", "asd123",
];

/// Keyboard adjacency rows (and reverses) used to detect swipe patterns.
const KEYBOARD_ROWS: &[&str] = &[
    "qwertyuiop", "poiuytrewq",
    "asdfghjkl", "lkjhgfdsa",
    "zxcvbnm", "mnbvcxz",
    "1234567890", "0987654321",
    "qwertz", "azerty",
];

/// Analyze password strength and return detailed metrics.
pub fn analyze_password(password: &str) -> PasswordAnalysis {
    let length = password.len();
    let lower = password.to_lowercase();

    let has_lowercase = password.chars().any(|c| c.is_ascii_lowercase());
    let has_uppercase = password.chars().any(|c| c.is_ascii_uppercase());
    let has_digits = password.chars().any(|c| c.is_ascii_digit());
    let has_symbols = password.chars().any(|c| !c.is_alphanumeric());

    let common = is_common(&lower);

    // Full-credit upper bound: brute-force pool entropy.
    let pool_entropy = if length == 0 {
        0.0
    } else {
        (pool_size(password) as f64).log2() * length as f64
    };

    // Take the MINIMUM over several pattern-aware estimates. Random passwords
    // match no pattern and keep their full pool entropy; structured / mashed
    // passwords are capped down to something realistic.
    let mut effective = pool_entropy;

    // Repeated chunks: "asdasd", "abcabcabc" -> entropy of one unit + log2(reps).
    if length > 1 {
        let p = smallest_period(password.as_bytes());
        if p < length {
            let reps = length / p;
            let unit = &password[..p];
            let unit_entropy = (pool_size(unit) as f64).log2() * p as f64;
            effective = effective.min(unit_entropy + (reps as f64).log2());
        }
    }

    // Keyboard swipe runs ("qwerty", "asdf", "1234"): the run collapses to a few
    // bits, the rest keeps modest per-char entropy.
    let kb = longest_keyboard_run(&lower);
    if kb >= 4 {
        let rest = length.saturating_sub(kb) as f64;
        effective = effective.min(10.0 + rest * 2.0);
    }

    // Structural: single word + digits(+symbols), or all-digits.
    effective = effective.min(structural_entropy(&lower));

    // Known-common (exact or base word) → effectively no security.
    if common {
        effective = 0.0;
    }

    // Local sequence / repetition penalties.
    let penalty = repetition_penalty(password) + sequence_penalty(password);
    effective = (effective - penalty).max(0.0);

    let level = entropy_to_level(effective, common);
    let bucket = level_to_time(&level, effective);

    PasswordAnalysis {
        label: level.label().to_string(),
        score: level.score(),
        estimated_crack_time: bucket.to_string(),
        gpu_crack_time: bucket.to_string(),
        level,
        entropy_bits: effective,
        has_lowercase,
        has_uppercase,
        has_digits,
        has_symbols,
        length,
        suggestions: build_suggestions(length, has_uppercase, has_digits, has_symbols, common),
    }
}

fn build_suggestions(
    length: usize,
    has_upper: bool,
    has_digits: bool,
    has_symbols: bool,
    common: bool,
) -> Vec<String> {
    let recommendation =
        "Use 12+ characters with unrelated words, numbers and symbols, or use a password manager."
            .to_string();
    let strong_enough = length >= 12 && has_upper && has_digits && has_symbols && !common;
    if strong_enough {
        return Vec::new();
    }
    vec![recommendation]
}

/// Exact match, or a known base word followed only by digits/symbols
/// ("password123" → "password", "admin123" → "admin").
fn is_common(lower: &str) -> bool {
    if lower.is_empty() {
        return false;
    }
    if COMMON_PASSWORDS.contains(&lower) {
        return true;
    }
    let base: String = lower
        .trim_end_matches(|c: char| c.is_ascii_digit() || !c.is_ascii_alphanumeric())
        .to_string();
    base.len() >= 4 && base != lower && COMMON_PASSWORDS.contains(&base.as_str())
}

fn pool_size(s: &str) -> u32 {
    let mut p: u32 = 0;
    if s.chars().any(|c| c.is_ascii_lowercase()) {
        p += 26;
    }
    if s.chars().any(|c| c.is_ascii_uppercase()) {
        p += 26;
    }
    if s.chars().any(|c| c.is_ascii_digit()) {
        p += 10;
    }
    if s.chars().any(|c| !c.is_alphanumeric()) {
        p += 32;
    }
    p.max(1)
}

/// Smallest repeating period of a byte slice; equals `len` if not periodic.
fn smallest_period(s: &[u8]) -> usize {
    let n = s.len();
    for p in 1..=n / 2 {
        if n % p == 0 && (p..n).all(|i| s[i] == s[i - p]) {
            return p;
        }
    }
    n
}

/// Longest contiguous substring (len ≥ 3) that appears in a keyboard row.
fn longest_keyboard_run(s: &str) -> usize {
    let chars: Vec<char> = s.chars().collect();
    let n = chars.len();
    let mut best = 0usize;
    for i in 0..n {
        let mut j = n;
        while j > i + 2 {
            let sub: String = chars[i..j].iter().collect();
            if KEYBOARD_ROWS.iter().any(|r| r.contains(&sub)) {
                best = best.max(j - i);
                break;
            }
            j -= 1;
        }
    }
    best
}

/// A 4-digit number that looks like a year (1900–2099) — a very predictable suffix.
fn is_year_suffix(s: &str) -> bool {
    s.len() == 4
        && s.chars().all(|c| c.is_ascii_digit())
        && s.parse::<u32>().map(|y| (1900..=2099).contains(&y)).unwrap_or(false)
}

fn looks_like_runny_digits(s: &str) -> bool {
    let d: Vec<i32> = s.chars().filter_map(|c| c.to_digit(10)).map(|x| x as i32).collect();
    if d.len() < 2 {
        return false;
    }
    let all_same = d.windows(2).all(|w| w[0] == w[1]);
    let asc = d.windows(2).all(|w| w[1] - w[0] == 1);
    let desc = d.windows(2).all(|w| w[1] - w[0] == -1);
    all_same || asc || desc
}

/// Realistic entropy for human-structured passwords. Returns `f64::MAX` when no
/// structure is recognised (caller falls back to pool entropy).
fn structural_entropy(lower: &str) -> f64 {
    let bytes = lower.as_bytes();
    let len = bytes.len();
    if len == 0 {
        return 0.0;
    }

    // [alpha run][digit run][symbol run]
    let alpha_len = bytes.iter().take_while(|b| b.is_ascii_alphabetic()).count();
    let digit_len = bytes[alpha_len..].iter().take_while(|b| b.is_ascii_digit()).count();
    let symbol_len = bytes[alpha_len + digit_len..]
        .iter()
        .take_while(|b| !b.is_ascii_alphanumeric())
        .count();

    if alpha_len >= 3 && (digit_len + symbol_len) > 0 && alpha_len + digit_len + symbol_len == len {
        let alpha = &lower[..alpha_len];
        let kb = longest_keyboard_run(alpha);
        let alpha_bits = if kb >= alpha_len.saturating_sub(1) {
            8.0 // basically a keyboard mash
        } else {
            (8.0 + alpha_len as f64 * 0.9).min(30.0) // unknown word, grows slowly
        };
        let digit_slice = &lower[alpha_len..alpha_len + digit_len];
        let digit_bits = if digit_len == 0 {
            0.0
        } else if looks_like_runny_digits(digit_slice) {
            3.0
        } else if is_year_suffix(digit_slice) {
            4.0 // predictable year like 2026 / 1999
        } else {
            (digit_len as f64 * 3.32).min(20.0)
        };
        let symbol_bits = (symbol_len as f64 * 4.0).min(16.0);
        return alpha_bits + digit_bits + symbol_bits;
    }

    // all digits
    if bytes.iter().all(|b| b.is_ascii_digit()) {
        if looks_like_runny_digits(lower) {
            return 8.0;
        }
        return (len as f64 * 3.32).min(30.0);
    }

    f64::MAX
}

fn entropy_to_level(entropy: f64, common: bool) -> StrengthLevel {
    if common || entropy < 16.0 {
        StrengthLevel::VeryWeak
    } else if entropy < 32.0 {
        StrengthLevel::Weak
    } else if entropy < 48.0 {
        StrengthLevel::Fair
    } else if entropy < 66.0 {
        StrengthLevel::Strong
    } else {
        StrengthLevel::Excellent
    }
}

/// Conservative time bucket per the 01F spec. Never absurd.
fn level_to_time(level: &StrengthLevel, entropy: f64) -> &'static str {
    match level {
        StrengthLevel::VeryWeak => {
            if entropy < 8.0 {
                "Instantly"
            } else {
                "A few seconds"
            }
        }
        StrengthLevel::Weak => "Minutes to hours",
        StrengthLevel::Fair => "Days to weeks",
        StrengthLevel::Strong => "Months to years",
        StrengthLevel::Excellent => "Many years",
    }
}

fn repetition_penalty(password: &str) -> f64 {
    let chars: Vec<char> = password.chars().collect();
    let mut penalty = 0.0;
    for w in chars.windows(3) {
        if w[0] == w[1] && w[1] == w[2] {
            penalty += 5.0;
        }
    }
    penalty
}

fn sequence_penalty(password: &str) -> f64 {
    let chars: Vec<char> = password.chars().collect();
    let mut penalty = 0.0;
    for w in chars.windows(3) {
        let (a, b, c) = (w[0] as i32, w[1] as i32, w[2] as i32);
        if (b - a == 1 && c - b == 1) || (b - a == -1 && c - b == -1) {
            penalty += 3.0;
        }
    }
    penalty
}

#[cfg(test)]
mod tests {
    use super::*;

    fn level(pw: &str) -> StrengthLevel {
        analyze_password(pw).level
    }

    #[test]
    fn empty_is_very_weak() {
        let a = analyze_password("");
        assert_eq!(a.level, StrengthLevel::VeryWeak);
        assert_eq!(a.length, 0);
    }

    #[test]
    fn common_passwords_are_weak() {
        for pw in ["password", "123456", "qwerty", "admin", "test123", "qwerty123"] {
            assert!(
                level(pw).score() <= 1,
                "{pw} should be very weak/weak, got {:?}",
                level(pw)
            );
        }
    }

    #[test]
    fn word_plus_digits_are_capped() {
        // Must never be Strong/Excellent.
        for pw in ["password123", "admin123", "test123", "qwerty123"] {
            assert!(level(pw).score() <= 2, "{pw} got {:?}", level(pw));
        }
    }

    #[test]
    fn asdqwerty123_is_not_strong() {
        let s = level("asdqwerty123").score();
        // Spec: must be Weak or Fair (never Strong+).
        assert!((1..=2).contains(&s), "asdqwerty123 score was {s}");
    }

    #[test]
    fn keyboard_and_repeat_patterns_weak() {
        for pw in ["asdasdasd", "qwerty123", "asdfghjkl", "1234567890", "abcabcabc"] {
            assert!(level(pw).score() <= 1, "{pw} got {:?}", level(pw));
        }
    }

    #[test]
    fn sequential_digits_weak() {
        assert!(level("123456789").score() <= 1);
    }

    #[test]
    fn phase6_examples_never_strong() {
        for pw in ["test123", "password123", "qwerty123", "asdqwerty123", "admin2026"] {
            let s = level(pw).score();
            assert!(s < 3, "{pw} must never be Strong+, scored {:?}", level(pw));
        }
    }

    #[test]
    fn year_suffix_is_predictable() {
        // word + year is not strong (e.g. Summer2026)
        assert!(analyze_password("Summer2026").score < 3);
    }

    #[test]
    fn genuinely_strong_password_scores_high() {
        let a = analyze_password("X7$kP2@mQ9!vL4#nR");
        assert!(a.score >= 3, "expected strong+, got {:?}", a.level);
    }

    #[test]
    fn passphrase_is_decent() {
        // Long unrelated words → at least Fair.
        let a = analyze_password("correct-horse-battery-staple-42");
        assert!(a.score >= 2, "got {:?}", a.level);
    }

    #[test]
    fn never_reports_absurd_times() {
        for pw in ["X7$kP2@mQ9!vL4#nR", "correct-horse-battery-staple-42", "test123", ""] {
            let a = analyze_password(pw);
            for t in [&a.estimated_crack_time, &a.gpu_crack_time] {
                let low = t.to_lowercase();
                assert!(
                    !low.contains("million") && !low.contains("billion"),
                    "absurd time for {pw}: {t}"
                );
            }
        }
    }

    #[test]
    fn strong_time_bucket_is_years_not_absurd() {
        let a = analyze_password("X7$kP2@mQ9!vL4#nR");
        assert!(a.estimated_crack_time.to_lowercase().contains("years"));
    }
}
