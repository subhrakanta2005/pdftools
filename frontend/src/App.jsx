import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import HomePage from "./pages/HomePage";
import ToolPage from "./pages/ToolPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import PricingPage from "./pages/PricingPage";
import UserDashboard from "./pages/UserDashboard";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function AppInner() {
  const { loading } = useAuth();
  const [currentTool, setCurrentTool] = useState(null);
  const [page, setPage] = useState(() => {
    if (window.location.pathname === "/auth/callback") return "callback";
    if (window.location.pathname === "/pricing") return "pricing";
    if (window.location.pathname === "/forgot-password") return "forgot";
    if (window.location.pathname === "/reset-password") return "reset";
    return "home";
  });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ fontSize: 36 }}>⏳</div>
      </div>
    );
  }

  if (page === "callback") return <AuthCallbackPage onDone={() => { window.history.replaceState({}, "", "/"); setPage("home"); }} />;
  if (page === "login") return <LoginPage onSuccess={() => setPage("home")} onSwitchToRegister={() => setPage("register")} onForgotPassword={() => setPage("forgot")} onBack={() => setPage("home")} />;
  if (page === "register") return <RegisterPage onSuccess={() => setPage("home")} onSwitchToLogin={() => setPage("login")} onBack={() => setPage("home")} />;
  if (page === "forgot") return <ForgotPasswordPage onBack={() => { window.history.replaceState({}, "", "/"); setPage("login"); }} />;
  if (page === "reset") return <ResetPasswordPage onDone={() => { window.history.replaceState({}, "", "/"); setPage("login"); }} />;
  if (page === "pricing") return <PricingPage onBack={() => setPage("home")} onRegister={() => setPage("register")} />;
  if (page === "dashboard") return <UserDashboard onBack={() => setPage("home")} />;
  if (currentTool) return <ToolPage tool={currentTool} onBack={() => setCurrentTool(null)} />;

  return (
    <HomePage
      onSelectTool={setCurrentTool}
      onLogin={() => setPage("login")}
      onRegister={() => setPage("register")}
      onPricing={() => setPage("pricing")}
      onDashboard={() => setPage("dashboard")}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}
