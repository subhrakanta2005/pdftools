import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const PLANS = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    popular: false,
    cta: "Get started",
    ctaPrimary: false,
    features: [
      { text: "10 PDF tools", included: true },
      { text: "5 MB file size limit", included: true },
      { text: "5 operations per day", included: true },
      { text: "Email/Google sign-in", included: true },
      { text: "3 batch operations per day", included: true },
      { text: "OCR support (3 pages/file)", included: true },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 349,
    yearly: 279,
    popular: true,
    cta: "Start free trial",
    ctaPrimary: true,
    features: [
      { text: "All 25+ PDF tools", included: true },
      { text: "50 MB file size limit", included: true },
      { text: "100 operations per day", included: true },
      { text: "OCR (scanned PDFs)", included: true },
      { text: "Batch processing", included: true },
      { text: "Google Drive integration", included: true },
    ],
  },
  {
    id: "team",
    name: "Team",
    monthly: 899,
    yearly: 719,
    popular: false,
    cta: "Start free trial",
    ctaPrimary: false,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "200 MB file size limit", included: true },
      { text: "Unlimited operations", included: true },
      { text: "Up to 10 team members", included: true },
      { text: "Admin dashboard", included: true },
      { text: "API access", included: true },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: null,
    yearly: null,
    popular: false,
    cta: "Contact sales",
    ctaPrimary: false,
    features: [
      { text: "Everything in Team", included: true },
      { text: "Unlimited file size", included: true },
      { text: "Unlimited members", included: true },
      { text: "SSO / SAML", included: true },
      { text: "SLA guarantee", included: true },
      { text: "Dedicated support", included: true },
    ],
  },
];

const COMPARE_ROWS = [
  { label: "PDF tools access", values: ["10 tools", "All 25+", "All 25+", "All 25+"] },
  { label: "File size limit", values: ["5 MB", "50 MB", "200 MB", "Unlimited"] },
  { label: "Daily operations", values: ["5/day", "100/day", "Unlimited", "Unlimited"] },
  { label: "Batch processing", values: ["3/day", true, true, true] },
  { label: "OCR (scanned PDFs)", values: ["3 pages/file", true, true, true] },
  { label: "Google Drive", values: [false, true, true, true] },
  { label: "Priority processing", values: [false, true, true, true] },
  { label: "Team members", values: ["1", "1", "Up to 10", "Unlimited"] },
  { label: "Admin dashboard", values: [false, false, true, true] },
  { label: "API access", values: [false, false, true, true] },
  { label: "SSO / SAML", values: [false, false, false, true] },
  { label: "SLA guarantee", values: [false, false, false, true] },
  { label: "Support", values: ["Community", "Email", "Priority email", "Dedicated"] },
];

const FAQS = [
  {
    q: "Can I switch plans anytime?",
    a: "Yes — upgrade or downgrade at any time. If you upgrade mid-cycle, we'll prorate the difference. Downgrades take effect at the next billing date.",
  },
  {
    q: "Is my data safe?",
    a: "All files are processed on our servers and deleted within 2 hours. We never store your PDFs permanently or share them with third parties.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit/debit cards and UPI via Razorpay. Enterprise customers can also pay by bank transfer (NEFT/RTGS).",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a 7-day money-back guarantee on all paid plans. No questions asked.",
  },
  {
    q: "What happens when I hit my daily limit?",
    a: "Your quota resets at midnight IST. You can also upgrade instantly to continue without waiting.",
  },
];

