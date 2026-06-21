fn main() {
    // Embed the Windows application manifest (ComCtl32 v6 / visual styles, DPI
    // awareness, long-path support). ComCtl32 v6 is required so imports like
    // comctl32!TaskDialogIndirect resolve; without the manifest the loader binds
    // them against the legacy v5 in System32 and fails with STATUS_ENTRYPOINT_NOT_FOUND.
    //
    // embed-manifest writes the COFF object itself, so this needs no windres /
    // mt.exe / MinGW / MSVC — it restores the manifest the patched tauri-winres
    // no longer embeds.
    #[cfg(windows)]
    {
        use embed_manifest::{embed_manifest, new_manifest};
        embed_manifest(new_manifest("ANDRII")).expect("unable to embed manifest file");
    }

    tauri_build::build();
}
