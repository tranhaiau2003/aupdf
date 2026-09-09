import React, { useState } from 'react';
import { Database, Plus, Trash2, Play, RefreshCw, FileCode } from 'lucide-react';
import { VariableDataRequest, VarField } from '../../types';
import { toast } from '../Toast';

interface VdpPanelProps {
  onRunVdp: (req: VariableDataRequest) => void;
  isProcessing: boolean;
}

const MM_TO_PT = 2.83465;

export const VdpPanel: React.FC<VdpPanelProps> = ({ onRunVdp, isProcessing }) => {
  const [csv, setCsv] = useState<{ path: string; name: string } | null>(null);
  const [fields, setFields] = useState<VarField[]>([]);
  const [makeNewDoc, setMakeNewDoc] = useState(true);

  const handlePickCsv = async () => {
    const file = await window.api.openTextFile();
    if (file) setCsv({ path: file.path, name: file.name });
  };

  const addField = () => {
    setFields(prev => [...prev, { text: '', anchor: 'top-left', size: 12, off_x: 0, off_y: 0, rotate: 0 }]);
  };

  const updateField = (idx: number, patch: Partial<VarField>) => {
    setFields(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
  };

  const handleExecute = () => {
    if (!csv) {
      toast.error('Vui lòng chọn file dữ liệu CSV trước!');
      return;
    }
    onRunVdp({ src: '', out: '', csv_path: csv.path, new_doc: makeNewDoc, fields });
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <Database className="w-4 h-4 text-teal-400" />
          <span>In Dữ Liệu Biến Đổi (VDP)</span>
        </span>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
        Ghép nội dung biến đổi (tên, số serial...) từ file CSV vào từng bản sao của tài liệu.
        Trong nội dung trường có thể dùng placeholder lấy giá trị từng dòng CSV.
      </p>

      {/* File CSV */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="text-gray-300 font-bold block">File Dữ Liệu (CSV)</label>
        <button
          onClick={handlePickCsv}
          disabled={isProcessing}
          className="w-full py-1.5 bg-[#333] hover:bg-[#3d3d3d] text-teal-300 font-medium rounded border border-[#444] flex items-center justify-center gap-1.5 transition"
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>{csv ? 'Đổi file khác...' : 'Chọn file CSV...'}</span>
        </button>
        {csv && (
          <div className="truncate bg-[#1b1b1b] border border-[#383838] rounded px-2 py-1 text-[10px] text-teal-200 font-mono" title={csv.path}>
            ✓ {csv.name}
          </div>
        )}
      </div>

      {/* Danh sách trường */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <div className="flex items-center justify-between">
          <label className="text-gray-300 font-bold">Trường Nội Dung ({fields.length})</label>
          <button
            onClick={addField}
            className="flex items-center gap-1 px-2 py-0.5 bg-teal-900/60 hover:bg-teal-800 text-teal-200 rounded border border-teal-600 text-[11px]"
          >
            <Plus className="w-3 h-3" />
            <span>Thêm</span>
          </button>
        </div>

        {fields.length === 0 && (
          <p className="text-[10px] text-gray-500">Chưa có trường nào. Bấm "Thêm" để tạo nội dung in biến đổi.</p>
        )}

        <div className="max-h-64 overflow-y-auto space-y-2">
          {fields.map((f, idx) => (
            <div key={idx} className="bg-[#1b1b1b] p-2 rounded border border-[#383838] space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-teal-400 font-bold shrink-0">#{idx + 1}</span>
                <input
                  type="text"
                  value={f.text ?? ''}
                  placeholder="Nội dung / {{cot_csv}}"
                  onChange={(e) => updateField(idx, { text: e.target.value })}
                  className="flex-1 bg-[#141414] border border-[#444] rounded px-1.5 py-1 font-mono text-[10px]"
                />
                <button onClick={() => removeField(idx)} className="p-1 text-red-400 hover:text-red-300 shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <span className="text-[9px] text-gray-500">Cỡ (pt)</span>
                  <input
                    type="number"
                    value={f.size ?? 12}
                    onChange={(e) => updateField(idx, { size: parseFloat(e.target.value) || 12 })}
                    className="w-full bg-[#141414] border border-[#444] rounded px-1 py-0.5 font-mono text-[10px]"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-gray-500">Lệch X (mm)</span>
                  <input
                    type="number"
                    value={Math.round((f.off_x ?? 0) / MM_TO_PT)}
                    onChange={(e) => updateField(idx, { off_x: (parseFloat(e.target.value) || 0) * MM_TO_PT })}
                    className="w-full bg-[#141414] border border-[#444] rounded px-1 py-0.5 font-mono text-[10px]"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-gray-500">Lệch Y (mm)</span>
                  <input
                    type="number"
                    value={Math.round((f.off_y ?? 0) / MM_TO_PT)}
                    onChange={(e) => updateField(idx, { off_y: (parseFloat(e.target.value) || 0) * MM_TO_PT })}
                    className="w-full bg-[#141414] border border-[#444] rounded px-1 py-0.5 font-mono text-[10px]"
                  />
                </div>
              </div>
              <div>
                <span className="text-[9px] text-gray-500">Vị trí</span>
                <select
                  value={f.anchor ?? 'top-left'}
                  onChange={(e) => updateField(idx, { anchor: e.target.value })}
                  className="w-full bg-[#141414] border border-[#444] rounded px-1 py-0.5 text-[10px]"
                >
                  <option value="top-left">Trên-Trái</option>
                  <option value="top-center">Trên-Giữa</option>
                  <option value="top-right">Trên-Phải</option>
                  <option value="center">Chính giữa</option>
                  <option value="bottom-left">Dưới-Trái</option>
                  <option value="bottom-center">Dưới-Giữa</option>
                  <option value="bottom-right">Dưới-Phải</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-gray-300 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={makeNewDoc}
          onChange={(e) => setMakeNewDoc(e.target.checked)}
          className="accent-teal-500"
        />
        Xuất thành bộ tài liệu mới (mỗi dòng CSV = 1 bản)
      </label>

      <button
        onClick={handleExecute}
        disabled={isProcessing || !csv}
        className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
      >
        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
        <span>Ghép Dữ Liệu &amp; Xuất Bản In</span>
      </button>
    </div>
  );
};