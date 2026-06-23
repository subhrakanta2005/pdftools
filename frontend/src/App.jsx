import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import HomePage from "./pages/HomePage";
import ToolPage from "./pages/ToolPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";

function AppInner() {
  const { user, loading } = useAuth();
  const [currentTool, setCurrentTool] = useState(null);
  const [page, setPage] = useState(() => {
    // detect Google OAuth callback
    if (window.location.pathname === "/auth/callback") return "callback";
    return "home";
  });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ fontSize: 36 }}>⏳</div>
      </div>
    );
  }

  if (page === "callback") {
    return <AuthCallbackPage onDone={() => { window.history.replaceState({}, "", "/"); setPage("home"); }} />;
  }

  if (page === "login") {
    return <LoginPage onSuccess={() => setPage("home")} onSwitchToRegister={() => setPage("register")} />;
  }

  if (page === "register") {
    return <RegisterPage onSuccess={() => setPage("home")} onSwitchToLogin={() => setPage("login")} />;
  }

  if (currentTool) {
    return <ToolPage tool={currentTool} onBack={() => setCurrentTool(null)} />;
  }

  return (
    <HomePage
      onSelectTool={setCurrentTool}
      onLogin={() => setPage("login")}
      onRegister={() => setPage("register")}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
