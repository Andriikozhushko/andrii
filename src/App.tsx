import { useState } from "react";
import type { Screen } from "./types";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import CreateArchive from "./pages/CreateArchive";
import OpenArchive from "./pages/OpenArchive";
import VerifyArchive from "./pages/VerifyArchive";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);

  const navigate = (s: Screen) => setScreen(s);

  const handleDragToCreate = (files: string[]) => {
    setPendingFiles(files);
    setScreen("create");
  };

  const handleCreateBack = () => {
    setPendingFiles([]);
    navigate("home");
  };

  return (
    <Layout screen={screen} onNavigate={navigate}>
      {screen === "home" && (
        <Home onNavigate={navigate} onNavigateWithFiles={handleDragToCreate} />
      )}
      {screen === "create" && (
        <CreateArchive onBack={handleCreateBack} initialFiles={pendingFiles} />
      )}
      {screen === "open" && <OpenArchive onBack={() => navigate("home")} />}
      {screen === "verify" && <VerifyArchive onBack={() => navigate("home")} />}
    </Layout>
  );
}