export default function PricingPage({ onBack, onRegister }) {
  const { user } = useAuth();
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const price = (plan) => {
    if (plan.monthly === null) return "Custom";
    if (plan.monthly === 0) return "₹0";
    return `₹${yearly ? plan.yearly : plan.monthly}`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fc", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e8eaf0", padding: "0 2rem", display: "flex", alignItems: "center", height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#666", display: "flex", alignItems: "center", gap: 6 }}>
          ← All Tools
        </button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 18, color: "#e63946" }}>
          📄 PDFTools
        </div>
        <div style={{ width: 100 }} />
      </nav>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "3.5rem 2rem 2rem" }}>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, color: "#1a1a2e", marginBottom: 10, letterSpacing: "-0.5px" }}>
          Simple, transparent pricing
        </h1>
        <p style={{ color: "#666", fontSize: 17 }}>Start free. Upgrade when you need more.</p>

        {/* Billing toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 24 }}>
          <span style={{ fontSize: 14, color: yearly ? "#999" : "#1a1a2e", fontWeight: yearly ? 400 : 600 }}>Monthly</span>
          <div
            onClick={() => setYearly(!yearly)}
            style={{ width: 44, height: 24, borderRadius: 12, background: "#e63946", position: "relative", cursor: "pointer", transition: "background .2s" }}
          >
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: yearly ? 23 : 3, transition: "left .2s" }} />
          </div>
          <span style={{ fontSize: 14, color: yearly ? "#1a1a2e" : "#999", fontWeight: yearly ? 600 : 400 }}>
            Yearly{" "}
            <span style={{ background: "#e8f5e9", color: "#2e7d32", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, marginLeft: 4 }}>
              Save 20%
            </span>
          </span>
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem 2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} yearly={yearly} price={price(plan)} user={user} onRegister={onRegister} />
        ))}
      </div>

      {/* Compare table */}
      <div style={{ maxWidth: 1000, margin: "0 auto 4rem", padding: "0 1.5rem" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", textAlign: "center", marginBottom: "1.5rem" }}>
          Compare all features
        </h2>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8eaf0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f7f8fc" }}>
                <th style={{ textAlign: "left", padding: "12px 20px", color: "#888", fontWeight: 600 }}>Feature</th>
                {PLANS.map((p) => (
                  <th key={p.id} style={{ textAlign: "center", padding: "12px 16px", color: p.popular ? "#e63946" : "#888", fontWeight: 600 }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid #f0f0f5" }}>
                  <td style={{ padding: "11px 20px", color: "#444", fontWeight: 500 }}>{row.label}</td>
                  {row.values.map((v, j) => (
                    <td key={j} style={{ textAlign: "center", padding: "11px 16px", color: "#333" }}>
                      {typeof v === "boolean" ? (
                        v ? <span style={{ color: "#e63946", fontSize: 18 }}>✓</span>
                          : <span style={{ color: "#ccc", fontSize: 16 }}>✕</span>
                      ) : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 680, margin: "0 auto 5rem", padding: "0 1.5rem" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", textAlign: "center", marginBottom: "1.5rem" }}>
          Frequently asked questions
        </h2>
        {FAQS.map((faq, i) => (
          <div
            key={i}
            style={{ borderBottom: "1px solid #e8eaf0", padding: "1rem 0", cursor: "pointer" }}
            onClick={() => setOpenFaq(openFaq === i ? null : i)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
              {faq.q}
              <span style={{ fontSize: 20, color: "#999", transform: openFaq === i ? "rotate(45deg)" : "none", transition: "transform .2s", display: "inline-block" }}>+</span>
            </div>
            {openFaq === i && (
              <p style={{ marginTop: 10, color: "#666", fontSize: 14, lineHeight: 1.7 }}>{faq.a}</p>
            )}
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div style={{ background: "linear-gradient(135deg, #e63946, #c1121f)", padding: "3.5rem 2rem", textAlign: "center", color: "#fff" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 10 }}>Ready to get started?</h2>
        <p style={{ opacity: 0.9, marginBottom: 24 }}>Join thousands of users who process PDFs with PDFTools every day.</p>
        <button
          onClick={onRegister}
          style={{ padding: "14px 36px", borderRadius: 12, border: "none", background: "#fff", color: "#e63946", fontSize: 16, fontWeight: 800, cursor: "pointer" }}
        >
          Start for free →
        </button>
      </div>
    </div>
  );
}

function PlanCard({ plan, price, user, onRegister }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff",
        border: plan.popular ? "2px solid #e63946" : "1px solid #e8eaf0",
        borderRadius: 16,
        padding: "1.75rem 1.5rem",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxShadow: hover ? "0 8px 32px rgba(230,57,70,0.12)" : "none",
        transition: "box-shadow .2s",
      }}
    >
      {plan.popular && (
        <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "#e63946", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>
          Most popular
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
        {plan.name}
      </div>

      <div style={{ fontSize: 32, fontWeight: 900, color: "#1a1a2e", lineHeight: 1 }}>{price}</div>
      <div style={{ fontSize: 12, color: "#aaa", marginTop: 4, marginBottom: "1.5rem" }}>
        {plan.monthly === null ? "contact us for a quote" : plan.monthly === 0 ? "forever free" : `per month`}
      </div>

      <button
        onClick={user ? undefined : onRegister}
        style={{
          padding: "11px",
          borderRadius: 10,
          border: plan.ctaPrimary ? "none" : "1.5px solid #dde",
          background: plan.ctaPrimary ? "#e63946" : "transparent",
          color: plan.ctaPrimary ? "#fff" : "#333",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          marginBottom: "1.5rem",
        }}
      >
        {plan.cta}
      </button>

      <hr style={{ border: "none", borderTop: "1px solid #f0f0f5", marginBottom: "1.25rem" }} />

      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: f.included ? "#444" : "#bbb" }}>
            <span style={{ color: f.included ? "#e63946" : "#ddd", fontSize: 16, lineHeight: 1.2, flexShrink: 0 }}>
              {f.included ? "✓" : "✕"}
            </span>
            {f.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
