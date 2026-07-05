import { useEffect, useRef, useState } from "react";
import { renderPdfPageForCrop } from "../lib/pdfjs";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

/**
 * CropSelector — click-and-drag a rectangle over the rendered first page to
 * pick a crop region. Reports back in PDF points (top-left origin) via
 * onChange({ x1, y1, x2, y2 }), matching what /crop expects directly — the
 * same box is applied to every page server-side.
 *
 * Supports zooming in/out so users can select precisely on dense pages
 * (e.g. a resume packed with small text), and correctly maps drag
 * coordinates back to page pixels regardless of how big the image is
 * actually rendered on screen (handles both zoom and responsive shrink).
 */
export default function CropSelector({ file, color = "#e63946", onChange }) {
  const [page, setPage] = useState(null); // { dataUrl, pxWidth, pxHeight, ptWidth, ptHeight }
  const [box, setBox] = useState(null); // { x, y, w, h } in native page px
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const dragStart = useRef(null);
  const imgWrapRef = useRef();

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setBox(null);
    setError(null);
    setZoom(1);
    // Render at a higher base resolution than before (was 480px wide) so
    // the preview is sharp enough to crop precisely even before zooming.
    renderPdfPageForCrop(file, 900).then((p) => {
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

  // Converts a mouse event into native page-pixel coordinates, regardless of
  // how large the image is actually rendered on screen (zoom, or a
  // responsive max-width shrink on small viewports). We measure the real
  // rendered box via getBoundingClientRect and scale back to page.pxWidth/
  // page.pxHeight, rather than assuming rect size === native render size.
  const getRelPos = (e) => {
    const rect = imgWrapRef.current.getBoundingClientRect();
    const ratioX = page.pxWidth / rect.width;
    const ratioY = page.pxHeight / rect.height;
    return {
      x: clamp((e.clientX - rect.left) * ratioX, 0, page.pxWidth),
      y: clamp((e.clientY - rect.top) * ratioY, 0, page.pxHeight),
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

  const zoomIn = () => setZoom((z) => clamp(Math.round((z + ZOOM_STEP) * 100) / 100, MIN_ZOOM, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => clamp(Math.round((z - ZOOM_STEP) * 100) / 100, MIN_ZOOM, MAX_ZOOM));
  const zoomReset = () => setZoom(1);

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

  const displayWidth = page.pxWidth * zoom;
  const displayHeight = page.pxHeight * zoom;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "#888" }}>
          Click and drag on the page to select the area you want to keep. This crop applies to every page.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            style={zoomBtnStyle(zoom <= MIN_ZOOM)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={zoomReset}
            style={{ ...zoomBtnStyle(false), width: 52, fontSize: 12.5 }}
            aria-label="Reset zoom"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            style={zoomBtnStyle(zoom >= MAX_ZOOM)}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Scrollable viewport so a zoomed-in page doesn't blow out the layout —
          users can scroll around while zoomed in to reach every corner. */}
      <div
        style={{
          maxHeight: "70vh",
          overflow: "auto",
          border: "1px solid #e8eaf0",
          borderRadius: 6,
          background: "#f4f5f8",
        }}
      >
        <div
          ref={imgWrapRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            position: "relative",
            width: displayWidth,
            height: displayHeight,
            // Only shrink-to-fit at 100% zoom; once the user zooms in we want
            // the true (larger) size so the scroll container kicks in.
            maxWidth: zoom <= 1 ? "100%" : "none",
            margin: zoom <= 1 ? "0 auto" : "0",
            cursor: "crosshair",
            userSelect: "none",
          }}
        >
          <img
            src={page.dataUrl}
            alt="Page 1 preview"
            draggable={false}
            style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }}
          />
          {box && (
            <div
              style={{
                position: "absolute",
                left: box.x * (displayWidth / page.pxWidth),
                top: box.y * (displayHeight / page.pxHeight),
                width: box.w * (displayWidth / page.pxWidth),
                height: box.h * (displayHeight / page.pxHeight),
                border: `2px solid ${color}`,
                boxShadow: `0 0 0 9999px rgba(0,0,0,0.35)`,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function zoomBtnStyle(disabled) {
  return {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid #e0e2e8",
    background: disabled ? "#f4f5f8" : "#fff",
    color: disabled ? "#bbb" : "#333",
    fontSize: 16,
    lineHeight: 1,
    cursor: disabled ? "default" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };
}
