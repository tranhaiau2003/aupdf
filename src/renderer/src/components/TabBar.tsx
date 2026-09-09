import React from 'react';
import { X, FileText } from 'lucide-react';
import { OpenedDocument } from '../types';

interface TabBarProps {
  documents: OpenedDocument[];
  activeId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  documents,
  activeId,
  onSelectTab,
  onCloseTab
}) => {
  if (documents.length === 0) return null;

  return (
    <div className="h-8 bg-[#141414] border-b border-[#2d2d2d] flex items-center px-2 gap-1 overflow-x-auto select-none">
      {documents.map((doc) => {
        const isActive = doc.id === activeId;
        return (
          <div
            key={doc.id}
            onClick={() => onSelectTab(doc.id)}
            className={`group flex items-center gap-2 px-3 py-1 text-xs rounded-t border-t border-x cursor-pointer transition max-w-[200px] ${
              isActive 
                ? 'bg-[#1e1e1e] text-cyan-300 border-[#3d3d3d] font-medium shadow-sm' 
                : 'bg-[#181818] text-gray-400 border-transparent hover:bg-[#222222] hover:text-gray-200'
            }`}
            title={doc.path}
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
            <span className="truncate flex-1">{doc.name}</span>
            {doc.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(doc.id);
              }}
              className="p-0.5 rounded hover:bg-[#333] hover:text-white text-gray-500 transition"
              title="Đóng tab"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
