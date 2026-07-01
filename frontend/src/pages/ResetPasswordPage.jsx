import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || "";
}

export default function ResetPasswordPage({ onDone }) {
  const [token] = useState(getTokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is invalid or incomplete. Please request a new one.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Something went wrong. Please try again.");
      }
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.logo}>📄 PDFTools</div>
        <h2 style={styles.title}>Set a new password</h2>

        {success ? (
          <>
            <div style={styles.success}>
              Your password has been reset successfully.
            </div>
            <button onClick={onDone} style={styles.submitBtn}>Back to sign in</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={styles.field}>
              <label style={styles.label}>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                style={styles.input}
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? "Resetting…" : "Reset password"}
            </button>
          </form>
        )}

        {!success && (
          <p style={styles.switch}>
            <span onClick={onDone} style={styles.link}>Back to sign in</span>
          </p>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f7f8fc", padding: "1rem" },
  card: { background: "#fff", borderRadius: 20, padding: "2.5rem", width: "100%", maxWidth: 420, boxShadow: "0 4px 32px rgba(0,0,0,0.08)" },
  logo: { fontWeight: 900, fontSize: 22, color: "#e63946", marginBottom: "1.5rem", textAlign: "center" },
  title: { fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: "0 0 4px", textAlign: "center" },
  field: { marginBottom: "1rem" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 },
  input: { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #dde", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  error: { background: "#fff0f0", border: "1px solid #fcc", borderRadius: 8, padding: "10px 14px", color: "#c33", fontSize: 13, marginBottom: "1rem" },
  success: { background: "#f0fff4", border: "1px solid #b7e4c7", borderRadius: 8, padding: "14px", color: "#1b4332", fontSize: 14, marginBottom: "1rem", lineHeight: 1.5 },
  submitBtn: { width: "100%", padding: "13px", borderRadius: 10, border: "none", background: "#e63946", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  switch: { textAlign: "center", fontSize: 14, color: "#777", marginTop: "1.5rem" },
  link: { color: "#e63946", fontWeight: 600, cursor: "pointer" },
};
