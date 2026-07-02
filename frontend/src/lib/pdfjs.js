// pdf.js is loaded on demand (dynamic import) so its ~1MB doesn't bloat the
// main app bundle for pages/tools that never touch a PDF preview.
let pdfjsLibPromise = null;
export function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

// Renders page 1 of a PDF File to a JPEG data URL (used for file-drop previews).
export async function renderPdfThumbnail(file, maxWidth = 220) {
  const pdfjsLib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  try {
    const page = await pdf.getPage(1);
    return await renderPageToDataUrl(page, maxWidth);
  } finally {
    pdf.destroy();
  }
}

async function renderPageToDataUrl(page, maxWidth) {
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: scaledViewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.8);
}

// Renders every page of a PDF File to a thumbnail data URL, one at a time,
// calling onPage(pageNumber1Indexed, dataUrl) as each finishes so the UI can
// stream thumbnails in progressively instead of blocking on the whole file.
export async function renderAllPageThumbnails(file, onPage, maxWidth = 160) {
  const pdfjsLib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const dataUrl = await renderPageToDataUrl(page, maxWidth);
      onPage(i, dataUrl, pdf.numPages);
    }
    return pdf.numPages;
  } finally {
    pdf.destroy();
  }
}
