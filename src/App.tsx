import { useState } from "react";
import type { Screen } from "./types";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import CreateArchive from "./pages/CreateArchive";
import OpenArchive from "./pages/OpenArchive";
import VerifyArchive from "./pages/VerifyArchive";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");

  const navigate = (s: Screen) => setScreen(s);

  return (
    <Layout screen={screen} onNavigate={navigate}>
      {screen === "home" && <Home onNavigate={navigate} />}
      {screen === "create" && <CreateArchive onBack={() => navigate("home")} />}
      {screen === "open" && <OpenArchive onBack={() => navigate("home")} />}
      {screen === "verify" && <VerifyArchive onBack={() => navigate("home")} />}
    </Layout>
  );
}
