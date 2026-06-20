import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Screen, Theme } from "./types";
import Layout from "./components/Layout";
import CreateArchive from "./pages/CreateArchive";
import OpenArchive from "./pages/OpenArchive";
import VerifyArchive from "./pages/VerifyArchive";
import Settings from "./pages/Settings";

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("create");
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [startupArchivePath, setStartupArchivePath] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("andrii-theme") as Theme | null) ?? "system";
  });

  // Apply theme on mount + changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("andrii-theme", theme);
  }, [theme]);

  // Check if app was launched with a .andrii file argument
  useEffect(() => {
    invoke<string | null>("get_startup_archive_path").then((path) => {
      if (path) {
        setStartupArchivePath(path);
        setScreen("open");
      }
    }).catch(() => {/* ignore */});
  }, []);

  const navigate = (s: Screen) => setScreen(s);

  const handleDragToCreate = (files: string[]) => {
    setPendingFiles(files);
    setScreen("create");
  };

  const handleCreateBack = () => {
    setPendingFiles([]);
    navigate("create");
  };

  return (
    <Layout screen={screen} onNavigate={navigate}>
      {screen === "create" && (
        <CreateArchive
          onBack={handleCreateBack}
          initialFiles={pendingFiles}
          onNavigateWithFiles={handleDragToCreate}
        />
      )}
      {screen === "open" && (
        <OpenArchive
          onBack={() => navigate("open")}
          initialPath={startupArchivePath ?? undefined}
          onClearInitialPath={() => setStartupArchivePath(null)}
        />
      )}
      {screen === "verify" && <VerifyArchive onBack={() => navigate("verify")} />}
      {screen === "settings" && (
        <Settings theme={theme} onThemeChange={setTheme} />
      )}
    </Layout>
  );
}
