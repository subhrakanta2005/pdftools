import { useState } from "react";
import { TOOL_CATEGORIES, ALL_TOOLS } from "../tools";
import { useAuth } from "../context/AuthContext";

export default function HomePage({ onSelectTool, onLogin, onRegister }) {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = ALL_TOOLS.filter((t) => {
    const matchSearch = t.label.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || t.category === activeCategory;
    return matchSearch && matchCat;
  });

  const groupedFiltered = TOOL_CATEGORIES.map((cat) => ({
    ...cat,
    tools: filtered.filter((t) => t.category === cat.id),
  })).filter((cat) => cat.tools.length > 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fc", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e8eaf0", padding: "0 2rem", display: "flex", alignItems: "center", height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 20, color: "#e63946" }}>
          <span style={{ fontSize: 24 }}>📄</span>
          PDFTools
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
          {user ? (
            <>
              {user.avatar
                ? <img src={user.avatar} alt={user.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e63946", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{user.name[0].toUpperCase()}</div>
              }
              <span style={{ color: "#333", fontWeight: 600 }}>{user.name.split(" ")[0]}</span>
              <button onClick={logout} style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid #dde", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#555" }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button onClick={onLogin} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#555" }}>
                Sign in
              </button>
              <button onClick={onRegister} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#e63946", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                Sign up free
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #e63946 0%, #c1121f 100%)", padding: "60px 2rem", textAlign: "center", color: "#fff" }}>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, margin: "0 0 12px", letterSpacing: "-1px" }}>
          Every PDF tool you need
        </h1>
        <p style={{ fontSize: 18, opacity: 0.9, margin: "0 0 32px", fontWeight: 400 }}>
          25+ tools to edit, convert, compress, and organize your PDFs. 100% free.
        </p>
        <div style={{ maxWidth: 520, margin: "0 auto", position: "relative" }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 18, opacity: 0.5 }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools… (merge, convert, compress)"
            style={{
              width: "100%",
              padding: "14px 18px 14px 46px",
              borderRadius: 12,
              border: "none",
              fontSize: 16,
              boxSizing: "border-box",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Category filter */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8eaf0", padding: "0 2rem", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 4, minWidth: "max-content", padding: "8px 0" }}>
          {[{ id: "all", label: "All Tools", color: "#666" }, ...TOOL_CATEGORIES].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: "8px 18px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                background: activeCategory === cat.id ? cat.color || "#e63946" : "transparent",
                color: activeCategory === cat.id ? "#fff" : "#555",
                transition: "all 0.15s",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tool grid */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
        {groupedFiltered.map((cat) => (
          <div key={cat.id} style={{ marginBottom: "3rem" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 4, height: 20, background: cat.color, borderRadius: 2, display: "inline-block" }} />
              {cat.label}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
              {cat.tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} color={cat.color} onClick={() => onSelectTool(tool)} />
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem", color: "#999" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p>No tools found for "{search}"</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ background: "#1a1a2e", color: "#aaa", padding: "3rem 2rem", textAlign: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 8 }}>📄 PDFTools</div>
        <p style={{ margin: 0, fontSize: 14 }}>Process files locally. Your documents stay private.</p>
      </footer>
    </div>
  );
}

function ToolCard({ tool, color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? color : "#fff",
        border: `2px solid ${hover ? color : "#e8eaf0"}`,
        borderRadius: 14,
        padding: "1.5rem 1.25rem",
        cursor: "pointer",
        transition: "all 0.18s",
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? `0 8px 24px ${color}33` : "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 10, color: hover ? "#fff" : color }}>{tool.icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: hover ? "#fff" : "#1a1a2e", marginBottom: 6 }}>{tool.label}</div>
      <div style={{ fontSize: 12, color: hover ? "rgba(255,255,255,0.85)" : "#888", lineHeight: 1.5 }}>{tool.desc}</div>
    </div>
  );
}
