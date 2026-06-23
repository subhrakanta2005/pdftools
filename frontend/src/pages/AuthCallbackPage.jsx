import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function AuthCallbackPage({ onDone }) {
  const { refetch } = useAuth();

  useEffect(() => {
    refetch().then(() => onDone?.());
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <p style={{ color: "#666" }}>Finishing sign-in…</p>
      </div>
    </div>
  );
}
