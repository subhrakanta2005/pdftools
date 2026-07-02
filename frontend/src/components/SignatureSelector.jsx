import { useEffect, useRef, useState } from "react";
import { renderPdfPageAt } from "../lib/pdfjs";

/**
 * SignatureSelector — draw a signature on a canvas pad, then click-and-drag
 * to place it on a chosen page. Reports back via onChange({ signatureFile,
 * page, x, y, width, height }) in PDF points — matching what POST /sign
 * expects (signature as a file, the rest as form fields).
 */
export default function SignatureSelector({ file, color = "#e63946", onChange }) {
  const padRef = useRef();
  const padDrawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [pageNum, setPageNum] = useState(1);
  const [pageData, setPageData] = useState(null);
  const [box, setBox] = useState(null); // px box on the page, once placed
  const dragStart = useRef(null);
  const wrapRef = useRef();

  useEffect(() => {
    const canvas = padRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a2e";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPageData(null);
    setBox(null);
    renderPdfPageAt(file, pageNum).then((p) => {
      if (!cancelled) setPageData(p);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, pageNum]);

  const getPadPos = (e) => {
    const rect = padRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    padDrawing.current = true;
    const pos = getPadPos(e);
    const ctx = padRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!padDrawing.current) return;
    e.preventDefault();
    const pos = getPadPos(e);
    const ctx = padRef.current.getContext("2d");
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => { padDrawing.current = false; emitChange(); };

  const clearPad = () => {
    const canvas = padRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    emitChange(false);
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const getRelPos = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      x: clamp(e.clientX - rect.left, 0, rect.width),
      y: clamp(e.clientY - rect.top, 0, rect.height),
    };
  };

  const handleMouseDown = (e) => {
    if (!hasSignature) return;
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
      const finalBox = b && b.w > 10 && b.h > 10 ? b : null;
      emitChange(true, finalBox);
      return finalBox;
    });
  };

  const emitChange = (sigPresent = hasSignature, currentBox = box) => {
    if (!onChange) return;
    if (!sigPresent || !currentBox || !pageData) {
      onChange(null);
      return;
    }
    const canvas = padRef.current;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const signatureFile = new File([blob], "signature.png", { type: "image/png" });
      const scaleX = pageData.ptWidth / pageData.pxWidth;
      const scaleY = pageData.ptHeight / pageData.pxHeight;
      onChange({
        signatureFile,
        page: pageData.pageNumber - 1,
        x: Math.round(currentBox.x * scaleX),
        y: Math.round(currentBox.y * scaleY),
        width: Math.round(currentBox.w * scaleX),
        height: Math.round(currentBox.h * scaleY),
      });
    }, "image/png");
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>1. Draw your signature</div>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <canvas
          ref={padRef}
          width={400}
          height={120}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          style={{ border: "1.5px dashed #dde", borderRadius: 8, background: "#fff", width: "100%", maxWidth: 400, touchAction: "none", cursor: "crosshair" }}
        />
        {!hasSignature && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#bbb", fontSize: 14, pointerEvents: "none" }}>
            Sign here
          </div>
        )}
      </div>
      <div onClick={clearPad} style={{ fontSize: 13, color: "#e63946", cursor: "pointer", fontWeight: 600, marginBottom: 20 }}>
        Clear signature
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
        2. {hasSignature ? "Click and drag on the page to place your signature" : "Draw a signature above first"}
      </div>

      {!pageData ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#999", fontSize: 14 }}>Loading page preview…</div>
      ) : (
        <>
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
            style={{
              position: "relative",
              width: pageData.pxWidth,
              height: pageData.pxHeight,
              maxWidth: "100%",
              margin: "0 auto",
              cursor: hasSignature ? "crosshair" : "not-allowed",
              userSelect: "none",
              border: "1px solid #e8eaf0",
              borderRadius: 6,
              overflow: "hidden",
              opacity: hasSignature ? 1 : 0.6,
            }}
          >
            <img src={pageData.dataUrl} alt={`Page ${pageData.pageNumber} preview`} draggable={false} style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }} />
            {box && (
              <div
                style={{
                  position: "absolute",
                  left: box.x,
                  top: box.y,
                  width: box.w,
                  height: box.h,
                  border: `2px solid ${color}`,
                  background: `${color}22`,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        </>
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
