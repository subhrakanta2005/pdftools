import { useState, useRef, useEffect } from "react";
import ThemeToggle from "../components/ThemeToggle";
import { renderPdfThumbnail } from "../lib/pdfjs";
import PageOrganizer from "../components/PageOrganizer";
import CropSelector from "../components/CropSelector";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function ToolPage({ tool, onBack }) {
  const [files, setFiles] = useState([]);
  const [fields, setFields] = useState(() => Object.fromEntries(tool.fields.map((f) => [f.name, f.placeholder || ""])));
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadName, setDownloadName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef();
  const missingRequiredFile = tool.fields.some((f) => f.type === "file" && !fields[f.name]);
  const missingPageSelection = tool.fields.some((f) => f.type === "pageSelect" && !fields[f.name]);
  const [thumbs, setThumbs] = useState({}); // fileKey -> { url, kind: "image"|"pdf"|"none", loading }

  const fileKey = (f) => `${f.name}_${f.size}_${f.lastModified}`;

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    files.forEach((f) => {
      const key = fileKey(f);
      if (thumbs[key]) return; // already have (or are building) a thumbnail

      if (f.type.startsWith("image/")) {
        const url = URL.createObjectURL(f);
        objectUrls.push(url);
        setThumbs((prev) => ({ ...prev, [key]: { url, kind: "image", loading: false } }));
      } else if (f.type === "application/pdf") {
        setThumbs((prev) => ({ ...prev, [key]: { url: null, kind: "pdf", loading: true } }));
        renderPdfThumbnail(f)
          .then((dataUrl) => {
            if (!cancelled) setThumbs((prev) => ({ ...prev, [key]: { url: dataUrl, kind: "pdf", loading: false } }));
          })
          .catch(() => {
            if (!cancelled) setThumbs((prev) => ({ ...prev, [key]: { url: null, kind: "pdf", loading: false } }));
          });
      } else {
        setThumbs((prev) => ({ ...prev, [key]: { url: null, kind: "none", loading: false } }));
      }
    });

    return () => {
      cancelled = true;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFiles = (newFiles) => {
    if (tool.multiFile) {
      setFiles((prev) => [...prev, ...Array.from(newFiles)]);
    } else {
      setFiles([newFiles[0]]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setStatus("uploading");
    setError("");
    setDownloadUrl(null);

    try {
      const form = new FormData();
      if (tool.multiFile) {
        files.forEach((f) => form.append("files", f));
      } else {
        form.append("file", files[0]);
      }
      Object.entries(fields).forEach(([k, v]) => {
        if (v) form.append(k, v); // works for both text values and File objects
      });

      const res = await fetch(`${API}${tool.endpoint}`, { method: "POST", body: form });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Server error" }));
        throw new Error(err.detail || "Processing failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const name = match ? match[1] : `output_${tool.id}`;

      setDownloadUrl(url);
      setDownloadName(name);
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const reset = () => {
    setFiles([]);
    setThumbs({});
    setStatus("idle");
    setError("");
    setDownloadUrl(null);
    setFields(Object.fromEntries(tool.fields.map((f) => [f.name, f.placeholder || ""])));
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav style={{ background: "var(--nav-bg)", borderBottom: "1px solid var(--border)", padding: "0 2rem", display: "flex", alignItems: "center", height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8 }}
        >
          ← All Tools
        </button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
          {tool.icon} {tool.label}
        </div>
        <ThemeToggle />
      </nav>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${tool.color} 0%, ${tool.color}cc 100%)`, padding: "40px 2rem", textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{tool.icon}</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.5px" }}>{tool.label}</h1>
        <p style={{ opacity: 0.9, margin: 0, fontSize: 16 }}>{tool.desc}</p>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
        {status === "done" ? (
          <DoneCard downloadUrl={downloadUrl} downloadName={downloadName} onReset={reset} color={tool.color} />
        ) : (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current.click()}
              style={{
                border: `2px dashed ${isDragging ? tool.color : "#ccd"}`,
                borderRadius: 16,
                padding: "3rem 2rem",
                textAlign: "center",
                cursor: "pointer",
                background: isDragging ? `${tool.color}11` : "#fff",
                transition: "all 0.15s",
                marginBottom: "1.5rem",
              }}
            >
              <input
                ref={inputRef}
                type="file"
                multiple={tool.multiFile}
                accept={tool.accepts}
                style={{ display: "none" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
              {files.length === 0 ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "#1a1a2e", marginBottom: 6 }}>
                    {tool.multiFile ? "Select files or drag & drop" : "Select a file or drag & drop"}
                  </div>
                  <div style={{ color: "#888", fontSize: 14 }}>Accepts: {tool.accepts}</div>
                </>
              ) : (
                <div onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
                    {files.map((f, i) => {
                      const thumb = thumbs[fileKey(f)];
                      return (
                        <div
                          key={fileKey(f) + i}
                          style={{
                            position: "relative",
                            width: 130,
                            background: "#fff",
                            border: "1px solid #e8eaf0",
                            borderRadius: 10,
                            overflow: "hidden",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                          }}
                        >
                          <button
                            onClick={() => removeFile(i)}
                            title="Remove file"
                            style={{
                              position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                              border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 13,
                              lineHeight: "22px", textAlign: "center", cursor: "pointer", zIndex: 2, padding: 0,
                            }}
                          >
                            ✕
                          </button>
                          <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f9", overflow: "hidden" }}>
                            {thumb?.loading ? (
                              <div style={{ fontSize: 13, color: "#999" }}>Loading…</div>
                            ) : thumb?.url ? (
                              <img src={thumb.url} alt={f.name} style={{ width: "100%", height: "100%", objectFit: thumb.kind === "image" ? "cover" : "contain" }} />
                            ) : (
                              <div style={{ fontSize: 40 }}>📄</div>
                            )}
                          </div>
                          <div style={{ padding: "8px 10px", fontSize: 12, color: "#333", wordBreak: "break-word", lineHeight: 1.3 }}>
                            {f.name.length > 26 ? f.name.slice(0, 24) + "…" : f.name}
                            <div style={{ color: "#999", marginTop: 2 }}>{(f.size / 1024).toFixed(0)} KB</div>
                          </div>
                        </div>
                      );
                    })}
                    {tool.multiFile && (
                      <div
                        onClick={() => inputRef.current.click()}
                        style={{
                          width: 130, height: 150 + 42, borderRadius: 10, border: `2px dashed ${tool.color}55`,
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", color: tool.color, fontWeight: 700, fontSize: 13, gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 26 }}>＋</span>
                        Add more
                      </div>
                    )}
                  </div>
                  {!tool.multiFile && (
                    <div
                      onClick={() => inputRef.current.click()}
                      style={{ color: tool.color, fontSize: 13, marginTop: 14, cursor: "pointer", fontWeight: 600, textAlign: "center" }}
                    >
                      Click to change file
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fields */}
            {tool.fields.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", border: "1px solid #e8eaf0", marginBottom: "1.5rem" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>Options</h3>
                {tool.fields.map((field) => (
                  <div key={field.name} style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#444", marginBottom: 6 }}>
                      {field.label}
                    </label>
                    {field.type === "cropSelect" ? (
                      files.length > 0 ? (
                        <CropSelector
                          key={fileKey(files[0])}
                          file={files[0]}
                          color={tool.color}
                          onChange={({ x1, y1, x2, y2 }) => setFields((p) => ({ ...p, x1, y1, x2, y2 }))}
                        />
                      ) : (
                        <div style={{ color: "#999", fontSize: 13 }}>Upload a PDF above to select a crop area.</div>
                      )
                    ) : field.type === "pageSelect" || field.type === "pageReorder" ? (
                      files.length > 0 ? (
                        <PageOrganizer
                          key={fileKey(files[0])}
                          file={files[0]}
                          mode={field.type === "pageSelect" ? "select" : "reorder"}
                          color={tool.color}
                          selectLabel={field.type === "pageSelect" ? "Click pages to select them" : undefined}
                          onChange={(value) => setFields((p) => ({ ...p, [field.name]: value }))}
                        />
                      ) : (
                        <div style={{ color: "#999", fontSize: 13 }}>Upload a PDF above to see its pages here.</div>
                      )
                    ) : field.type === "select" ? (
                      <select
                        value={fields[field.name]}
                        onChange={(e) => setFields((p) => ({ ...p, [field.name]: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #dde", fontSize: 14, outline: "none" }}
                      >
                        {field.options.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        value={fields[field.name]}
                        placeholder={field.placeholder}
                        rows={5}
                        onChange={(e) => setFields((p) => ({ ...p, [field.name]: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #dde", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box", resize: "vertical" }}
                      />
                    ) : field.type === "file" ? (
                      <input
                        type="file"
                        accept={field.accepts}
                        onChange={(e) => setFields((p) => ({ ...p, [field.name]: e.target.files[0] || "" }))}
                        style={{ width: "100%", fontSize: 14 }}
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={fields[field.name]}
                        placeholder={field.placeholder}
                        onChange={(e) => setFields((p) => ({ ...p, [field.name]: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #dde", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 10, padding: "12px 16px", color: "#c33", marginBottom: "1rem", fontSize: 14 }}>
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={files.length === 0 || missingRequiredFile || missingPageSelection || status === "uploading"}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 12,
                border: "none",
                background: files.length === 0 || missingRequiredFile || missingPageSelection ? "#ccc" : tool.color,
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: files.length === 0 || missingRequiredFile || missingPageSelection ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
            >
              {status === "uploading" ? "⏳ Processing…" : `${tool.label} →`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DoneCard({ downloadUrl, downloadName, onReset, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "3rem 2rem", textAlign: "center", border: "1px solid #e8eaf0", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontWeight: 800, fontSize: 24, color: "#1a1a2e", marginBottom: 8 }}>Done!</h2>
      <p style={{ color: "#777", marginBottom: 28 }}>Your file has been processed successfully.</p>
      <a
        href={downloadUrl}
        download={downloadName}
        style={{
          display: "inline-block",
          background: color,
          color: "#fff",
          padding: "14px 32px",
          borderRadius: 12,
          fontWeight: 700,
          fontSize: 16,
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        ⬇ Download {downloadName}
      </a>
      <br />
      <button
        onClick={onReset}
        style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 14, marginTop: 8 }}
      >
        ← Process another file
      </button>
    </div>
  );
}
