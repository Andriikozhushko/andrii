# ANDRII 01C — Windows EXE Acceptance

**Tag:** `snapshot/andrii-01c-native-desktop-exe-polish`
**Date:** 2026-06-21
**Build outputs:**
- `target/release/andrii-app.exe`
- `target/release/bundle/msi/ANDRII_0.1.0_x64_en-US.msi`
- `target/release/bundle/nsis/ANDRII_0.1.0_x64-setup.exe`

---

## Build verification

| Check | Result |
|---|---|
| `cargo test --workspace --exclude andrii-app` | 59 tests passed |
| `npm run build` | ✓ (TypeScript + Vite) |
| `npm run tauri build` | ✓ — .exe + .msi + setup.exe produced |

---

## 01C deliverables

### Visual / UX

- [ ] Light theme by default (system-aware)
- [ ] Dark theme follows system or manual toggle in Settings
- [ ] Left sidebar: New Archive, Open Archive, Verify, Settings
- [ ] No Home screen — default screen is New Archive
- [ ] File list views use `<table>` (not card grids)
- [ ] Compact native desktop spacing throughout

### New Archive screen

- [ ] File & folder table with icon, name, type, remove button
- [ ] Drag files onto window → added to table
- [ ] Add Files / Add Folder buttons open native dialogs
- [ ] Archive Name field
- [ ] Compression: Fast / Balanced / Maximum selector
- [ ] Password field with strength indicator
- [ ] Confirm password field (mismatch shows error)
- [ ] Create button opens Save dialog; progress shown during creation
- [ ] Security Report dialog appears on success

### Security Report dialog

- [ ] Header: "Archive Created Successfully"
- [ ] Security score (0–100) with circular gauge
- [ ] Label: Perfect / Excellent / Good / Moderate
- [ ] Protection summary (3 bullets, plain language)
- [ ] Password section: strength label + "Without ANDRII protection" + "With ANDRII KDF"
- [ ] Weak password shows "Still not recommended" (not crack years)
- [ ] Weak password shows recommendation text
- [ ] "Technical details" collapsed by default; expands to show XChaCha20-Poly1305, Argon2id, BLAKE3, Zstd
- [ ] Done button closes dialog and resets form

### Password strength

- [ ] Weak password (e.g. "test123"): label "Weak"
- [ ] "Without ANDRII protection" row shows instant/fast GPU time
- [ ] "With ANDRII KDF" row shows "Still not recommended" for weak passwords
- [ ] Suggestion text appears for weak passwords
- [ ] Strong password shows real estimated time for both rows

### Open Archive screen

- [ ] Browse button + click-to-browse on path field
- [ ] Password field with show/hide toggle
- [ ] Unlock button (Enter key also submits)
- [ ] Archive summary: name, file count, size, compression, dates
- [ ] File table with checkboxes, sortable Name/Size/Modified columns
- [ ] Search/filter field
- [ ] Extract All button + Extract Selected (n) button
- [ ] Success/error status bar at bottom of file table

### Verify screen

- [ ] File selection
- [ ] Verify Integrity button
- [ ] Pass: green "Archive is authentic" banner
- [ ] Fail (tampered): red "Archive has been modified" banner
- [ ] Fail (unknown format): red "Not a valid ANDRII archive"
- [ ] Three check rows: format, version, integrity hash

### Settings screen

- [ ] Theme: System / Light / Dark segmented control
- [ ] Default Compression: Fast / Balanced / Maximum
- [ ] Security section: Encryption (Built-in), File Association (Registered)
- [ ] About: ANDRII v0.1.0, Andrii Kozhushko

### Windows EXE polish

- [ ] Publisher: "Andrii Kozhushko" in installer metadata
- [ ] Copyright: "Copyright 2026 Andrii Kozhushko"
- [ ] File association: .andrii files registered during install
- [ ] Double-click a .andrii file → app opens on Open Archive screen with file pre-selected
- [ ] MSI installer produced
- [ ] NSIS setup.exe produced

---

## Manual test checklist

### Happy path — create

1. Launch `andrii-app.exe`
2. Default screen is "New Archive"
3. Add a file (drag or button)
4. Set archive name + strong password
5. Click "Create .andrii Archive"
6. Security Report appears with score ≥ 90 ("Excellent")
7. Technical details expands to show algorithm names
8. Done → form resets

### Happy path — open

1. Navigate to "Open Archive"
2. Browse for the archive created above
3. Enter correct password → archive info + file table appear
4. Extract All → files appear in chosen folder

### File association

1. Install via .msi or setup.exe
2. Double-click any .andrii file in File Explorer
3. App opens directly on Open Archive screen with that file pre-selected

### Weak password warning

1. New Archive → enter password "test123"
2. Strength shows "Weak"
3. "Without ANDRII protection: Instantly" (or equivalent fast time)
4. "With ANDRII KDF: Still not recommended"
5. Suggestion text visible

### Dark theme

1. Settings → Theme → Dark
2. Entire app switches to dark palette
3. Preference persists on restart

### Verify — tampered archive

1. Copy a valid .andrii file
2. Open it in a hex editor and flip one byte in the middle
3. Verify → shows "Archive has been modified"
