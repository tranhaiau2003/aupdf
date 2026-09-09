import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { 
  RotateCw, RotateCcw, Copy, Trash2, Plus, 
  ArrowUpDown, CheckSquare, Layers
} from 'lucide-react';
import { PageItem } from '../types';
import { toast } from './Toast';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface ThumbnailsGridProps {
  pageCount: number;
  currentPage: number;
  onSelectPage: (p: number) => void;
  onApplyPages: (arrangement: PageItem[]) => void;
  className?: string;
  pdfBytes?: ArrayBuffer | null;
}

export const ThumbnailsGrid: React.FC<ThumbnailsGridProps> = ({
  pageCount,
  currentPage,
  onSelectPage,
  onApplyPages,
  className,
  pdfBytes
}) => {
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    if (!pdfBytes) return;
    (async () => {
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      for (let i = 0; i < Math.min(pageCount, doc.numPages); i++) {
        if (cancelled) return;
        const canvas = canvasRefs.current[i];
        if (!canvas) continue;
        const page = await doc.getPage(i + 1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(260 / base.width, 340 / base.height);
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      }
    })().catch(err => console.error('Thumbnail render failed:', err));
    return () => { cancelled = true; };
  }, [pdfBytes, pageCount]);

  const toggleSelect = (pageIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedPages);
    if (e.shiftKey || e.ctrlKey) {
      if (next.has(pageIndex)) next.delete(pageIndex);
      else next.add(pageIndex);
    } else {
      next.clear();
      next.add(pageIndex);
      onSelectPage(pageIndex + 1);
    }
    setSelectedPages(next);
  };

  const handleRotate = (deg: number) => {
    const targets = selectedPages.size > 0 ? selectedPages : new Set([currentPage - 1]);
    const arrangement: PageItem[] = Array.from({ length: pageCount }, (_, i) => ({
      source: i,
      rotate: targets.has(i) ? deg : 0
    }));
    onApplyPages(arrangement);
  };

  const handleDuplicate = () => {
    const targets = selectedPages.size > 0 ? selectedPages : new Set([currentPage - 1]);
    const arrangement: PageItem[] = [];
    for (let i = 0; i < pageCount; i++) {
      arrangement.push({ source: i, rotate: 0 });
      if (targets.has(i)) {
        arrangement.push({ source: i, rotate: 0 });
      }
    }
    onApplyPages(arrangement);
  };

  const handleDelete = () => {
    const targets = selectedPages.size > 0 ? selectedPages : new Set([currentPage - 1]);
    if (targets.size >= pageCount) {
      toast.error('Không thể xóa toàn bộ trang của tài liệu!');
      return;
    }
    const arrangement: PageItem[] = [];
    for (let i = 0; i < pageCount; i++) {
      if (!targets.has(i)) {
        arrangement.push({ source: i, rotate: 0 });
      }
    }
    onApplyPages(arrangement);
    setSelectedPages(new Set());
  };

  const handleReverse = () => {
    const arrangement: PageItem[] = Array.from({ length: pageCount }, (_, i) => ({
      source: pageCount - 1 - i,
      rotate: 0
    }));
    onApplyPages(arrangement);
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const order = Array.from({ length: pageCount }, (_, i) => i);
    const [moved] = order.splice(dragIndex, 1);
    order.splice(targetIndex, 0, moved);
    onApplyPages(order.map(source => ({ source, rotate: 0 })));
    setSelectedPages(new Set());
    setDragIndex(null);
  };

  return (
    <div className={`${className || 'h-full'} flex flex-col bg-[#1e1e1e] p-3 text-xs select-none`}>
      {/* Action Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#2d2d2d] shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleRotate(90)}
            className="p-1.5 bg-[#282828] hover:bg-[#333] text-gray-300 rounded border border-[#3a3a3a]"
            title="Xoay phải 90°"
          >
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <button
            onClick={() => handleRotate(-90)}
            className="p-1.5 bg-[#282828] hover:bg-[#333] text-gray-300 rounded border border-[#3a3a3a]"
            title="Xoay trái 90°"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <button
            onClick={handleDuplicate}
            className="p-1.5 bg-[#282828] hover:bg-[#333] text-gray-300 rounded border border-[#3a3a3a]"
            title="Nhân đôi trang"
          >
            <Copy className="w-3.5 h-3.5 text-yellow-400" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-[#282828] hover:bg-red-900/50 text-gray-300 hover:text-red-300 rounded border border-[#3a3a3a]"
            title="Xóa trang"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
          <button
            onClick={handleReverse}
            className="p-1.5 bg-[#282828] hover:bg-[#333] text-gray-300 rounded border border-[#3a3a3a]"
            title="Đảo ngược thứ tự trang"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
          </button>
        </div>

        <span className="text-gray-400 font-mono">
          {selectedPages.size > 0 ? `Đã chọn ${selectedPages.size} trang` : `Tổng ${pageCount} trang`}
        </span>
      </div>

      {/* Pages Grid */}
      <div className="flex-1 overflow-y-auto pt-3 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: pageCount }, (_, i) => {
          const isSelected = selectedPages.has(i);
          const isCurrent = currentPage === i + 1;
          return (
            <div
              key={i}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleDrop(i); }}
              onClick={(e) => toggleSelect(i, e)}
              className={`flex flex-col items-center p-2 rounded-lg border cursor-grab active:cursor-grabbing transition relative ${
                isSelected 
                  ? 'bg-cyan-950/40 border-cyan-500 shadow-md' 
                  : isCurrent 
                  ? 'bg-[#282828] border-cyan-400/50' 
                  : 'bg-[#252525] border-[#333] hover:border-gray-500'
              }`}
            >
              <div className="w-full aspect-[3/4] bg-white rounded flex items-center justify-center text-gray-900 font-bold text-sm shadow overflow-hidden">
                <canvas ref={el => { canvasRefs.current[i] = el; }} className="max-w-full max-h-full" />
                {!pdfBytes && <span>{i + 1}</span>}
              </div>
              <span className="mt-1.5 text-[11px] font-mono text-gray-300">
                Trang {i + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
