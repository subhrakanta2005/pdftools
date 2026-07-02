import { useEffect, useRef, useState } from "react";
import { renderPdfPageAt } from "../lib/pdfjs";

/**
 * RedactSelector — navigate pages, click-and-drag to mark one or more
 * rectangles to permanently redact. Reports the full list back via
 * onChange(regions) as [{ page, x0, y0, x1, y1 }] in PDF points (0-indexed
 * page, top-left origin) — exactly what POST /redact expects.
 */
export default function RedactSelector({ file, color = "#e63946", onChange }) {
  const [pageNum, setPageNum] = useState(1);
  const [pageData, setPageData] = useState(null);
  const [regions, setRegions] = useState([]); // [{page(0idx), x0,y0,x1,y1, _pxBox}]
  const [drag, setDrag] = useState(null); // current in-progress box, px
  const dragStart = useRef(null);
  const wrapRef = useRef();

  useEffect(() => {
    setRegions([]);
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
    onChange && onChange(regions.map(({ page, x0, y0, x1, y1 }) => ({ page, x0, y0, x1, y1 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const getRelPos = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      x: clamp(e.clientX - rect.left, 0, rect.width),
      y: clamp(e.clientY - rect.top, 0, rect.height),
    };
  };

  const handleMouseDown = (e) => {
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
    setDrag({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!dragStart.current || !pageData) { dragStart.current = null; return; }
    dragStart.current = null;
    setDrag((box) => {
      if (box && box.w > 4 && box.h > 4) {
        const scaleX = pageData.ptWidth / pageData.pxWidth;
        const scaleY = pageData.ptHeight / pageData.pxHeight;
        const region = {
          page: pageData.pageNumber - 1,
          x0: Math.round(box.x * scaleX),
          y0: Math.round(box.y * scaleY),
          x1: Math.round((box.x + box.w) * scaleX),
          y1: Math.round((box.y + box.h) * scaleY),
          _pxBox: box,
          _pageNumber: pageData.pageNumber,
        };
        setRegions((prev) => [...prev, region]);
      }
      return null;
    });
  };

  const removeRegion = (idx) => setRegions((prev) => prev.filter((_, i) => i !== idx));

  if (!pageData) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "#999", fontSize: 14 }}>Loading page preview…</div>;
  }

  const regionsOnThisPage = regions.filter((r) => r._pageNumber === pageData.pageNumber);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: "#888" }}>
          Click and drag to mark an area to redact. Add as many as you need, on any page.
        </div>
        {pageData.numPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <button
              type="button"
              onClick={() => setPageNum((n) => Math.max(1, n - 1))}
              disabled={pageNum <= 1}
              style={navBtnStyle}
            >‹</button>
            <span style={{ color: "#666" }}>Page {pageData.pageNumber} / {pageData.numPages}</span>
            <button
              type="button"
              onClick={() => setPageNum((n) => Math.min(pageData.numPages, n + 1))}
              disabled={pageNum >= pageData.numPages}
              style={navBtnStyle}
            >›</button>
          </div>
        )}
      </div>

      <div
        ref={wrapRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: "relative",
          width: pageData.pxWidth,
          height: pageData.pxHeight,
          maxWidth: "100%",
          margin: "0 auto",
          cursor: "crosshair",
          userSelect: "none",
          border: "1px solid #e8eaf0",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <img src={pageData.dataUrl} alt={`Page ${pageData.pageNumber} preview`} draggable={false} style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }} />

        {regionsOnThisPage.map((r, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: r._pxBox.x,
              top: r._pxBox.y,
              width: r._pxBox.w,
              height: r._pxBox.h,
              background: "rgba(0,0,0,0.85)",
              pointerEvents: "none",
            }}
          />
        ))}

        {drag && (
          <div
            style={{
              position: "absolute",
              left: drag.x,
              top: drag.y,
              width: drag.w,
              height: drag.h,
              border: `2px dashed ${color}`,
              background: `${color}22`,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {regions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
            {regions.length} area{regions.length > 1 ? "s" : ""} marked for redaction
          </div>
          {regions.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "#666", padding: "4px 0" }}>
              <span>Page {r._pageNumber}, area {i + 1}</span>
              <span onClick={() => removeRegion(i)} style={{ color: "#e63946", cursor: "pointer", fontWeight: 600 }}>Remove</span>
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
