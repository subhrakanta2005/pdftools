import { useState } from "react";
import { TOOL_CATEGORIES, ALL_TOOLS } from "../tools";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

export default function HomePage({ onSelectTool, onLogin, onRegister, onPricing, onDashboard }) {
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
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav style={{ background: "var(--nav-bg)", borderBottom: "1px solid var(--nav-border)", padding: "0 2rem", display: "flex", alignItems: "center", height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 20, color: "#e63946" }}>
          <span style={{ fontSize: 24 }}>📄</span>
          PDFTools
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
          <span onClick={onPricing} style={{ cursor: "pointer", color: "var(--text-secondary)", fontWeight: 500, fontSize: 14 }}>Pricing</span>
          <ThemeToggle />
          {user ? (
            <>
              <div onClick={onDashboard} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                {user.avatar
                  ? <img src={user.avatar} alt={user.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                  : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e63946", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{user.name[0].toUpperCase()}</div>
                }
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{user.name.split(" ")[0]}</span>
              </div>
              <button onClick={logout} style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button onClick={onLogin} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
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
      <div style={{ background: "var(--nav-bg)", borderBottom: "1px solid var(--border)", padding: "0 2rem", overflowX: "auto" }}>
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
                color: activeCategory === cat.id ? "#fff" : "var(--text-secondary)",
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
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 10 }}>
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
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p>No tools found for "{search}"</p>
          </div>
        )}
      </div>

      {/* Work your way */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1rem 2rem 3rem" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: "1.5rem" }}>
          Work your way
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
          <WorkCard
            icon="⚡"
            title="Fast, in the browser"
            desc="No install, no account required for most tools. Upload a file and get your result in seconds."
          />
          <WorkCard
            icon="🔒"
            title="Private by default"
            desc="Files are processed and then removed — nothing sits around after your job is done."
          />
          <WorkCard
            icon="📈"
            title="Built to grow with you"
            desc="Start free, then unlock higher limits and priority processing as you need more."
            onClick={onPricing}
          />
        </div>
      </div>

      {/* Premium upsell */}
      <div style={{ padding: "0 2rem 3rem" }}>
        <div
          onClick={onPricing}
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            background: "linear-gradient(120deg, #1d3557 0%, #0d1b2a 100%)",
            borderRadius: 18,
            padding: "2.5rem 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1.5rem",
            cursor: "pointer",
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <div style={{ color: "#e63946", fontWeight: 800, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
              Premium
            </div>
            <h3 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>
              Get more out of PDFTools
            </h3>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, margin: 0, lineHeight: 1.6 }}>
              Higher file size limits, no wait between jobs, and priority processing on every tool.
            </p>
          </div>
          <button
            style={{
              padding: "12px 28px",
              borderRadius: 10,
              border: "none",
              background: "#e63946",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            See plans
          </button>
        </div>
      </div>

      {/* Cross-promo */}
      <div style={{ padding: "0 2rem 3rem" }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            border: "1.5px solid var(--border)",
            borderRadius: 16,
            padding: "1.75rem 2rem",
            display: "flex",
            alignItems: "center",
            gap: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 32 }}>🖼️</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 4 }}>
              Also working with images?
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Try our image toolkit — resize, compress, and convert images just as easily.
            </div>
          </div>
          <a
            href="https://pixly-umber.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Explore →
          </a>
        </div>
      </div>

      {/* Trust line */}
      <div style={{ textAlign: "center", padding: "0 2rem 3rem", color: "var(--text-muted)", fontSize: 13 }}>
        🔒 Files are processed securely and removed automatically — your documents stay private.
      </div>

      {/* Footer */}
      <footer style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", color: "var(--text-muted)", padding: "3rem 2rem 2rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(3, 1fr)", gap: "2rem", marginBottom: "2.5rem" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, color: "var(--text-primary)", marginBottom: 10 }}>📄 PDFTools</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, maxWidth: 260 }}>
                Process files locally. Your documents stay private.
              </p>
            </div>
            <FooterColumn
              title="Product"
              links={[
                { label: "All tools", onClick: () => setActiveCategory("all") },
                { label: "Pricing", onClick: onPricing },
                { label: "Dashboard", onClick: onDashboard },
              ]}
            />
            <FooterColumn
              title="Account"
              links={[
                { label: user ? "Sign out" : "Sign in", onClick: user ? logout : onLogin },
                ...(user ? [] : [{ label: "Sign up free", onClick: onRegister }]),
              ]}
            />
            <FooterColumn
              title="Legal"
              links={[
                { label: "Privacy policy", href: "#" },
                { label: "Terms & conditions", href: "#" },
              ]}
            />
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem", fontSize: 12.5, textAlign: "center" }}>
            © {new Date().getFullYear()} PDFTools
          </div>
        </div>
      </footer>
    </div>
  );
}

function WorkCard({ icon, title, desc, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: 14,
        padding: "1.5rem",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {links.map((l) => (
          l.href ? (
            <a key={l.label} href={l.href} style={{ fontSize: 13.5, color: "var(--text-muted)", textDecoration: "none" }}>{l.label}</a>
          ) : (
            <span key={l.label} onClick={l.onClick} style={{ fontSize: 13.5, color: "var(--text-muted)", cursor: "pointer" }}>{l.label}</span>
          )
        ))}
      </div>
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
        background: hover ? color : "var(--surface)",
        border: `2px solid ${hover ? color : "var(--border)"}`,
        borderRadius: 14,
        padding: "1.5rem 1.25rem",
        cursor: "pointer",
        transition: "all 0.18s",
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? `0 8px 24px ${color}33` : "var(--card-shadow)",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 10, color: hover ? "#fff" : color }}>{tool.icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: hover ? "#fff" : "var(--text-primary)", marginBottom: 6 }}>{tool.label}</div>
      <div style={{ fontSize: 12, color: hover ? "rgba(255,255,255,0.85)" : "var(--text-muted)", lineHeight: 1.5 }}>{tool.desc}</div>
    </div>
  );
}


