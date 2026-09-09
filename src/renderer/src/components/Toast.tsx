import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

type PushFn = (type: ToastType, message: string) => void;

// Module-level bridge: any component can import { toast } and push a
// notification; the single <ToastHost /> mounted in App receives them.
let pushFn: PushFn = () => {};

export const toast = {
  success: (message: string) => pushFn('success', message),
  error: (message: string) => pushFn('error', message),
  info: (message: string) => pushFn('info', message),
};

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  error: <AlertTriangle className="w-4 h-4 text-red-400" />,
  info: <Info className="w-4 h-4 text-sky-400" />,
};

const BORDER: Record<ToastType, string> = {
  success: 'border-emerald-600/50',
  error: 'border-red-600/50',
  info: 'border-sky-600/50',
};

export const ToastHost: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushFn = (type, message) => {
      const id = Date.now() + Math.random();
      setItems(prev => [...prev.slice(-3), { id, type, message }]);
      window.setTimeout(() => {
        setItems(prev => prev.filter(t => t.id !== id));
      }, 4500);
    };
    return () => { pushFn = () => {}; };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-3 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
      {items.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 bg-[#252525] border ${BORDER[t.type]} rounded-lg shadow-xl shadow-black/40 px-3 py-2 text-xs text-gray-200`}
        >
          <div className="mt-0.5 shrink-0">{ICONS[t.type]}</div>
          <p className="flex-1 leading-relaxed break-words whitespace-pre-wrap">{t.message}</p>
          <button
            onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}
            className="text-gray-500 hover:text-gray-300 shrink-0"
            title="Đóng"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};