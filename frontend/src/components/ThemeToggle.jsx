import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "1.5px solid",
        borderColor: dark ? "#555" : "#dde",
        background: dark ? "#333" : "#f0f0f5",
        position: "relative",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        padding: "0 3px",
        transition: "background .2s, border-color .2s",
        flexShrink: 0,
      }}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Track icons */}
      <span style={{ position: "absolute", left: 4, fontSize: 10, opacity: dark ? 0 : 1, transition: "opacity .2s" }}>☀️</span>
      <span style={{ position: "absolute", right: 4, fontSize: 10, opacity: dark ? 1 : 0, transition: "opacity .2s" }}>🌙</span>
      {/* Thumb */}
      <div style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: dark ? "#e2e8f0" : "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transform: dark ? "translateX(18px)" : "translateX(0px)",
        transition: "transform .2s, background .2s",
        position: "relative",
        zIndex: 1,
      }} />
    </button>
  );
}
