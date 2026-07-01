import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

const PLAN_COLORS = { free: "#888", pro: "#e63946", team: "#457b9d", enterprise: "#6a4c93" };
const PLAN_LABELS = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise" };

const UPGRADES = [
  { plan: "pro", label: "Pro", monthly: 349, yearly: 279, color: "#e63946", features: ["All 25+ tools", "50 MB files", "100 ops/day", "OCR", "Batch", "Drive"] },
  { plan: "team", label: "Team", monthly: 899, yearly: 719, color: "#457b9d", features: ["Everything in Pro", "200 MB files", "Unlimited ops", "10 members", "API access"] },
];

export default function UserDashboard({ onBack }) {
  const { user, refetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [billing, setBilling] = useState("monthly");
  const [paying, setPaying] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  const plan = user?.plan || "free";
  const planColor = PLAN_COLORS[plan] || "#888";

  useEffect(() => {
    fetch(`${API}/payments/status`, { credentials: "include" })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handleUpgrade = async (targetPlan) => {
    setPaying(targetPlan);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Razorpay failed to load");

      const res = await fetch(`${API}/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: targetPlan, billing }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.detail || "Order creation failed");

      const rzp = new window.Razorpay({
        key: order.key_id || RAZORPAY_KEY,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "PDFTools",
        description: `${PLAN_LABELS[targetPlan]} Plan — ${billing}`,
        prefill: { name: user.name, email: user.email },
        theme: { color: "#e63946" },
        handler: async (response) => {
          const verify = await fetch(`${API}/payments/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: targetPlan,
              billing,
            }),
          });
          const result = await verify.json();
          if (result.success) {
            await refetch();
            setSuccessMsg(`You're now on the ${PLAN_LABELS[targetPlan]} plan! 🎉`);
          }
        },
        modal: { ondismiss: () => setPaying(null) },
      });
      rzp.open();
    } catch (err) {
      alert(err.message);
    } finally {
      setPaying(null);
    }
  };

  const todayOps = user?.daily_usage
    ? Object.values(user.daily_usage).at(-1) || 0
    : 0;

  const dailyLimit = { free: 5, pro: 100, team: null, enterprise: null }[plan];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fc", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e8eaf0", padding: "0 2rem", display: "flex", alignItems: "center", height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#666" }}>← Back</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 18, color: "#e63946" }}>📄 My Dashboard</div>
        <div style={{ width: 80 }} />
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {successMsg && (
          <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 12, padding: "14px 20px", color: "#2e7d32", fontWeight: 600, marginBottom: "1.5rem", fontSize: 15 }}>
            ✅ {successMsg}
          </div>
        )}

        {/* Profile + plan card */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8eaf0", padding: "1.75rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          {user?.avatar
            ? <img src={user.avatar} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
            : <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e63946", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800 }}>{user?.name?.[0]?.toUpperCase()}</div>
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e" }}>{user?.name}</div>
            <div style={{ fontSize: 14, color: "#888" }}>{user?.email}</div>
            <div style={{ marginTop: 8 }}>
              <span style={{ background: planColor + "22", color: planColor, fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20, border: `1px solid ${planColor}55` }}>
                {PLAN_LABELS[plan]} plan
              </span>
              {stats?.expires_at && (
                <span style={{ fontSize: 12, color: "#aaa", marginLeft: 10 }}>
                  Renews {new Date(stats.expires_at).toLocaleDateString("en-IN")}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#1a1a2e" }}>{user?.usage_count || 0}</div>
            <div style={{ fontSize: 12, color: "#888" }}>total operations</div>
          </div>
        </div>

        {/* Usage today */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8eaf0", padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e", marginBottom: "1rem" }}>Today's usage</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", marginBottom: 6 }}>
                <span>{todayOps} operations used</span>
                <span>{dailyLimit ? `${dailyLimit} limit` : "Unlimited"}</span>
              </div>
              <div style={{ height: 8, background: "#f0f0f5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: dailyLimit ? `${Math.min(100, (todayOps / dailyLimit) * 100)}%` : "20%",
                  background: dailyLimit && todayOps >= dailyLimit ? "#e63946" : "#4caf50",
                  borderRadius: 4,
                  transition: "width .4s",
                }} />
              </div>
            </div>
            {dailyLimit && todayOps >= dailyLimit && (
              <span style={{ fontSize: 12, color: "#e63946", fontWeight: 600 }}>Limit reached</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>Resets at midnight IST</div>
        </div>

        {/* Upgrade section — only show if not enterprise */}
        {plan !== "enterprise" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8eaf0", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>Upgrade your plan</div>
              <div style={{ display: "flex", background: "#f0f0f5", borderRadius: 8, padding: 3, gap: 2 }}>
                {["monthly", "yearly"].map((b) => (
                  <button key={b} onClick={() => setBilling(b)} style={{
                    padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: billing === b ? "#fff" : "transparent",
                    color: billing === b ? "#1a1a2e" : "#888",
                    boxShadow: billing === b ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  }}>
                    {b === "yearly" ? "Yearly (−20%)" : "Monthly"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {UPGRADES.filter((u) => {
                if (plan === "free") return true;
                if (plan === "pro") return u.plan === "team";
                return false;
              }).map((u) => (
                <div key={u.plan} style={{ border: `2px solid ${u.color}`, borderRadius: 14, padding: "1.25rem" }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: u.color, marginBottom: 4 }}>{u.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#1a1a2e", marginBottom: 2 }}>
                    ₹{billing === "yearly" ? u.yearly : u.monthly}
                    <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>/mo</span>
                  </div>
                  {billing === "yearly" && <div style={{ fontSize: 11, color: "#4caf50", fontWeight: 600, marginBottom: 10 }}>billed ₹{u.yearly * 12}/yr</div>}
                  <ul style={{ listStyle: "none", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: 5 }}>
                    {u.features.map((f) => (
                      <li key={f} style={{ fontSize: 13, color: "#555", display: "flex", gap: 7 }}>
                        <span style={{ color: u.color }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(u.plan)}
                    disabled={paying === u.plan}
                    style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: u.color, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                  >
                    {paying === u.plan ? "Opening payment…" : `Upgrade to ${u.label}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
