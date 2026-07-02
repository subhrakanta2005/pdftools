import { useEffect, useRef, useState } from "react";
import { renderAllPageThumbnails } from "../lib/pdfjs";

// Collapses a sorted list of 1-indexed page numbers into a compact range
// string, e.g. [1,2,3,5,7,8] -> "1-3,5,7-8" (matches the backend's
// `_parse_ranges` format: comma-separated numbers and/or "a-b" ranges).
function collapseToRanges(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const parts = [];
  let start = null, prev = null;
  for (const n of sorted) {
    if (start === null) { start = n; prev = n; continue; }
    if (n === prev + 1) { prev = n; continue; }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = n; prev = n;
  }
  if (start !== null) parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(",");
}

/**
 * PageOrganizer
 * mode="select"  -> click pages to select them; onChange receives a range
 *                   string of the SELECTED pages (e.g. "1-3,5").
 * mode="reorder" -> drag pages to reorder them; onChange receives a
 *                   comma-separated list of original page numbers in the
 *                   new order (e.g. "3,1,2,4").
 */
export default function PageOrganizer({ file, mode, color = "#e63946", onChange, selectLabel = "Click pages to select" }) {
  const [thumbs, setThumbs] = useState({}); // pageNum -> dataUrl
  const [total, setTotal] = useState(null);
  const [order, setOrder] = useState([]); // array of original page numbers, current display order
  const [selected, setSelected] = useState(new Set());
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setThumbs({});
    setTotal(null);
    setOrder([]);
    setSelected(new Set());

    renderAllPageThumbnails(file, (num, dataUrl, totalPages) => {
      if (cancelled) return;
      setThumbs((prev) => ({ ...prev, [num]: dataUrl }));
      setTotal(totalPages);
      setOrder((prev) => (prev.length === totalPages ? prev : Array.from({ length: totalPages }, (_, i) => i + 1)));
    }).catch(() => {});

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    if (!onChange) return;
    if (mode === "reorder") {
      if (order.length > 0) onChange(order.join(","));
    } else {
      onChange(selected.size > 0 ? collapseToRanges([...selected]) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, selected, mode]);

  const toggleSelect = (pageNum) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pageNum) ? next.delete(pageNum) : next.add(pageNum);
      return next;
    });
  };

  const handleDrop = (dropIdx) => {
    if (dragIndex.current === null || dragIndex.current === dropIdx) { setOverIndex(null); return; }
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex.current, 1);
      next.splice(dropIdx, 0, moved);
      return next;
    });
    dragIndex.current = null;
    setOverIndex(null);
  };

  if (total === null) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "#999", fontSize: 14 }}>Loading page previews…</div>;
  }

  const displayOrder = mode === "reorder" ? order : order.length ? order : Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div>
      {mode === "select" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#888" }}>{selectLabel}</span>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => setSelected(new Set(Array.from({ length: total }, (_, i) => i + 1)))}
              style={{ background: "none", border: "none", color, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              style={{ background: "none", border: "none", color: "#888", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {displayOrder.map((pageNum, i) => {
          const isSelected = selected.has(pageNum);
          const isDragTarget = mode === "reorder" && overIndex === i;
          return (
            <div
              key={pageNum}
              draggable={mode === "reorder"}
              onDragStart={() => { dragIndex.current = i; }}
              onDragOver={(e) => { if (mode === "reorder") { e.preventDefault(); setOverIndex(i); } }}
              onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
              onDrop={() => handleDrop(i)}
              onClick={() => mode === "select" && toggleSelect(pageNum)}
              style={{
                width: 100,
                background: "#fff",
                border: `2px solid ${isSelected ? color : isDragTarget ? "#aaa" : "#e8eaf0"}`,
                borderRadius: 8,
                overflow: "hidden",
                cursor: mode === "select" ? "pointer" : "grab",
                userSelect: "none",
                boxShadow: isSelected ? `0 0 0 2px ${color}33` : "0 1px 4px rgba(0,0,0,0.05)",
                transition: "border-color 0.1s",
              }}
            >
              <div style={{ position: "relative", height: 120, background: "#f4f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {thumbs[pageNum] ? (
                  <img src={thumbs[pageNum]} alt={`Page ${pageNum}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 11, color: "#999" }}>Loading…</span>
                )}
                {mode === "select" && isSelected && (
                  <div style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%", background: color, color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    ✓
                  </div>
                )}
              </div>
              <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#555", padding: "6px 0" }}>
                {mode === "reorder" ? `${i + 1}` : pageNum}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
