import { useEffect, useRef, useState } from "react";
import { renderPdfPageAt } from "../lib/pdfjs";

const TOOLS = [
  { id: "text", label: "Text", icon: "T" },
  { id: "rect", label: "Rectangle", icon: "▭" },
  { id: "circle", label: "Circle", icon: "○" },
  { id: "line", label: "Line", icon: "╱" },
];

const COLORS = ["#000000", "#e63946", "#2a9d8f", "#1d4ed8", "#f59e0b"];

function hexToRgb01(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * PdfEditor — a minimal but functional annotation tool: pick text/rect/
 * circle/line, click (text) or click-drag (shapes) on the page to place it,
 * across any page. Reports the operations list back via onChange(operations)
 * matching what POST /edit expects: [{type, page, ...coords, color}].
 */
export default function PdfEditor({ file, color: accent = "#e63946", onChange }) {
  const [activeTool, setActiveTool] = useState("text");
  const [activeColor, setActiveColor] = useState("#000000");
  const [pageNum, setPageNum] = useState(1);
  const [pageData, setPageData] = useState(null);
  const [ops, setOps] = useState([]); // each: {..., _pxBox or _pxPoint, _pageNumber}
  const [pendingText, setPendingText] = useState(null); // {x,y} px, awaiting text input
  const [textValue, setTextValue] = useState("");
  const dragStart = useRef(null);
  const [drag, setDrag] = useState(null);
  const wrapRef = useRef();

  useEffect(() => {
    setOps([]);
    setPageNum(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    setPageData(null);
    renderPdfPageAt(file, pageNum).then((p) => {
      if (!cancelled) setPageData(p);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, pageNum]);

  useEffect(() => {
    if (!onChange) return;
    onChange(ops.map((o) => {
      // eslint-disable-next-line no-unused-vars
      const { _pxBox, _pxPoint, _pageNumber, ...rest } = o;
      return rest;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops]);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const getRelPos = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      x: clamp(e.clientX - rect.left, 0, rect.width),
      y: clamp(e.clientY - rect.top, 0, rect.height),
    };
  };

  const toPt = (px, py) => ({
    x: Math.round(px * (pageData.ptWidth / pageData.pxWidth)),
    y: Math.round(py * (pageData.ptHeight / pageData.pxHeight)),
  });

  const handleClick = (e) => {
    if (activeTool !== "text" || !pageData) return;
    const pos = getRelPos(e);
    setPendingText(pos);
    setTextValue("");
  };

  const confirmText = () => {
    if (!textValue.trim() || !pendingText || !pageData) { setPendingText(null); return; }
    const pt = toPt(pendingText.x, pendingText.y);
    setOps((prev) => [...prev, {
      type: "text", page: pageData.pageNumber - 1, x: pt.x, y: pt.y,
      text: textValue, font_size: 16, color: hexToRgb01(activeColor),
      _pxPoint: pendingText, _pageNumber: pageData.pageNumber,
    }]);
    setPendingText(null);
    setTextValue("");
  };

  const handleMouseDown = (e) => {
    if (activeTool === "text" || !pageData) return;
    const pos = getRelPos(e);
    dragStart.current = pos;
    setDrag({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e) => {
    if (!dragStart.current) return;
    const pos = getRelPos(e);
    const x = Math.min(dragStart.current.x, pos.x);
    const y = Math.min(dragStart.current.y, pos.y);
    const w = Math.abs(pos.x - dragStart.current.x);
    const h = Math.abs(pos.y - dragStart.current.y);
    setDrag({ x, y, w, h, startX: dragStart.current.x, startY: dragStart.current.y, endX: pos.x, endY: pos.y });
  };

  const handleMouseUp = () => {
    if (!dragStart.current || !pageData) { dragStart.current = null; return; }
    dragStart.current = null;
    setDrag((box) => {
      if (!box || (box.w < 4 && box.h < 4 && activeTool !== "line")) return null;
      const color = hexToRgb01(activeColor);
      if (activeTool === "rect") {
        const topLeft = toPt(box.x, box.y);
        const size = { x: Math.round(box.w * (pageData.ptWidth / pageData.pxWidth)), y: Math.round(box.h * (pageData.ptHeight / pageData.pxHeight)) };
        setOps((prev) => [...prev, {
          type: "rect", page: pageData.pageNumber - 1, x: topLeft.x, y: topLeft.y,
          width: size.x, height: size.y, color, fill: false,
          _pxBox: box, _pageNumber: pageData.pageNumber,
        }]);
      } else if (activeTool === "circle") {
        const center = toPt(box.x + box.w / 2, box.y + box.h / 2);
        const radius = Math.round((Math.max(box.w, box.h) / 2) * (pageData.ptWidth / pageData.pxWidth));
        setOps((prev) => [...prev, {
          type: "circle", page: pageData.pageNumber - 1, x: center.x, y: center.y,
          radius, color, fill: false,
          _pxBox: box, _pageNumber: pageData.pageNumber,
        }]);
      } else if (activeTool === "line") {
        const p1 = toPt(box.startX, box.startY);
        const p2 = toPt(box.endX, box.endY);
        setOps((prev) => [...prev, {
          type: "line", page: pageData.pageNumber - 1, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, color,
          _pxBox: box, _pageNumber: pageData.pageNumber,
        }]);
      }
      return null;
    });
  };

  const removeOp = (idx) => setOps((prev) => prev.filter((_, i) => i !== idx));

  if (!pageData) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "#999", fontSize: 14 }}>Loading page preview…</div>;
  }

  const opsOnThisPage = ops.filter((o) => o._pageNumber === pageData.pageNumber);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTool(t.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: activeTool === t.id ? `2px solid ${accent}` : "1.5px solid #dde",
              background: activeTool === t.id ? `${accent}11` : "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {COLORS.map((c) => (
            <div
              key={c}
              onClick={() => setActiveColor(c)}
              style={{
                width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer",
                border: activeColor === c ? `2px solid ${accent}` : "2px solid transparent",
                boxShadow: activeColor === c ? "0 0 0 1px #fff inset" : "none",
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
        {activeTool === "text" ? "Click on the page to add a text label." : "Click and drag on the page to draw."}
      </div>

      {pageData.numPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8 }}>
          <button type="button" onClick={() => setPageNum((n) => Math.max(1, n - 1))} disabled={pageNum <= 1} style={navBtnStyle}>‹</button>
          <span style={{ color: "#666" }}>Page {pageData.pageNumber} / {pageData.numPages}</span>
          <button type="button" onClick={() => setPageNum((n) => Math.min(pageData.numPages, n + 1))} disabled={pageNum >= pageData.numPages} style={navBtnStyle}>›</button>
        </div>
      )}

      <div
        ref={wrapRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        style={{
          position: "relative",
          width: pageData.pxWidth,
          height: pageData.pxHeight,
          maxWidth: "100%",
          margin: "0 auto",
          cursor: activeTool === "text" ? "text" : "crosshair",
          userSelect: "none",
          border: "1px solid #e8eaf0",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <img src={pageData.dataUrl} alt={`Page ${pageData.pageNumber} preview`} draggable={false} style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }} />

        {opsOnThisPage.map((o, i) => {
          if (o.type === "text") {
            return (
              <div key={i} style={{ position: "absolute", left: o._pxPoint.x, top: o._pxPoint.y - 14, color: `rgb(${o.color.map((c) => c * 255).join(",")})`, fontSize: 16, fontWeight: 600, pointerEvents: "none" }}>
                {o.text}
              </div>
            );
          }
          if (o.type === "rect") {
            return <div key={i} style={{ position: "absolute", left: o._pxBox.x, top: o._pxBox.y, width: o._pxBox.w, height: o._pxBox.h, border: `2px solid rgb(${o.color.map((c) => c * 255).join(",")})`, pointerEvents: "none" }} />;
          }
          if (o.type === "circle") {
            return <div key={i} style={{ position: "absolute", left: o._pxBox.x, top: o._pxBox.y, width: o._pxBox.w, height: o._pxBox.h, borderRadius: "50%", border: `2px solid rgb(${o.color.map((c) => c * 255).join(",")})`, pointerEvents: "none" }} />;
          }
          if (o.type === "line") {
            const x1 = o._pxBox.startX, y1 = o._pxBox.startY, x2 = o._pxBox.endX, y2 = o._pxBox.endY;
            const len = Math.hypot(x2 - x1, y2 - y1);
            const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
            return (
              <div key={i} style={{
                position: "absolute", left: x1, top: y1, width: len, height: 2,
                background: `rgb(${o.color.map((c) => c * 255).join(",")})`,
                transform: `rotate(${angle}deg)`, transformOrigin: "0 0", pointerEvents: "none",
              }} />
            );
          }
          return null;
        })}

        {drag && activeTool !== "text" && (
          <div style={{
            position: "absolute", left: drag.x, top: drag.y, width: drag.w, height: drag.h,
            border: `2px dashed ${accent}`, pointerEvents: "none",
          }} />
        )}

        {pendingText && (
          <div style={{ position: "absolute", left: pendingText.x, top: pendingText.y, zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmText(); if (e.key === "Escape") setPendingText(null); }}
              onBlur={confirmText}
              placeholder="Type text…"
              style={{ padding: "4px 8px", fontSize: 14, border: `1.5px solid ${accent}`, borderRadius: 4, outline: "none" }}
            />
          </div>
        )}
      </div>

      {ops.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
            {ops.length} item{ops.length > 1 ? "s" : ""} added
          </div>
          {ops.map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "#666", padding: "4px 0" }}>
              <span>Page {o._pageNumber}: {o.type}{o.type === "text" ? ` "${o.text}"` : ""}</span>
              <span onClick={() => removeOp(i)} style={{ color: "#e63946", cursor: "pointer", fontWeight: 600 }}>Remove</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const navBtnStyle = {
  border: "1px solid #dde",
  background: "#fff",
  borderRadius: 6,
  width: 28,
  height: 28,
  cursor: "pointer",
  fontSize: 16,
};
