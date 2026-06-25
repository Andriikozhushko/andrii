# ANDRII — Release Security Notes

Honest security posture for the ANDRII 1.0.0 release candidate. No
overstatements. No compliance claims.

---

## Signing

- **Installers and artifacts are unsigned.** No code-signing certificate is
  configured for Windows (`-setup.exe` / `.msi`) or Linux (`.deb` / `.AppImage`).
- Consequences:
  - Windows SmartScreen / Defender may show "unrecognized app" warnings.
  - Linux package managers and desktops may warn about untrusted origin.
  - Browsers may flag downloads as uncommon.
- These warnings are expected for an unsigned release candidate and do **not**
  by themselves indicate malware. Users should verify checksums (below) and
  obtain artifacts only from the official GitHub Release.

## Integrity verification (SHA-256)

- Every release artifact has a SHA-256 entry in `SHA256SUMS.txt`, published
  alongside the artifacts in the GitHub Release.
- Users should verify downloads:
  ```bash
  sha256sum -c SHA256SUMS.txt --ignore-missing
  ```
- Checksums protect against **accidental corruption and tampering during
  transport**, given a trusted channel for `SHA256SUMS.txt` itself (the GitHub
  Release page over HTTPS). They are **not** a substitute for code signing and
  do not prove authorship cryptographically.

## Cryptographic design (what ANDRII uses)

- **Encryption:** XChaCha20-Poly1305 (authenticated encryption, 192-bit nonce).
- **Key derivation:** Argon2id.
- **Integrity:** BLAKE3.
- **Archive format:** custom `.andrii` format; backward-compatible v1/v2/v3
  readers. v3 adds solid-group "Maximum" compression; it does not change the
  crypto primitives or parameters.

These are standard, well-regarded primitives. Their use here has **not** been
independently audited (see below).

## What is NOT claimed

- **No independent cryptographic audit has been completed.** ANDRII has not been
  reviewed by a third-party security firm. Do not represent it as audited.
- **No formal security certification or compliance** (e.g. FIPS, Common
  Criteria, SOC 2) is claimed or implied.
- **No warranty of fitness** for any particular purpose, including storage of
  highly sensitive data. Users assume the risk.
- **No side-channel / hardware-attack hardening claims.** ANDRII is a
  software-only implementation; it does not claim resistance to local
  physical or side-channel attacks beyond what the primitives provide.
- **No auto-update, telemetry, cloud, or network services.** ANDRII operates
  fully offline; no data leaves the machine.

## Passwords and recovery

- ANDRII derives the archive key from the user's password via Argon2id. The
  password is never stored or transmitted.
- **Forgotten passwords cannot be recovered.** There is no escrow, no backdoor,
  and no master key. If the password is lost, the archive contents are
  permanently unrecoverable. Users must preserve their passwords.
- There is no rate-limit on local decryption attempts beyond Argon2id's
  inherent cost — a local attacker with the file can brute-force offline. Use a
  strong, high-entropy password.

## Verification of the build itself

- The build is reproducible from source via the published GitHub Actions
  workflow (`.github/workflows/release-build.yml`) and `scripts/verify-release-artifacts.mjs`.
- Security-conscious users may build from source and compare against the
  published artifacts.

## Reporting issues

Report security-relevant bugs via the project's GitHub issue tracker (or a
private channel if one is designated). Do not include decrypted archive contents
or passwords in reports.
