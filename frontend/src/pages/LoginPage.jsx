import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function LoginPage({ onSuccess, onSwitchToRegister, onForgotPassword, onBack }) {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <button onClick={onBack} style={styles.backBtn}>← Back to home</button>
      <div style={styles.card}>
        <div style={styles.logo}>📄 PDFTools</div>
        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.sub}>Sign in to your account</p>

        <button onClick={loginWithGoogle} style={styles.googleBtn}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div style={styles.divider}><span>or</span></div>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <div style={styles.labelRow}>
              <label style={styles.label}>Password</label>
              {onForgotPassword && (
                <span onClick={onForgotPassword} style={styles.forgotLink}>Forgot password?</span>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={styles.switch}>
          Don't have an account?{" "}
          <span onClick={onSwitchToRegister} style={styles.link}>Create one</span>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 10 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

const styles = {
  overlay: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f7f8fc", padding: "1rem", position: "relative" },
  backBtn: { position: "absolute", top: 24, left: 24, background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#666", display: "flex", alignItems: "center", gap: 6 },
  card: { background: "#fff", borderRadius: 20, padding: "2.5rem", width: "100%", maxWidth: 420, boxShadow: "0 4px 32px rgba(0,0,0,0.08)" },
  logo: { fontWeight: 900, fontSize: 22, color: "#e63946", marginBottom: "1.5rem", textAlign: "center" },
  title: { fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: "0 0 4px", textAlign: "center" },
  sub: { color: "#888", fontSize: 14, margin: "0 0 1.5rem", textAlign: "center" },
  googleBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px", border: "1.5px solid #dde", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#333", marginBottom: "1.5rem" },
  divider: { textAlign: "center", color: "#bbb", fontSize: 13, marginBottom: "1.5rem", position: "relative", borderTop: "1px solid #eee", lineHeight: 0 },
  field: { marginBottom: "1rem" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 },
  labelRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  forgotLink: { fontSize: 13, fontWeight: 600, color: "#e63946", cursor: "pointer", marginBottom: 6 },
  input: { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #dde", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  error: { background: "#fff0f0", border: "1px solid #fcc", borderRadius: 8, padding: "10px 14px", color: "#c33", fontSize: 13, marginBottom: "1rem" },
  submitBtn: { width: "100%", padding: "13px", borderRadius: 10, border: "none", background: "#e63946", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  switch: { textAlign: "center", fontSize: 14, color: "#777", marginTop: "1.5rem" },
  link: { color: "#e63946", fontWeight: 600, cursor: "pointer" },
};
