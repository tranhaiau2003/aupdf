import React, { useState, useEffect, useRef } from 'react';
import { 
  Header, 
  TabBar, 
  ToolBar, 
  CanvasViewer, 
  ThumbnailsGrid,
  StatusBar
} from './components';
import { ToastHost, toast } from './components/Toast';
import { 
  ImposePanel, 
  BoxesPanel, 
  BleedPanel, 
  NestingPanel, 
  OutputPreviewPanel, 
  PreflightPanel,
  LayersPanel,
  StampPanel,
  TilePanel,
  VdpPanel,
  BonPanel,
  KnockoutPanel,
  TrimShiftPanel
} from './components/panels';
import { 
  OpenedDocument, 
  SidecarState, 
  ActiveTool, 
  PageBoxes, 
  PageItem,
  ApplyBoxesRequest,
  PreflightReport,
  ImposeRequest,
  BleedRequest,
  NestRequest,
  OutputRenderRequest,
  LayerInfo,
  StampRequest,
  TileRequest,
  VariableDataRequest,
  BonRequest
} from './types';
import { apiClient } from './api/client';
import { nanoid } from 'nanoid';
import { FileText, Layers, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface HistorySnapshot {
  path: string;
  pageCount: number;
  currentPage: number;
  boxes: PageBoxes[];
}

// Type augmentation for window.api from preload
declare global {
  interface Window {
    api: {
      getSidecarState: () => Promise<any>;
      onSidecarState: (cb: (state: any) => void) => () => void;
      openPdf: () => Promise<Array<{ path: string; name: string; bytes: ArrayBuffer; size: number }>>;
      getPathForFile: (file: File) => string;
      savePdf: (defaultName?: string) => Promise<string | null>;
      readPdf: (path: string) => Promise<{ path: string; name: string; bytes: ArrayBuffer; size: number }>;
      tempPdfPath: () => Promise<string>;
      overwriteFile: (from: string, to: string) => Promise<void>;
      readImposeProfiles: () => Promise<{ last: any; profiles: any[] }>;
      writeImposeProfiles: (data: { last?: any; profiles: any[] }) => Promise<void>;
      exportImposeProfiles: (profiles: any[]) => Promise<boolean>;
      importImposeProfiles: () => Promise<any[] | null>;
      openTextFile: () => Promise<{ path: string; name: string; text: string } | null>;
      readBonPresets: () => Promise<{ presets: any[] }>;
      writeBonPresets: (data: { presets: any[] }) => Promise<void>;
      saveBonFile: (srcPath: string) => Promise<string>;
      onMenuAction: (cb: (action: string) => void) => () => void;
      recentGet: () => Promise<any[]>;
      recentAdd: (path: string) => Promise<any[]>;
      recentClear: () => Promise<void>;
      onOpenRecent: (cb: (path: string) => void) => () => void;
      notifyReady: () => void;
    };
  }
}

const INITIAL_SIDECAR_STATE: SidecarState = {
  status: 'stopped',
  info: null,
};

export const App: React.FC = () => {
  const loadedBytesPath = useRef<string | null>(null);
  // Global State
  const [sidecarState, setSidecarState] = useState<SidecarState>(INITIAL_SIDECAR_STATE);
  const [documents, setDocuments] = useState<OpenedDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('impose');
  const [zoom, setZoom] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageBoxes, setPageBoxes] = useState<PageBoxes[]>([]);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null);
  const [outputPreviewUrl, setOutputPreviewUrl] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [leftPanel, setLeftPanel] = useState<'pages' | 'layers' | 'none'>('pages');
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const historyRef = useRef<Record<string, { undo: HistorySnapshot[]; redo: HistorySnapshot[] }>>({});
  
  // Native menu/keyboard listeners are installed once. Route them through a
  // ref so they always use the latest document state instead of the initial
  // render's stale closures.
  const actionHandlersRef = useRef({
    handleMenuAction: (_action: string) => {},
    openPdfByPath: async (_path: string) => {},
    handleOpenPdf: async () => {},
    handleSavePdf: async () => {},
    handleSaveAsPdf: async () => {},
    handleCloseTab: (_id: string) => {},
  });
  
  // Derived state
  const activeDoc = documents.find(d => d.id === activeDocId) || null;
  const pageCount = activeDoc?.pageCount || 0;

  // Initialize sidecar state listener
  useEffect(() => {
    const cleanup = window.api.onSidecarState((state) => {
      setSidecarState(state);
      if (state.info) {
        apiClient.setCredentials(state.info);
      } else {
        apiClient.setCredentials(null);
      }
    });
    window.api.getSidecarState().then((state) => {
      setSidecarState(state);
      apiClient.setCredentials(state.info || null);
    });
    window.api.notifyReady();
    return cleanup;
  }, []);

  // Menu action listener
  useEffect(() => {
    const cleanup = window.api.onMenuAction((action) => {
      actionHandlersRef.current.handleMenuAction(action);
    });
    return cleanup;
  }, []);

  // Open recent file listener
  useEffect(() => {
    const cleanup = window.api.onOpenRecent(async (path) => {
      await actionHandlersRef.current.openPdfByPath(path);
    });
    return cleanup;
  }, []);

  // Load page boxes when active doc changes
  useEffect(() => {
    let cancelled = false;
    if (activeDoc?.path) {
      if (activeDoc.boxes) setPageBoxes(activeDoc.boxes);
      else loadPageBoxes(activeDoc.path);
      // Load raw PDF bytes for the canvas viewer
      if (loadedBytesPath.current !== activeDoc.path) window.api.readPdf(activeDoc.path)
        .then((file) => {
          if (!cancelled) { loadedBytesPath.current = activeDoc.path; setPdfBytes(file.bytes); }
        }).catch((error) => {
          console.error('Error loading PDF bytes for viewer:', error);
          if (!cancelled) {
            setPdfBytes(null);
            toast.error('Không đọc được nội dung file: ' + (error as Error).message);
          }
        });
    } else {
      setPageBoxes([]);
      setPdfBytes(null);
    }
    return () => {
      cancelled = true;
    };
  }, [activeDoc?.path]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        void actionHandlersRef.current.handleOpenPdf();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) void actionHandlersRef.current.handleSaveAsPdf();
        else void actionHandlersRef.current.handleSavePdf();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeDocId) actionHandlersRef.current.handleCloseTab(activeDocId);
      }
      // Tool shortcuts 1-9. Never steal digits while the user is entering a
      // value in a form control (number fields are used throughout the tool
      // panels). This was the cause of numeric input jumping to other tools.
      const target = e.target as HTMLElement | null;
      const isEditableTarget = !!target && (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      );
      if (!isEditableTarget && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        const toolIndex = parseInt(e.key) - 1;
        const tools: ActiveTool[] = [
          'view', 'organize', 'impose', 'boxes', 'bleed', 
          'nest', 'output_preview', 'preflight', 'vdp'
        ];
        if (tools[toolIndex] === 'organize') {
          setLeftPanel('pages');
          setActiveTool('view');
        } else if (tools[toolIndex]) {
          setActiveTool(tools[toolIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDocId]);

  // ==================== Document Handlers ====================

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only hide the overlay when leaving the root container itself
    if (e.currentTarget === e.target) setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || [])
      .filter(f => /\.(pdf|png|jpe?g|webp|bmp|gif|ico|svg)$/i.test(f.name));
    if (files.length === 0) {
      toast.info('Hỗ trợ PDF, PNG, JPG, WEBP, BMP, GIF, ICO và SVG.');
      return;
    }
    for (const f of files) {
      const path = window.api.getPathForFile(f);
      if (!path) {
        toast.error('Không lấy được đường dẫn file: ' + f.name);
        continue;
      }
      await openPdfByPath(path);
    }
  };

  
  const handleOpenPdf = async () => {
    try {
      const files = await window.api.openPdf();
      if (files.length === 0) return;
      
      for (const file of files) {
        await addDocument(file.path, file.name, file.bytes, file.size);
      }
    } catch (error) {
      console.error('Error opening document:', error);
      toast.error('Không thể mở file: ' + (error as Error).message);
    }
  };

  const openPdfByPath = async (path: string) => {
    try {
      const file = await window.api.readPdf(path);
      await addDocument(file.path, file.name, file.bytes, file.size);
    } catch (error) {
      console.error('Error opening recent PDF:', error);
      toast.error('Không thể mở file: ' + (error as Error).message);
    }
  };

  const addDocument = async (path: string, name: string, bytes: ArrayBuffer, size: number) => {
    setIsProcessing(true);
    try {
      // Get page count and boxes from sidecar
      const boxesResponse = await apiClient.getBoxes(path);
      const pageCount = boxesResponse.pages.length;
      
      const newDoc: OpenedDocument = {
        id: nanoid(),
        path,
        name,
        size,
        pageCount,
        currentPage: 1,
        boxes: boxesResponse.pages,
        isDirty: false,
      };
      
      setDocuments(prev => [...prev, newDoc]);
      setActiveDocId(newDoc.id);
      // We already have the bytes from the open dialog; avoid reading the
      // same file a second time when the active-document effect runs.
      setPdfBytes(bytes);
      loadedBytesPath.current = path;
      // A newly opened document must always start at page 1. Keeping the
      // previous document's page index can leave the viewer on a non-existent
      // page and appear blank.
      setCurrentPage(1);
      // Only real user files belong in Recent. Engine temp outputs
      // (pdf-prepress-*.pdf) must NOT pollute it — otherwise clicking a
      // stale temp entry later fails to open (file gone from temp).
      if (!path.includes('pdf-prepress-')) {
        await window.api.recentAdd(path);
      }
    } catch (error) {
      console.error('Error adding document:', error);
      toast.error('Lỗi khi tải tài liệu: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadPageBoxes = async (path: string) => {
    try {
      const response = await apiClient.getBoxes(path);
      setPageBoxes(response.pages);
      
      // Update document with boxes
      setDocuments(prev => prev.map(doc => 
        doc.path === path ? { ...doc, boxes: response.pages } : doc
      ));
    } catch (error) {
      console.error('Error loading page boxes:', error);
    }
  };

  const handleSavePdf = async () => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      // If document is dirty, we need to save the processed version
      // For now, just overwrite the original if it's a temp file
      if (activeDoc.path.includes('pdf-prepress-')) {
        const savePath = await window.api.savePdf(activeDoc.name);
        if (savePath) {
          await window.api.overwriteFile(activeDoc.path, savePath);
          setDocuments(prev => prev.map(doc => 
            doc.id === activeDocId ? { ...doc, path: savePath, isDirty: false } : doc
          ));
          toast.success('Đã lưu tài liệu.');
        }
      }
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast.error('Lỗi khi lưu: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAsPdf = async () => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const savePath = await window.api.savePdf(activeDoc.name);
      if (savePath) {
        await window.api.overwriteFile(activeDoc.path, savePath);
        setDocuments(prev => prev.map(doc => 
          doc.id === activeDocId ? { ...doc, path: savePath, name: savePath.split(/[\\/]/).pop()!, isDirty: false } : doc
        ));
        await window.api.recentAdd(savePath);
        toast.success('Đã lưu bản mới: ' + savePath.split(/[\\/]/).pop());
      }
    } catch (error) {
      console.error('Error saving as PDF:', error);
      toast.error('Lỗi khi lưu mới: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseTab = (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc?.isDirty) {
      if (!confirm('Tài liệu này chưa được lưu. Bạn có chắc chắn muốn đóng?')) return;
    }
    setDocuments(prev => {
      const next = prev.filter(d => d.id !== id);
      if (next.length > 0 && activeDocId === id) {
        setActiveDocId(next[next.length - 1].id);
      } else if (next.length === 0) {
        setActiveDocId(null);
        setCurrentPage(1);
        setPageBoxes([]);
      }
      return next;
    });
  };

  const handleSelectTab = (id: string) => {
    setActiveDocId(id);
    const doc = documents.find(d => d.id === id);
    if (doc) {
      setCurrentPage(doc.currentPage);
      if (doc.boxes) setPageBoxes(doc.boxes);
    }
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > pageCount) return;
    setCurrentPage(page);
    if (activeDocId) {
      setDocuments(prev => prev.map(doc => 
        doc.id === activeDocId ? { ...doc, currentPage: page } : doc
      ));
    }
  };

  const handleApplyPages = async (arrangement: PageItem[]) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response = await apiClient.applyPages({
        src: activeDoc.path,
        out: tempPath,
        arrangement,
      });
      
      await replaceActiveWithOutput(response.out);
    } catch (error) {
      console.error('Error applying pages:', error);
      toast.error('Lỗi khi áp dụng thay đổi trang: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== Tool Handlers ====================

  const runImpose = async (req: Partial<ImposeRequest>) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response = await apiClient.impose({
        src: activeDoc.path,
        out: tempPath,
        ...req,
      } as ImposeRequest);
      
      // Open result as new tab
      const file = await window.api.readPdf(response.out);
      const boxesResponse = await apiClient.getBoxes(response.out);
      await addDocument(response.out, 'Imposed - ' + activeDoc.name, file.bytes, file.size);
    } catch (error) {
      console.error('Error running imposition:', error);
      toast.error('Lỗi bình bài: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runBoxes = async (req: Partial<ApplyBoxesRequest>) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response = await apiClient.applyBoxes({
        src: activeDoc.path,
        out: tempPath,
        pages: Array.from({ length: pageCount }, (_, i) => i),
        ...req,
      } as ApplyBoxesRequest);
      
      await replaceActiveWithOutput(response.out);
    } catch (error) {
      console.error('Error applying boxes:', error);
      toast.error('Lỗi khi áp dụng boxes: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runAutoContentBBox = async () => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const response = await apiClient.getContentBBox(activeDoc.path, 
        Array.from({ length: pageCount }, (_, i) => i)
      );
      
      const detected = response.items.filter(
        (item): item is typeof item & { rect: number[] } => Array.isArray(item.rect)
      );
      if (detected.length === 0) {
        toast.info('Không tìm thấy vùng nội dung trên các trang đã quét.');
        return;
      }

      // Box edits apply the same edit to every page in `pages`. Process each
      // detected rectangle separately so multi-page PDFs retain their own
      // content bounds instead of all receiving the last page's TrimBox.
      let sourcePath = activeDoc.path;
      for (const item of detected) {
        const tempPath = await window.api.tempPdfPath();
        const result = await apiClient.applyBoxes({
          src: sourcePath,
          out: tempPath,
          pages: [item.page],
          box_edits: [{ target: 'trim', rect: item.rect }],
        });
        sourcePath = result.out;
      }
      await replaceActiveWithOutput(sourcePath);
    } catch (error) {
      console.error('Error detecting content bbox:', error);
      toast.error('Lỗi quét nội dung: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runBleed = async (req: Partial<BleedRequest>) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response = await apiClient.defineBleed({
        src: activeDoc.path,
        out: tempPath,
        pages: Array.from({ length: pageCount }, (_, i) => i),
        ...req,
      } as BleedRequest);
      
      await replaceActiveWithOutput(response.out);
    } catch (error) {
      console.error('Error running bleed:', error);
      toast.error('Lỗi tạo bleed: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runNest = async (req: NestRequest) => {
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response = await apiClient.nest({
        ...req,
        out: tempPath,
      });
      
      if (response.page_count > 0) {
        const file = await window.api.readPdf(response.out);
        const boxesResponse = await apiClient.getBoxes(response.out);
        await addDocument(response.out, 'Nested - ' + new Date().toLocaleTimeString(), file.bytes, file.size);
      } else {
        toast.info('Không thể gộp bài: Không có chi tiết nào được xếp.');
      }
    } catch (error) {
      console.error('Error running nesting:', error);
      toast.error('Lỗi gộp bài: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runPreflight = async () => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const report = await apiClient.runPreflight(activeDoc.path);
      setPreflightReport(report);
    } catch (error) {
      console.error('Error running preflight:', error);
      toast.error('Lỗi kiểm tra preflight: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderPlate = async (req: OutputRenderRequest) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const blob = await apiClient.renderOutputPreview({
        ...req,
        path: activeDoc.path,
      });
      
      // Keep the generated image inside the app. Opening a blob URL in a new
      // window is intercepted by Electron's external-link handler and cannot
      // be resolved by the operating system system.
      setOutputPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Error rendering plate:', error);
      toast.error('Lỗi render bản kẽm: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (outputPreviewUrl) URL.revokeObjectURL(outputPreviewUrl);
    };
  }, [outputPreviewUrl]);

  // ==================== Layers / Stamp / Tile / VDP / Bon / Knockout ====================

  const replaceActiveWithOutput = async (outPath: string) => {
    if (!activeDoc) return;
    const history = historyRef.current[activeDoc.id] || { undo: [], redo: [] };
    history.undo.push({ path: activeDoc.path, pageCount: activeDoc.pageCount, currentPage, boxes: activeDoc.boxes || pageBoxes });
    history.redo = [];
    historyRef.current[activeDoc.id] = history;
    const boxesResponse = await apiClient.getBoxes(outPath);
    const nextPageCount = boxesResponse.pages.length;
    const nextCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(nextPageCount, 1));
    setDocuments(prev => prev.map(doc =>
      doc.id === activeDocId
        ? {
            ...doc,
            path: outPath,
            pageCount: nextPageCount,
            currentPage: nextCurrentPage,
            boxes: boxesResponse.pages,
            isDirty: true,
          }
        : doc
    ));
    setPageBoxes(boxesResponse.pages);
    setCurrentPage(nextCurrentPage);
  };

  const restoreHistory = async (direction: 'undo' | 'redo') => {
    if (!activeDoc || isProcessing) return;
    const history = historyRef.current[activeDoc.id];
    const source = history?.[direction];
    if (!source?.length) return;
    const snapshot = source.pop()!;
    const other = direction === 'undo' ? history.redo : history.undo;
    other.push({ path: activeDoc.path, pageCount: activeDoc.pageCount, currentPage, boxes: activeDoc.boxes || pageBoxes });
    setDocuments(prev => prev.map(doc => doc.id === activeDoc.id ? { ...doc, path: snapshot.path, pageCount: snapshot.pageCount, currentPage: snapshot.currentPage, boxes: snapshot.boxes, isDirty: true } : doc));
    loadedBytesPath.current = null;
    setPageBoxes(snapshot.boxes);
    setCurrentPage(snapshot.currentPage);
    toast.success(direction === 'undo' ? 'Đã hoàn tác thay đổi.' : 'Đã làm lại thay đổi.');
  };

  const canUndo = !!activeDoc && (historyRef.current[activeDoc.id]?.undo.length || 0) > 0;
  const canRedo = !!activeDoc && (historyRef.current[activeDoc.id]?.redo.length || 0) > 0;

  const openOutputAsNewTab = async (outPath: string, titlePrefix: string) => {
    const file = await window.api.readPdf(outPath);
    await addDocument(outPath, titlePrefix + ' - ' + (activeDoc?.name || ''), file.bytes, file.size);
  };

  const loadLayers = async () => {
    if (!activeDoc?.path) return;
    try {
      const resp = await apiClient.getLayers(activeDoc.path);
      setLayers(resp.layers);
    } catch (error) {
      console.error('Error loading layers:', error);
      setLayers([]);
    }
  };

  useEffect(() => {
    if (activeTool === 'layers') loadLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, activeDoc?.path]);

  const runLayerVisibility = async (overrides: Record<number, boolean>): Promise<boolean> => {
    if (!activeDoc) return false;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response: any = await apiClient.setLayerVisibility(activeDoc.path, tempPath, overrides);
      await replaceActiveWithOutput(response.out || tempPath);
      await loadLayers();
      return true;
    } catch (error) {
      console.error('Error applying layer visibility:', error);
      toast.error('Lỗi áp dụng hiển thị layer: ' + (error as Error).message);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const runFlattenLayers = async () => {
    if (!activeDoc) return;
    if (!confirm('Gộp cứng toàn bộ layer? Hành động này không thể hoàn tác.')) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response: any = await apiClient.flattenLayers(activeDoc.path, tempPath);
      await replaceActiveWithOutput(response.out || tempPath);
      setLayers([]);
    } catch (error) {
      console.error('Error flattening layers:', error);
      toast.error('Lỗi gộp layer: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runStamp = async (req: Omit<StampRequest, 'src' | 'out'>) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response: any = await apiClient.stamp({
        src: activeDoc.path,
        out: tempPath,
        ...req,
      });
      if (req.new_doc) await openOutputAsNewTab(response.out, 'Stamped');
      else await replaceActiveWithOutput(response.out);
    } catch (error) {
      console.error('Error running stamp:', error);
      toast.error('Lỗi đánh số/đóng dấu: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runTile = async (req: Omit<TileRequest, 'src' | 'out'>) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response: any = await apiClient.tile({
        src: activeDoc.path,
        out: tempPath,
        ...req,
      });
      if (req.new_doc) await openOutputAsNewTab(response.out, 'Tiled');
      else await replaceActiveWithOutput(response.out);
    } catch (error) {
      console.error('Error running tile:', error);
      toast.error('Lỗi cắt khổ lớn: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runVdp = async (req: VariableDataRequest) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response: any = await apiClient.variableData({
        src: activeDoc.path,
        out: tempPath,
        ...req,
      });
      if (req.new_doc) await openOutputAsNewTab(response.out, 'VDP');
      else await replaceActiveWithOutput(response.out);
    } catch (error) {
      console.error('Error running VDP:', error);
      toast.error('Lỗi in dữ liệu biến đổi: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runKnockout = async (opts: { pages: number[]; tolerance: number; dpi: number }) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response: any = await apiClient.knockout(
        activeDoc.path, tempPath, opts.pages, opts.tolerance, opts.dpi
      );
      await replaceActiveWithOutput(response.out || tempPath);
    } catch (error) {
      console.error('Error running knockout:', error);
      toast.error('Lỗi tạo lót trắng: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runBon = async (req: Partial<BonRequest>) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response: any = await apiClient.applyBon({
        src: activeDoc.path,
        out: tempPath,
        ...req,
      });
      const out: unknown = response?.out;
      if (typeof out === 'string' && out.toLowerCase().endsWith('.bon')) {
        let savedPath: string | null = null;
        try {
          savedPath = await window.api.saveBonFile(out);
        } catch { /* user canceled save dialog */ }
        if (savedPath) {
          toast.success('Đã xuất file bôn cho máy cắt:\n' + savedPath);
        }
      } else if (typeof out === 'string') {
        if (req.target === 'current') await replaceActiveWithOutput(out);
        else await openOutputAsNewTab(out, 'BON');
      } else {
        toast.error('Engine không trả về file kết quả cho lệnh bôn.');
      }
    } catch (error) {
      console.error('Error running BON:', error);
      toast.error('Lỗi tạo file bôn: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runTrimShift = async (opts: { pages: number[]; shift_x: number; shift_y: number; creep_mode?: string }) => {
    if (!activeDoc) return;
    setIsProcessing(true);
    try {
      const tempPath = await window.api.tempPdfPath();
      const response: any = await apiClient.trimShift(
        activeDoc.path, tempPath, opts.pages, opts.shift_x, opts.shift_y, opts.creep_mode
      );
      await replaceActiveWithOutput(response.out || tempPath);
    } catch (error) {
      console.error('Error running trim shift:', error);
      toast.error('Lỗi dịch xén: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMenuAction = (action: string) => {
    switch (action) {
      case 'openPdf':
        handleOpenPdf();
        break;
      case 'save':
        handleSavePdf();
        break;
      case 'saveAs':
        handleSaveAsPdf();
        break;
      case 'closeTab':
        if (activeDocId) handleCloseTab(activeDocId);
        break;
      case 'tool:view':
        setActiveTool('view');
        break;
      case 'tool:organize':
        setLeftPanel('pages');
        setActiveTool('view');
        break;
      case 'tool:impose':
        setActiveTool('impose');
        break;
      case 'tool:boxes':
        setActiveTool('boxes');
        break;
      case 'tool:bleed':
        setActiveTool('bleed');
        break;
      case 'tool:nest':
        setActiveTool('nest');
        break;
      case 'tool:output_preview':
        setActiveTool('output_preview');
        break;
      case 'tool:preflight':
        setActiveTool('preflight');
        break;
      case 'tool:vdp':
        setActiveTool('vdp');
        break;
      case 'tool:tile':
        setActiveTool('tile');
        break;
      case 'tool:stamp':
        setActiveTool('stamp');
        break;
      case 'tool:bon':
        setActiveTool('bon');
        break;
      case 'tool:layers':
        setLeftPanel('layers');
        setActiveTool('view');
        break;
      case 'tool:knockout':
        setActiveTool('knockout');
        break;
      case 'tool:trimshift':
        setActiveTool('trimshift');
        break;
    }
  };

  const handleToolSelection = (tool: ActiveTool) => {
    if (tool === 'organize') {
      setLeftPanel('pages');
      setActiveTool('view');
      return;
    }
    if (tool === 'layers') {
      setLeftPanel('layers');
      setActiveTool('view');
      return;
    }
    setActiveTool(tool);
  };

  const handleFitPage = () => window.dispatchEvent(new Event('aupdf:fit-page'));

  const startLeftPanelResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = leftPanelWidth;
    const onMove = (moveEvent: MouseEvent) => {
      setLeftPanelWidth(Math.min(520, Math.max(240, startWidth + moveEvent.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  actionHandlersRef.current = {
    handleMenuAction,
    openPdfByPath,
    handleOpenPdf,
    handleSavePdf,
    handleSaveAsPdf,
    handleCloseTab,
  };

  // ==================== Render Active Panel ====================
  
  const renderActivePanel = () => {
    if (!activeDoc) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-4">📄</div>
            <p className="text-lg">Chưa có tài liệu nào mở</p>
            <p className="text-sm text-gray-400 mt-2">Nhấn Ctrl+O để mở PDF hoặc ảnh từ máy tính</p>
          </div>
        </div>
      );
    }

    const currentBoxInfo = pageBoxes[currentPage - 1];

    switch (activeTool) {
      case 'impose':
        return <ImposePanel onRunImpose={runImpose} isProcessing={isProcessing} />;
      case 'boxes':
        return (
          <BoxesPanel 
            currentPageBoxes={currentBoxInfo}
            currentPage={currentPage}
            pageCount={pageCount}
            onApplyBoxes={runBoxes}
            onAutoContentBBox={runAutoContentBBox}
            isProcessing={isProcessing}
          />
        );
      case 'bleed':
        return <BleedPanel onRunBleed={runBleed} isProcessing={isProcessing} />;
      case 'nest':
        return (
          <NestingPanel 
            onRunNest={runNest} 
            isProcessing={isProcessing} 
            activeDocPath={activeDoc.path}
          />
        );
      case 'output_preview':
        return (
          <OutputPreviewPanel 
            onRenderPlate={renderPlate} 
            isProcessing={isProcessing} 
            previewUrl={outputPreviewUrl}
          />
        );
      case 'preflight':
        return (
          <PreflightPanel 
            report={preflightReport}
            onRunPreflight={runPreflight}
            isProcessing={isProcessing}
          />
        );
      case 'layers':
        return (
          <LayersPanel
            layers={layers}
            onReload={loadLayers}
            onApplyVisibility={runLayerVisibility}
            onFlatten={runFlattenLayers}
            isProcessing={isProcessing}
          />
        );
      case 'stamp':
        return (
          <StampPanel
            onRunStamp={runStamp}
            isProcessing={isProcessing}
            currentPage={currentPage}
            pageCount={pageCount}
          />
        );
      case 'tile':
        return (
          <TilePanel
            onRunTile={runTile}
            isProcessing={isProcessing}
            currentPage={currentPage}
            pageCount={pageCount}
          />
        );
      case 'vdp':
        return (
          <VdpPanel
            onRunVdp={runVdp}
            isProcessing={isProcessing}
          />
        );
      case 'bon':
        return (
          <BonPanel
            onRunBon={runBon}
            isProcessing={isProcessing}
            activeDocPath={activeDoc.path}
          />
        );
      case 'knockout':
        return (
          <KnockoutPanel
            onRunKnockout={runKnockout}
            isProcessing={isProcessing}
            currentPage={currentPage}
            pageCount={pageCount}
          />
        );
      case 'trimshift':
        return (
          <TrimShiftPanel
            onRunTrimShift={runTrimShift}
            isProcessing={isProcessing}
            currentPage={currentPage}
            pageCount={pageCount}
          />
        );
      case 'organize':
        return (
          <ThumbnailsGrid
            pageCount={pageCount}
            currentPage={currentPage}
            onSelectPage={handlePageChange}
            onApplyPages={handleApplyPages}
            pdfBytes={pdfBytes}
          />
        );
      case 'view':
      default:
        return (
          <CanvasViewer
            pdfBytes={pdfBytes}
            docPath={activeDoc.path}
            currentPage={currentPage}
            pageCount={pageCount}
            onPageChange={handlePageChange}
            zoom={zoom}
            onZoomChange={setZoom}
            boxes={pageBoxes}
            onUndo={() => void restoreHistory('undo')}
            onRedo={() => void restoreHistory('redo')}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        );
    }
  };

  // ==================== Render ====================
  
  return (
    <div
      className="h-screen w-full flex flex-col bg-[#141414] text-gray-100 font-sans antialiased"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 z-[90] bg-cyan-950/40 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-cyan-400 rounded-2xl px-12 py-8 bg-[#141414]/90 text-center shadow-2xl">
            <div className="text-4xl mb-2">📥</div>
            <p className="text-cyan-200 font-bold text-sm">Thả PDF hoặc ảnh vào đây để mở</p>
            <p className="text-cyan-400/70 text-xs mt-1">PDF, PNG, JPG, WEBP, BMP, GIF, ICO, SVG</p>
          </div>
        </div>
      )}
      <Header
        activeDoc={activeDoc}
        onOpenPdf={handleOpenPdf}
        onSavePdf={handleSavePdf}
        onSaveAsPdf={handleSaveAsPdf}
        zoom={zoom}
        onZoomChange={setZoom}
        onFitPage={handleFitPage}
        isProcessing={isProcessing}
      />
      
      <TabBar
        documents={documents}
        activeId={activeDocId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
      />

      <ToolBar
        activeTool={activeTool}
        onSelectTool={handleToolSelection}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Acrobat-style left navigation and contextual panel */}
        <nav className="w-12 bg-[#171717] border-r border-[#303030] flex flex-col items-center py-2 gap-2 shrink-0">
          <button
            onClick={() => setLeftPanel(leftPanel === 'pages' ? 'none' : 'pages')}
            className={`w-8 h-8 rounded flex items-center justify-center transition ${leftPanel === 'pages' ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/50' : 'text-gray-400 hover:bg-[#292929] hover:text-white'}`}
            title="Trang & sắp xếp trang"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLeftPanel(leftPanel === 'layers' ? 'none' : 'layers')}
            className={`w-8 h-8 rounded flex items-center justify-center transition ${leftPanel === 'layers' ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/50' : 'text-gray-400 hover:bg-[#292929] hover:text-white'}`}
            title="Layers"
          >
            <Layers className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setLeftPanel(leftPanel === 'none' ? 'pages' : 'none')}
            className="w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:bg-[#292929] hover:text-white"
            title={leftPanel === 'none' ? 'Mở bảng bên trái' : 'Thu gọn bảng bên trái'}
          >
            {leftPanel === 'none' ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </nav>

        {leftPanel !== 'none' && (
          <aside style={{ width: leftPanelWidth }} className="relative bg-[#1b1b1b] border-r border-[#303030] shrink-0 flex flex-col min-w-0">
            <div className="h-10 px-3 flex items-center justify-between border-b border-[#303030] text-xs font-semibold text-gray-200">
              <span>{leftPanel === 'pages' ? 'Trang & Sắp Xếp' : 'Layers'}</span>
              <button onClick={() => setLeftPanel('none')} className="text-gray-500 hover:text-white" title="Đóng bảng">×</button>
            </div>
            {leftPanel === 'pages' ? (
              activeDoc ? <ThumbnailsGrid pageCount={pageCount} currentPage={currentPage} onSelectPage={handlePageChange} onApplyPages={handleApplyPages} pdfBytes={pdfBytes} compact /> : (
                <div className="flex-1 flex items-center justify-center px-6 text-center text-xs text-gray-500">Mở một tài liệu để xem thumbnail trang.</div>
              )
            ) : (
              activeDoc ? <LayersPanel layers={layers} onReload={loadLayers} onApplyVisibility={runLayerVisibility} onFlatten={runFlattenLayers} isProcessing={isProcessing} /> : (
                <div className="flex-1 flex items-center justify-center px-6 text-center text-xs text-gray-500">Mở một tài liệu để xem layer.</div>
              )
            )}
            <div
              onMouseDown={startLeftPanelResize}
              className="absolute top-0 -right-1 z-30 h-full w-2 cursor-col-resize hover:bg-cyan-400/50 active:bg-cyan-400/70 transition"
              title="Kéo để đổi độ rộng bảng"
            />
          </aside>
        )}
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Center: Viewer or Panel */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeTool === 'organize' ? (
              // Organize mode: full height thumbnails
              activeDoc ? (
                <ThumbnailsGrid
                  pageCount={pageCount}
                  currentPage={currentPage}
                  onSelectPage={handlePageChange}
                  onApplyPages={handleApplyPages}
                  pdfBytes={pdfBytes}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-4">📄</div>
                    <p className="text-lg">Chưa có tài liệu nào mở</p>
                    <p className="text-sm text-gray-400 mt-2">Nhấn Ctrl+O để mở PDF hoặc ảnh từ máy tính</p>
                  </div>
                </div>
              )
            ) : activeTool === 'view' ? (
              // View mode: Canvas viewer with thumbnails at bottom
              activeDoc ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <CanvasViewer
                    pdfBytes={pdfBytes}
                    docPath={activeDoc.path}
                    currentPage={currentPage}
                    pageCount={pageCount}
                    onPageChange={handlePageChange}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    boxes={pageBoxes}
                    onUndo={() => void restoreHistory('undo')}
                    onRedo={() => void restoreHistory('redo')}
                    canUndo={canUndo}
                    canRedo={canRedo}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-4">📄</div>
                    <p className="text-lg">Chưa có tài liệu nào mở</p>
                    <p className="text-sm text-gray-400 mt-2">Nhấn Ctrl+O để mở PDF hoặc ảnh từ máy tính</p>
                  </div>
                </div>
              )
            ) : (
              // Other tools: Panel on right, viewer on left
              activeDoc ? (
                <div className="flex-1 flex min-h-0">
                  <div className="flex-1 flex flex-col min-w-0">
                    <CanvasViewer
                      pdfBytes={pdfBytes}
                      docPath={activeDoc.path}
                      currentPage={currentPage}
                      pageCount={pageCount}
                      onPageChange={handlePageChange}
                      zoom={zoom}
                      onZoomChange={setZoom}
                      boxes={pageBoxes}
                      onUndo={() => void restoreHistory('undo')}
                      onRedo={() => void restoreHistory('redo')}
                      canUndo={canUndo}
                      canRedo={canRedo}
                    />
                  </div>
                  <div className="w-80 border-l border-[#2d2d2d] bg-[#1e1e1e] shrink-0 overflow-y-auto">
                    {renderActivePanel()}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-4">📄</div>
                    <p className="text-lg">Chưa có tài liệu nào mở</p>
                    <p className="text-sm text-gray-400 mt-2">Nhấn Ctrl+O để mở PDF hoặc ảnh từ máy tính</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
      <StatusBar
        docName={activeDoc?.name || null}
        currentPage={currentPage}
        pageCount={pageCount}
        currentPageBoxes={pageBoxes[currentPage - 1]}
        zoom={zoom}
        isProcessing={isProcessing}
      />
      <ToastHost />
    </div>
  );
};

export default App;
