import { useRef, useState, useEffect } from "react";
import { renderPdfPageForCrop } from "../lib/pdfjs";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const MIN_BOX = 20; // smallest allowed crop box, in native page px

// Which edges each resize handle controls, and the cursor it should show.
const HANDLES = [
  { name: "nw", left: true, top: true, cursor: "nwse-resize" },
  { name: "n", top: true, cursor: "ns-resize" },
  { name: "ne", right: true, top: true, cursor: "nesw-resize" },
  { name: "e", right: true, cursor: "ew-resize" },
  { name: "se", right: true, bottom: true, cursor: "nwse-resize" },
  { name: "s", bottom: true, cursor: "ns-resize" },
  { name: "sw", left: true, bottom: true, cursor: "nesw-resize" },
  { name: "w", left: true, cursor: "ew-resize" },
];

/**
 * CropSelector — click-and-drag a rectangle over the rendered first page to
 * pick a crop region, then fine-tune it by dragging the box itself (move)
 * or any of its 8 corner/edge handles (resize). Reports back in PDF points
 * ({x1,y1,x2,y2}) matching what /crop expects — the same box is applied to
 * every page server-side.
 */
export default function CropSelector({ file, color = "#e63946", onChange }) {
  const [page, setPage] = useState(null); // { dataUrl, pxWidth, pxHeight, ptWidth, ptHeight }
  const [box, setBox] = useState(null); // { x, y, w, h } in native page px
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const imgWrapRef = useRef();
  // Drag state lives in a ref (not React state) so mousemove doesn't fight
  // with re-renders; `drag.current.mode` is 'draw' | 'move' | 'resize' | null.
  const drag = useRef({ mode: null, handle: null, startPos: null, startBox: null });

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setBox(null);
    setError(null);
    setZoom(1);
    // Higher base resolution than before (was 480px wide) so the preview is
    // sharp enough to crop precisely even before zooming in further.
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
  // responsive shrink on small viewports) — measures the real rendered box
  // via getBoundingClientRect and scales back to page.pxWidth/pxHeight.
  const getRelPos = (e) => {
    const rect = imgWrapRef.current.getBoundingClientRect();
    const ratioX = page.pxWidth / rect.width;
    const ratioY = page.pxHeight / rect.height;
    return {
      x: clamp((e.clientX - rect.left) * ratioX, 0, page.pxWidth),
      y: clamp((e.clientY - rect.top) * ratioY, 0, page.pxHeight),
    };
  };

  // Start drawing a brand-new box (mousedown on the background, outside the
  // current box).
  const handleBgMouseDown = (e) => {
    const pos = getRelPos(e);
    drag.current = { mode: "draw", handle: null, startPos: pos, startBox: null };
    setBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  // Start moving the existing box (mousedown inside it, not on a handle).
  const handleBoxMouseDown = (e) => {
    e.stopPropagation();
    const pos = getRelPos(e);
    drag.current = { mode: "move", handle: null, startPos: pos, startBox: { ...box } };
  };

  // Start resizing via one of the 8 handles.
  const handleGrabMouseDown = (handleName) => (e) => {
    e.stopPropagation();
    const pos = getRelPos(e);
    drag.current = { mode: "resize", handle: handleName, startPos: pos, startBox: { ...box } };
  };

  const handleMouseMove = (e) => {
    const d = drag.current;
    if (!d.mode || !page) return;
    const pos = getRelPos(e);

    if (d.mode === "draw") {
      const x = Math.min(d.startPos.x, pos.x);
      const y = Math.min(d.startPos.y, pos.y);
      const w = Math.abs(pos.x - d.startPos.x);
      const h = Math.abs(pos.y - d.startPos.y);
      setBox({ x, y, w, h });
      return;
    }

    if (d.mode === "move") {
      const dx = pos.x - d.startPos.x;
      const dy = pos.y - d.startPos.y;
      const x = clamp(d.startBox.x + dx, 0, page.pxWidth - d.startBox.w);
      const y = clamp(d.startBox.y + dy, 0, page.pxHeight - d.startBox.h);
      setBox({ x, y, w: d.startBox.w, h: d.startBox.h });
      return;
    }

    if (d.mode === "resize") {
      const h = HANDLES.find((h) => h.name === d.handle);
      const fixedLeft = d.startBox.x;
      const fixedRight = d.startBox.x + d.startBox.w;
      const fixedTop = d.startBox.y;
      const fixedBottom = d.startBox.y + d.startBox.h;

      const newLeft = h.left ? clamp(pos.x, 0, fixedRight - MIN_BOX) : fixedLeft;
      const newRight = h.right ? clamp(pos.x, fixedLeft + MIN_BOX, page.pxWidth) : fixedRight;
      const newTop = h.top ? clamp(pos.y, 0, fixedBottom - MIN_BOX) : fixedTop;
      const newBottom = h.bottom ? clamp(pos.y, fixedTop + MIN_BOX, page.pxHeight) : fixedBottom;

      setBox({ x: newLeft, y: newTop, w: newRight - newLeft, h: newBottom - newTop });
    }
  };

  const handleMouseUp = () => {
    const mode = drag.current.mode;
    if (!mode) return;
    drag.current = { mode: null, handle: null, startPos: null, startBox: null };
    setBox((b) => {
      // Ignore accidental near-zero new-box drags — keep the previous box.
      const finalBox = mode === "draw" && (!b || b.w < 4 || b.h < 4)
        ? { x: 0, y: 0, w: page.pxWidth, h: page.pxHeight }
        : b;
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
  const dispScaleX = displayWidth / page.pxWidth;
  const dispScaleY = displayHeight / page.pxHeight;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "#888" }}>
          Drag to draw a crop box, drag its edges/corners to resize, or drag inside it to move it. Applies to every page.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} style={zoomBtnStyle(zoom <= MIN_ZOOM)} aria-label="Zoom out">−</button>
          <button type="button" onClick={zoomReset} style={{ ...zoomBtnStyle(false), width: 52, fontSize: 12.5 }} aria-label="Reset zoom" title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} style={zoomBtnStyle(zoom >= MAX_ZOOM)} aria-label="Zoom in">+</button>
        </div>
      </div>

      {/* Scrollable viewport so a zoomed-in page doesn't blow out the layout. */}
      <div style={{ maxHeight: "70vh", overflow: "auto", border: "1px solid #e8eaf0", borderRadius: 6, background: "#f4f5f8" }}>
        <div
          ref={imgWrapRef}
          onMouseDown={handleBgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            position: "relative",
            width: displayWidth,
            height: displayHeight,
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
              onMouseDown={handleBoxMouseDown}
              style={{
                position: "absolute",
                left: box.x * dispScaleX,
                top: box.y * dispScaleY,
                width: box.w * dispScaleX,
                height: box.h * dispScaleY,
                border: `2px solid ${color}`,
                boxShadow: `0 0 0 9999px rgba(0,0,0,0.35)`,
                cursor: "move",
              }}
            >
              {HANDLES.map((h) => (
                <div
                  key={h.name}
                  onMouseDown={handleGrabMouseDown(h.name)}
                  style={{
                    position: "absolute",
                    left: h.left ? 0 : h.right ? "100%" : "50%",
                    top: h.top ? 0 : h.bottom ? "100%" : "50%",
                    transform: "translate(-50%, -50%)",
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: "#fff",
                    border: `2px solid ${color}`,
                    cursor: h.cursor,
                    boxSizing: "border-box",
                  }}
                />
              ))}
            </div>
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
