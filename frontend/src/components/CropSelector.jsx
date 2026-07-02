import { useEffect, useRef, useState } from "react";
import { renderPdfPageForCrop } from "../lib/pdfjs";

/**
 * CropSelector — click-and-drag a rectangle over the rendered first page to
 * pick a crop region. Reports back in PDF points (top-left origin) via
 * onChange({ x1, y1, x2, y2 }), matching what /crop expects directly — the
 * same box is applied to every page server-side.
 */
export default function CropSelector({ file, color = "#e63946", onChange }) {
  const [page, setPage] = useState(null); // { dataUrl, pxWidth, pxHeight, ptWidth, ptHeight }
  const [box, setBox] = useState(null); // { x, y, w, h } in px, relative to the image
  const [error, setError] = useState(null);
  const dragStart = useRef(null);
  const imgWrapRef = useRef();

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setBox(null);
    setError(null);
    renderPdfPageForCrop(file).then((p) => {
      if (cancelled) return;
      setPage(p);
      const full = { x: 0, y: 0, w: p.pxWidth, h: p.pxHeight };
      setBox(full);
      emit(full, p);
    }).catch((err) => {
      if (cancelled) return;
      // eslint-disable-next-line no-console
      console.error("CropSelector: page preview failed", err);
      setError(err?.message || "Couldn't load a preview of this PDF.");
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const emit = (b, p) => {
    if (!onChange || !p) return;
    const scaleX = p.ptWidth / p.pxWidth;
    const scaleY = p.ptHeight / p.pxHeight;
    onChange({
      x1: Math.round(b.x * scaleX),
      y1: Math.round(b.y * scaleY),
      x2: Math.round((b.x + b.w) * scaleX),
      y2: Math.round((b.y + b.h) * scaleY),
    });
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const getRelPos = (e) => {
    const rect = imgWrapRef.current.getBoundingClientRect();
    return {
      x: clamp(e.clientX - rect.left, 0, rect.width),
      y: clamp(e.clientY - rect.top, 0, rect.height),
    };
  };

  const handleMouseDown = (e) => {
    const pos = getRelPos(e);
    dragStart.current = pos;
    setBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e) => {
    if (!dragStart.current) return;
    const pos = getRelPos(e);
    const x = Math.min(dragStart.current.x, pos.x);
    const y = Math.min(dragStart.current.y, pos.y);
    const w = Math.abs(pos.x - dragStart.current.x);
    const h = Math.abs(pos.y - dragStart.current.y);
    setBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setBox((b) => {
      // Ignore accidental near-zero drags — keep the previous box instead.
      const finalBox = b && b.w > 4 && b.h > 4 ? b : { x: 0, y: 0, w: page.pxWidth, h: page.pxHeight };
      emit(finalBox, page);
      return finalBox;
    });
  };

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#c1121f", fontSize: 14 }}>
        Couldn't load a preview of this PDF: {error}
        <br />
        <span style={{ color: "#999", fontSize: 12.5 }}>Open the browser console for the full error.</span>
      </div>
    );
  }

  if (!page) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "#999", fontSize: 14 }}>Loading page preview…</div>;
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
        Click and drag on the page to select the area you want to keep. This crop applies to every page.
      </div>
      <div
        ref={imgWrapRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: "relative",
          width: page.pxWidth,
          height: page.pxHeight,
          maxWidth: "100%",
          margin: "0 auto",
          cursor: "crosshair",
          userSelect: "none",
          border: "1px solid #e8eaf0",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <img src={page.dataUrl} alt="Page 1 preview" draggable={false} style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }} />
        {box && (
          <div
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              border: `2px solid ${color}`,
              boxShadow: `0 0 0 9999px rgba(0,0,0,0.35)`,
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
