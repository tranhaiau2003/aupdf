import React from 'react';
import { 
  Grid, LayoutGrid, Crop, Sparkles, Layers,
  Eye, FileText, CheckSquare, Database, Columns, Stamp,
  Scissors, Box, Palette, MoveHorizontal
} from 'lucide-react';
import { ActiveTool } from '../types';

interface ToolBarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
}

export const ToolBar: React.FC<ToolBarProps> = ({
  activeTool,
  onSelectTool
}) => {
  const tools: Array<{ id: ActiveTool; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'view', label: 'Xem PDF', icon: <FileText className="w-4 h-4" /> },
    { id: 'organize', label: 'Sắp xếp trang', icon: <Grid className="w-4 h-4" /> },
    { id: 'impose', label: 'Bình bài in', icon: <LayoutGrid className="w-4 h-4" />, badge: 'Chính' },
    { id: 'boxes', label: 'Hộp kích thước (Boxes)', icon: <Box className="w-4 h-4" /> },
    { id: 'bleed', label: 'Bù xén (Bleed)', icon: <Crop className="w-4 h-4" /> },
    { id: 'trimshift', label: 'Dịch xén & Creep', icon: <MoveHorizontal className="w-4 h-4" /> },
    { id: 'nest', label: 'Gộp bài (Nesting 2D)', icon: <Sparkles className="w-4 h-4" />, badge: 'Sparrow' },
    { id: 'output_preview', label: 'Tách màu (CMYK)', icon: <Eye className="w-4 h-4" /> },
    { id: 'preflight', label: 'Kiểm tra lỗi in', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'bon', label: 'Bôn máy cắt', icon: <Scissors className="w-4 h-4" /> },
    { id: 'vdp', label: 'In dữ liệu biến đổi', icon: <Database className="w-4 h-4" /> },
    { id: 'tile', label: 'Cắt khổ lớn (Tile)', icon: <Columns className="w-4 h-4" /> },
    { id: 'stamp', label: 'Số nhảy & Đóng dấu', icon: <Stamp className="w-4 h-4" /> },
    { id: 'layers', label: 'Quản lý Layer', icon: <Layers className="w-4 h-4" /> },
    { id: 'knockout', label: 'Knockout & Lót trắng', icon: <Palette className="w-4 h-4" /> }
  ];

  return (
    <div className="w-14 bg-[#141414] border-r border-[#2d2d2d] flex flex-col items-center py-2 gap-1.5 shrink-0 select-none z-10">
      {tools.map((t) => {
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelectTool(t.id)}
            className={`group relative w-10 h-10 rounded-lg flex flex-col items-center justify-center transition ${
              isActive 
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-900/20' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#202020]'
            }`}
            title={t.label}
          >
            {t.icon}
            <span className="pointer-events-none absolute left-12 z-50 hidden whitespace-nowrap rounded bg-black px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
              {t.label}
            </span>
            {t.badge && (
              <span className="absolute -top-1 -right-1 text-[8px] px-1 py-0.2 rounded-full bg-cyan-600 text-white font-bold scale-75">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
