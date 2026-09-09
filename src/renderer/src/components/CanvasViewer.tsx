import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { 
  ChevronLeft, ChevronRight, Eye, Droplet, 
  Maximize2, Box, Info, AlertTriangle
} from 'lucide-react';
import { PageBoxes, OutputSample } from '../types';
import { apiClient } from '../api/client';

// Configure pdfjs worker (Vite `?url` import → correct asset URL in both dev & production build)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface CanvasViewerProps {
  pdfBytes: ArrayBuffer | null;
  docPath: string | null;
  currentPage: number;
  pageCount: number;
  onPageChange: (p: number) => void;
  zoom: number;
  onZoomChange?: (z: number) => void;
  boxes?: PageBoxes[];
}

export const CanvasViewer: React.FC<CanvasViewerProps> = ({
  pdfBytes,
  docPath,
  currentPage,
  pageCount,
  onPageChange,
  zoom,
  onZoomChange,
  boxes
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [showBoxes, setShowBoxes] = useState({
    media: true,
    crop: true,
    bleed: true,
    trim: true,
    art: false
  });
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [colorSample, setColorSample] = useState<OutputSample | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Load PDF document from ArrayBuffer
  useEffect(() => {
    if (!pdfBytes) {
      setPdfDoc(null);
      return;
    }
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBytes.slice(0)),
      // CMaps + standard fonts (đóng gói từ src/renderer/public) — cần để render
      // đúng PDF dùng font chuẩn không nhúng (Arial/Helvetica...) và mã hóa CJK
      // (đồng bộ hành vi của app gốc PDF in PD).
      cMapUrl: './cmaps/',
      cMapPacked: true,
      standardFontDataUrl: './standard_fonts/',
    });
    loadingTask.promise.then(
      (doc) => {
        if (cancelled) {
          doc.destroy();
        } else {
          setPdfDoc(doc);
        }
      },
      (err) => console.error('Error loading PDF in viewer:', err)
    );
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  // Render Page to Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || currentPage < 1 || currentPage > pdfDoc.numPages) return;

    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    pdfDoc.getPage(currentPage).then((page) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      
      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: zoom * pixelRatio });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / pixelRatio}px`;
      canvas.style.height = `${viewport.height / pixelRatio}px`;

      setViewportSize({
        width: viewport.width / pixelRatio,
        height: viewport.height / pixelRatio
      });

      renderTask = page.render({
        canvasContext: context,
        viewport: viewport
      });
      renderTask.promise.catch((err) => {
        // Cancelled renders (page/zoom change) are expected — only log real errors
        if (!cancelled && err?.name !== 'RenderingCancelledException' && err?.name !== 'AbortException') {
          console.error('Error rendering page:', err);
        }
      });
    });

    return () => {
      cancelled = true;
      // Cancel any in-flight render so the canvas is never locked for the next page
      try { renderTask?.cancel(); } catch { /* noop */ }
    };
  }, [pdfDoc, currentPage, zoom]);

  // Ctrl + lăn chuột để zoom to/nhỏ layout (đồng bộ giới hạn 20%–400% như Header).
  // Dùng listener non-passive để chặn được zoom mặc định của Chromium.
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onZoomChange) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = Math.min(4.0, Math.max(0.2, zoomRef.current * factor));
      const rounded = Math.round(next * 100) / 100;
      if (rounded !== zoomRef.current) {
        zoomRef.current = rounded;
        onZoomChange(rounded);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onZoomChange]);

  // Eyedropper Live Sampler
  const handleCanvasMouseMove = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!eyedropperActive || !docPath || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    // Convert to PDF pt coordinate
    const ptX = (x / rect.width) * (currentBoxInfo?.media.w || 595.28);
    const ptY = (y / rect.height) * (currentBoxInfo?.media.h || 841.89);

    try {
      const sample = await apiClient.sampleColor(docPath, currentPage - 1, ptX, ptY);
      setColorSample(sample);
    } catch {
      // ignore
    }
  };

  const currentBoxInfo = boxes && boxes[currentPage - 1];
  // PDF.js renders the page using its viewBox (normally CropBox), not always
  // the MediaBox.  Overlay coordinates must therefore be translated relative
  // to that same origin; using media.w/h directly shifts boxes whenever the
  // page has non-zero MediaBox/CropBox offsets.
  const overlayBase = currentBoxInfo?.crop || currentBoxInfo?.media;
  const boxStyle = (box: any): React.CSSProperties => {
    if (!box || !overlayBase || !overlayBase.w || !overlayBase.h) return {};
    return {
      left: `${((box.x0 - overlayBase.x0) / overlayBase.w) * 100}%`,
      top: `${((overlayBase.y1 - box.y1) / overlayBase.h) * 100}%`,
      width: `${(box.w / overlayBase.w) * 100}%`,
      height: `${(box.h / overlayBase.h) * 100}%`
    };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-hidden select-none">
      {/* Top Viewer Control Bar */}
      <div className="h-9 bg-[#202020] border-b border-[#2d2d2d] flex items-center justify-between px-3 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#282828] rounded px-1.5 py-0.5 border border-[#383838]">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1 hover:text-cyan-400 disabled:opacity-30"
              title="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-gray-200 px-1 font-medium">
              Trang {currentPage} / {pageCount || 1}
            </span>
            <button
              onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage >= pageCount}
              className="p-1 hover:text-cyan-400 disabled:opacity-30"
              title="Trang tiếp"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {currentBoxInfo && (
            <span className="text-gray-400 font-mono hidden md:inline-block">
              Khổ: {((currentBoxInfo.trim.w || currentBoxInfo.media.w) * 0.352778).toFixed(1)} x {((currentBoxInfo.trim.h || currentBoxInfo.media.h) * 0.352778).toFixed(1)} mm
            </span>
          )}
        </div>

        {/* Box Visibility Toggles & Eyedropper */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 cursor-pointer text-blue-400">
              <input 
                type="checkbox" 
                checked={showBoxes.media} 
                onChange={(e) => setShowBoxes({ ...showBoxes, media: e.target.checked })} 
                className="w-3 h-3 rounded"
              />
              <span>Media</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-emerald-400">
              <input 
                type="checkbox" 
                checked={showBoxes.crop} 
                onChange={(e) => setShowBoxes({ ...showBoxes, crop: e.target.checked })} 
                className="w-3 h-3 rounded"
              />
              <span>Crop</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-amber-400">
              <input 
                type="checkbox" 
                checked={showBoxes.bleed} 
                onChange={(e) => setShowBoxes({ ...showBoxes, bleed: e.target.checked })} 
                className="w-3 h-3 rounded"
              />
              <span>Bleed</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-red-400 font-bold">
              <input 
                type="checkbox" 
                checked={showBoxes.trim} 
                onChange={(e) => setShowBoxes({ ...showBoxes, trim: e.target.checked })} 
                className="w-3 h-3 rounded"
              />
              <span>Trim</span>
            </label>
          </div>

          <button
            onClick={() => setEyedropperActive(!eyedropperActive)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border transition ${
              eyedropperActive 
                ? 'bg-cyan-900/50 text-cyan-300 border-cyan-500 font-medium' 
                : 'bg-[#282828] text-gray-400 border-[#383838] hover:text-gray-200'
            }`}
            title="Kính lúp đo mật độ màu CMYK & TAC"
          >
            <Droplet className="w-3.5 h-3.5 text-cyan-400" />
            <span>Đo màu</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div 
        ref={containerRef}
        onMouseMove={handleCanvasMouseMove}
        className="flex-1 overflow-auto p-6 flex items-center justify-center relative bg-[#141414]"
      >
        <div className="relative shadow-2xl bg-white border border-[#333] transition-all">
          <canvas ref={canvasRef} className="block" />

          {/* Visual Box Overlays */}
          {currentBoxInfo && viewportSize.width > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {/* MediaBox */}
              {showBoxes.media && currentBoxInfo.media && (
                <div className="absolute border border-blue-500/80 border-dashed" style={boxStyle(currentBoxInfo.media)} />
              )}
              {/* BleedBox */}
              {showBoxes.bleed && currentBoxInfo.bleed && (
                <div 
                  className="absolute border border-amber-500/80 border-dashed"
                  style={{
                    ...boxStyle(currentBoxInfo.bleed)
                  }}
                />
              )}
              {/* TrimBox */}
              {showBoxes.trim && currentBoxInfo.trim && (
                <div 
                  className="absolute border-2 border-red-500/90 shadow-sm"
                  style={{
                    ...boxStyle(currentBoxInfo.trim)
                  }}
                />
              )}
              {/* CropBox */}
              {showBoxes.crop && currentBoxInfo.crop && (
                <div 
                  className="absolute border border-emerald-500/80 border-dashed"
                  style={{
                    ...boxStyle(currentBoxInfo.crop)
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Live Color Sampler Floating Box */}
        {eyedropperActive && colorSample && (
          <div className="fixed bottom-6 right-8 bg-[#202020]/95 backdrop-blur border border-[#444] rounded-lg p-3 shadow-2xl text-xs font-mono z-30 flex flex-col gap-1 w-44">
            <div className="flex items-center justify-between text-gray-300 font-bold border-b border-[#333] pb-1">
              <span>Đo Mực In</span>
              <span className={`px-1 rounded ${colorSample.tac > 300 ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                TAC: {Math.round(colorSample.tac)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-gray-200 mt-1">
              <span className="text-cyan-400">C: {Math.round(colorSample.c)}%</span>
              <span className="text-pink-400">M: {Math.round(colorSample.m)}%</span>
              <span className="text-yellow-300">Y: {Math.round(colorSample.y)}%</span>
              <span className="text-gray-100">K: {Math.round(colorSample.k)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
