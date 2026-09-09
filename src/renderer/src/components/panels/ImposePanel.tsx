import React, { useState } from 'react';
import { 
  LayoutGrid, BookOpen, Layers, CheckSquare, 
  Settings2, Download, Upload, Play, RefreshCw 
} from 'lucide-react';
import { ImposeRequest, ImposeProfile } from '../../types';

interface ImposePanelProps {
  onRunImpose: (req: Partial<ImposeRequest>) => void;
  isProcessing: boolean;
}

export const ImposePanel: React.FC<ImposePanelProps> = ({
  onRunImpose,
  isProcessing
}) => {
  const [mode, setMode] = useState<'nup' | 'step' | 'booklet' | 'cut_stack'>('nup');
  const [sheetPreset, setSheetPreset] = useState<string>('32x43');
  const [sheetW, setSheetW] = useState<number>(320); // mm
  const [sheetH, setSheetH] = useState<number>(430); // mm
  const [rows, setRows] = useState<number>(2);
  const [cols, setCols] = useState<number>(2);
  const [margin, setMargin] = useState<number>(5); // mm
  const [gutterH, setGutterH] = useState<number>(2); // mm
  const [gutterV, setGutterV] = useState<number>(2); // mm
  const [duplex, setDuplex] = useState<boolean>(false);
  const [duplexFlip, setDuplexFlip] = useState<'long' | 'short'>('long');
  const [packRotate, setPackRotate] = useState<boolean>(false);
  const [cropMarks, setCropMarks] = useState<boolean>(true);
  const [regMarks, setRegMarks] = useState<boolean>(true);
  const [numbering, setNumbering] = useState<boolean>(false);
  const [numStart, setNumStart] = useState<number>(1);
  const [numPrefix, setNumPrefix] = useState<string>('No. ');

  const handlePresetChange = (preset: string) => {
    setSheetPreset(preset);
    if (preset === 'A4') { setSheetW(210); setSheetH(297); }
    else if (preset === 'A3') { setSheetW(297); setSheetH(420); }
    else if (preset === '32x43') { setSheetW(320); setSheetH(430); }
    else if (preset === '33x48') { setSheetW(330); setSheetH(480); }
    else if (preset === '65x86') { setSheetW(650); setSheetH(860); }
    else if (preset === '79x109') { setSheetW(790); setSheetH(1090); }
  };

  const handleExecute = () => {
    // Convert mm to pt (1 mm = 2.83464567 pt)
    const MM_TO_PT = 2.83464567;
    const req: Partial<ImposeRequest> = {
      mode,
      sheet_w: sheetW * MM_TO_PT,
      sheet_h: sheetH * MM_TO_PT,
      rows,
      cols,
      margin: margin * MM_TO_PT,
      gutter: gutterH * MM_TO_PT,
      gutter_h: gutterH * MM_TO_PT,
      gutter_v: gutterV * MM_TO_PT,
      duplex,
      duplex_flip: duplexFlip,
      pack_rotate: packRotate,
      crop_marks: cropMarks,
      reg_marks: regMarks,
      num_scope: numbering ? 'each_piece' : 'off',
      num_start: numStart,
      num_before: numPrefix
    };
    onRunImpose(req);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <LayoutGrid className="w-4 h-4 text-cyan-400" />
          <span>Bình Bài In (Imposition)</span>
        </span>
      </div>

      {/* 1. Imposition Mode Selection */}
      <div className="space-y-1.5 mb-3">
        <label className="text-gray-400 font-medium">Kiểu Bình</label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'nup', label: 'N-Up (Xếp lưới)' },
            { id: 'step', label: 'Step & Repeat' },
            { id: 'booklet', label: 'Booklet (Đóng cuốn)' },
            { id: 'cut_stack', label: 'Cut & Stack' }
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as any)}
              className={`px-2.5 py-1.5 rounded border text-left font-medium transition ${
                mode === m.id
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-sm'
                  : 'bg-[#252525] border-[#333] text-gray-300 hover:bg-[#2c2c2c]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Sheet Preset & Dimensions */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="text-gray-300 font-bold block">Khổ Tờ In (Sheet Size)</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-gray-400">Khổ chuẩn</span>
            <select
              value={sheetPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5"
            >
              <option value="32x43">32 x 43 cm (In nhanh)</option>
              <option value="33x48">33 x 48 cm (Khổ lớn)</option>
              <option value="A4">A4 (21 x 29.7 cm)</option>
              <option value="A3">A3 (29.7 x 42 cm)</option>
              <option value="65x86">65 x 86 cm (Giấy lớn)</option>
              <option value="79x109">79 x 109 cm (Giấy lớn)</option>
              <option value="custom">Tùy chỉnh...</option>
            </select>
          </div>
          <div className="flex gap-1">
            <div>
              <span className="text-[10px] text-gray-400">Rộng (mm)</span>
              <input
                type="number"
                value={sheetW}
                onChange={(e) => { setSheetW(parseFloat(e.target.value) || 0); setSheetPreset('custom'); }}
                className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Cao (mm)</span>
              <input
                type="number"
                value={sheetH}
                onChange={(e) => { setSheetH(parseFloat(e.target.value) || 0); setSheetPreset('custom'); }}
                className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Grid Rows & Cols */}
      {mode !== 'booklet' && (
        <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
          <label className="text-gray-300 font-bold block">Ma Trận Xếp (Grid Layout)</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-gray-400">Số Cột (Cols)</span>
              <input
                type="number"
                value={cols}
                min={1}
                onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Số Hàng (Rows)</span>
              <input
                type="number"
                value={rows}
                min={1}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[#333]">
            <div>
              <span className="text-[10px] text-gray-400">Lề Biên (mm)</span>
              <input
                type="number"
                value={margin}
                onChange={(e) => setMargin(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Khe Ngang (mm)</span>
              <input
                type="number"
                value={gutterH}
                onChange={(e) => setGutterH(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Khe Dọc (mm)</span>
              <input
                type="number"
                value={gutterV}
                onChange={(e) => setGutterV(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
              />
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer mt-2 pt-2 border-t border-[#333]">
            <input
              type="checkbox"
              checked={packRotate}
              onChange={(e) => setPackRotate(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-cyan-500"
            />
            <span>Xếp xoay hỗn hợp (Tối ưu số con trên tờ in)</span>
          </label>
        </div>
      )}

      {/* 4. Duplex & Marks */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="text-gray-300 font-bold block">In 2 Mặt & Dấu Canh (Marks)</label>
        
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={duplex}
              onChange={(e) => setDuplex(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-cyan-500"
            />
            <span>In 2 mặt (Duplex)</span>
          </label>

          {duplex && (
            <select
              value={duplexFlip}
              onChange={(e) => setDuplexFlip(e.target.value as any)}
              className="bg-[#181818] border border-[#444] rounded px-2 py-0.5 text-xs text-gray-200"
            >
              <option value="long">Lật cạnh dài (Turn)</option>
              <option value="short">Lật cạnh ngắn (Tumble)</option>
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#333]">
          <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={cropMarks}
              onChange={(e) => setCropMarks(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-cyan-500"
            />
            <span>Thước xén (Crop marks)</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={regMarks}
              onChange={(e) => setRegMarks(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-cyan-500"
            />
            <span>Bon canh kê (Reg marks)</span>
          </label>
        </div>
      </div>

      {/* 5. Numbering */}
      <div className="space-y-2 mb-4 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="flex items-center gap-1.5 text-xs text-gray-300 font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={numbering}
            onChange={(e) => setNumbering(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-cyan-500"
          />
          <span>Đánh Số Thứ Tự / Số Nhảy</span>
        </label>

        {numbering && (
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <span className="text-[10px] text-gray-400">Tiền tố</span>
              <input
                type="text"
                value={numPrefix}
                onChange={(e) => setNumPrefix(e.target.value)}
                className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Bắt đầu từ</span>
              <input
                type="number"
                value={numStart}
                min={1}
                onChange={(e) => setNumStart(parseInt(e.target.value) || 1)}
                className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={handleExecute}
        disabled={isProcessing}
        className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
      >
        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
        <span>Thực Hiện Bình Bài</span>
      </button>
    </div>
  );
};
