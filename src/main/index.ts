import { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join, dirname, resolve, resolve as pathResolve } from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import os from 'os';
import { PDFDocument } from 'pdf-lib';

// In CommonJS, __dirname is available globally
// This file will be compiled to CommonJS where __dirname exists
declare const __dirname: string;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

interface SidecarInfo {
  port: number;
  token: string;
}

let mainWindow: BrowserWindow | null = null;
let sidecarProcess: ChildProcessWithoutNullStreams | null = null;
let sidecarInfo: SidecarInfo | null = null;
let sidecarRestartCount = 0;
const MAX_SIDECAR_RESTARTS = 3;

// ==== Mở tài liệu qua double-click / dòng lệnh ====
let pendingOpenPath: string | null = null;
let rendererReady = false;

const PDF_EXTENSIONS = new Set(['.pdf']);
// Ảnh được chuyển cục bộ thành PDF một trang để dùng được toàn bộ công cụ prepress.
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.ico', '.svg']);
const OPENABLE_EXTENSIONS = new Set([...PDF_EXTENSIONS, ...IMAGE_EXTENSIONS]);

function extensionOf(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() || '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

/** Tìm đường dẫn tệp được ứng dụng hỗ trợ trong argv (double-click/Open with). */
function documentFromArgv(argv: string[]): string | null {
  for (const a of argv) {
    if (typeof a === 'string' && OPENABLE_EXTENSIONS.has(extensionOf(a)) && fs.existsSync(a)) return a;
  }
  return null;
}

function openDocumentPathInRenderer(p: string) {
  mainWindow?.webContents.send('menu:openRecent', p);
}

/** Nhập ảnh thành PDF để engine (vốn xử lý PDF) có thể dùng mọi công cụ sẵn có. */
async function readOpenableDocument(filePath: string): Promise<{ path: string; name: string; bytes: Buffer; size: number }> {
  const ext = extensionOf(filePath);
  if (!OPENABLE_EXTENSIONS.has(ext)) {
    throw new Error('Định dạng chưa được hỗ trợ. Hãy chọn PDF, PNG, JPG, JPEG, WEBP, BMP, GIF, ICO hoặc SVG.');
  }
  if (!fs.existsSync(filePath)) throw new Error('Không tìm thấy tệp trên máy tính.');
  if (PDF_EXTENSIONS.has(ext)) {
    return { path: filePath, name: filePath.split(/[\\/]/).pop()!, bytes: fs.readFileSync(filePath), size: fs.statSync(filePath).size };
  }

  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) throw new Error('Không thể đọc ảnh này.');
  const dimensions = image.getSize();
  if (!dimensions.width || !dimensions.height) throw new Error('Ảnh không có kích thước hợp lệ.');
  const pdf = await PDFDocument.create();
  const embedded = await pdf.embedPng(image.toPNG());
  const page = pdf.addPage([dimensions.width, dimensions.height]);
  page.drawImage(embedded, { x: 0, y: 0, width: dimensions.width, height: dimensions.height });
  pdf.setTitle(filePath.split(/[\\/]/).pop()!);
  pdf.setCreator('Au PDF image importer');

  const importDir = join(app.getPath('temp'), 'au-pdf-imports');
  fs.mkdirSync(importDir, { recursive: true });
  const safeBase = (filePath.split(/[\\/]/).pop() || 'image').replace(/[^a-z0-9._-]/gi, '_');
  const outputPath = join(importDir, `${Date.now()}-${safeBase}.pdf`);
  const bytes = Buffer.from(await pdf.save());
  fs.writeFileSync(outputPath, bytes);
  return { path: outputPath, name: filePath.split(/[\\/]/).pop()!, bytes, size: bytes.length };
}

async function startSidecar(): Promise<SidecarInfo | null> {
  // Resolve the packaged sidecar across known layouts so the app keeps
  // working regardless of packaging configuration drift:
  //   1. extraResources layout: <resources>/sidecar/sidecar.exe
  //   2. asarUnpack fallback:   <resources>/app.asar.unpacked/resources/sidecar/sidecar.exe
  const sidecarCandidates = isDev
    ? [resolve(__dirname, '../../resources/sidecar/sidecar.exe')]
    : [
        resolve(process.resourcesPath, 'sidecar/sidecar.exe'),
        resolve(process.resourcesPath, 'app.asar.unpacked/resources/sidecar/sidecar.exe'),
      ];
  const sidecarPath = sidecarCandidates.find((p) => fs.existsSync(p));

  if (!sidecarPath) {
    console.error('Sidecar not found. Tried:', sidecarCandidates);
    return null;
  }
  console.log('[Main] Sidecar resolved at:', sidecarPath);

  // The PyInstaller runtime (_internal) always sits next to sidecar.exe.
  const pythonPath = pathResolve(sidecarPath, '..', '_internal');

  const port = 8765;
  const token = generateToken();

  // Sparrow (Rust nesting engine) — app gốc (PDF in PD) truyền đường dẫn qua
  // env SPARROW_BIN cho sidecar. Thiếu biến này, tool Gộp bài (Nest) mất
  // engine Rust ở bản cài đặt. Đóng gói qua electron-builder extraResources.
  const sparrowCandidates = isDev
    ? [resolve(__dirname, '../../resources/sparrow.exe')]
    : [resolve(process.resourcesPath, 'sparrow.exe')];
  const sparrowBin = sparrowCandidates.find((p) => fs.existsSync(p));
  if (sparrowBin) {
    console.log('[Main] Sparrow resolved at:', sparrowBin);
  } else {
    console.warn('[Main] Sparrow not found — Nesting will use fallback.');
  }

  return new Promise((resolvePromise) => {
    sidecarProcess = spawn(sidecarPath, ['--port', port.toString(), '--token', token], {
      // QUAN TRỌNG (đã xác minh bằng probe thực tế ngày 2026-08-25): sidecar
      // BỎ QUA toàn bộ CLI args (--port, --token) và đọc token từ biến môi
      // trường SIDECAR_TOKEN. Không có biến này => mọi request API đều bị
      // 401 {"detail":"unauthorized"}. Port thật luôn được sidecar tự chọn
      // ngẫu nhiên và báo lại trong payload {"ready":true,"port":N} ở stdout.
      env: { ...process.env, PYTHONPATH: pythonPath, SIDECAR_TOKEN: token, ...(sparrowBin ? { SPARROW_BIN: sparrowBin } : {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const startupTimeout = setTimeout(() => {
      if (sidecarProcess) {
        sidecarProcess.kill();
        sidecarProcess = null;
        console.error('Sidecar startup timeout');
        resolvePromise(null);
      }
    }, 10000);

    sidecarProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[Sidecar stdout]', output.trim());

      // Check for various ready signals: Uvicorn, FastAPI startup, or JSON {"ready": true}
      const isReady = output.includes('Uvicorn running') || 
                      output.includes('Application startup complete') || 
                      output.includes('READY') ||
                      output.includes('"ready":true') ||
                      output.includes('"ready": true');
      
      if (isReady) {
        clearTimeout(startupTimeout);
        // The engine may end up on a DIFFERENT port than requested when the
        // requested one is occupied (e.g. another app instance). Trust the
        // port the engine reports in its ready payload.
        let resolvedPort = port;
        try {
          const trimmed = output.trim();
          if (trimmed.startsWith('{')) {
            const payload = JSON.parse(trimmed);
            if (payload && typeof payload.port === 'number') resolvedPort = payload.port;
          } else {
            const m = trimmed.match(/127\.0\.0\.1:(\d+)/);
            if (m) resolvedPort = parseInt(m[1], 10);
          }
        } catch { /* keep requested port as fallback */ }
        sidecarInfo = { port: resolvedPort, token };
        sidecarRestartCount = 0;
        console.log('[Main] Sidecar ready on port', resolvedPort);
        mainWindow?.webContents.send('sidecar:stateChanged', { status: 'ready', info: sidecarInfo });
        resolvePromise(sidecarInfo);
      }
    });

    sidecarProcess.stderr?.on('data', (data) => {
      console.error('[Sidecar stderr]', data.toString().trim());
    });

    sidecarProcess.on('close', (code) => {
      clearTimeout(startupTimeout);
      console.log('Sidecar exited with code ' + code);
      sidecarProcess = null;
      sidecarInfo = null;
      mainWindow?.webContents.send('sidecar:stateChanged', { status: 'stopped', info: null, message: 'Process exited (code ' + code + ')' });

      if (code !== 0 && sidecarRestartCount < MAX_SIDECAR_RESTARTS && !(app as any).isQuitting) {
        sidecarRestartCount++;
        console.log('Restarting sidecar (attempt ' + sidecarRestartCount + '/' + MAX_SIDECAR_RESTARTS + ')...');
        setTimeout(startSidecar, 2000);
      }
    });

    sidecarProcess.on('error', (err) => {
      clearTimeout(startupTimeout);
      console.error('Sidecar spawn error:', err);
      sidecarProcess = null;
      resolvePromise(null);
    });

    mainWindow?.webContents.send('sidecar:stateChanged', { status: 'starting', info: null });
  });
}

function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function stopSidecar() {
  if (sidecarProcess) {
    const proc = sidecarProcess;
    sidecarProcess = null;
    sidecarInfo = null;
    try {
      if (process.platform === 'win32' && proc.pid) {
        // On Windows, plain .kill() only terminates the direct child.
        // taskkill with /T kills the whole tree (PyInstaller runtime +
        // any spawned workers), preventing orphaned sidecar.exe that
        // would lock resources\sidecar during an upgrade install.
        spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      } else {
        proc.kill();
      }
    } catch (err) {
      console.error('Failed to stop sidecar:', err);
      try { proc.kill(); } catch { /* already dead */ }
    }
  }
}

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#ffffff',
      height: 36,
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: !isDev,
    },
    show: false,
    backgroundColor: '#1e1e1e',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
    startSidecar();
    // Let the UI become responsive before checking GitHub Releases.
    setTimeout(() => { void checkForUpdatesOnLaunch(); }, 8000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  return mainWindow;
}

let updaterBusy = false;

interface RecentEntry {
  path: string;
  name: string;
  ts: number;
}

function getRecentPath(): string {
  return join(app.getPath('userData'), 'recent-files.json');
}

function readRecentEntries(): RecentEntry[] {
  try {
    const data = JSON.parse(fs.readFileSync(getRecentPath(), 'utf-8'));
    return Array.isArray(data)
      ? data.filter((item): item is RecentEntry =>
          typeof item?.path === 'string' && typeof item?.name === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * User-triggered update check (Help > Check for Updates...).
 * All interaction happens through native dialogs so no renderer changes
 * are required. Fails gracefully when the publish server is unreachable.
 */
async function checkForUpdatesInteractive(): Promise<void> {
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Cập nhật',
      message: 'Tự động cập nhật chỉ hoạt động trên bản cài đặt (không khả dụng ở chế độ dev).',
    });
    return;
  }
  if (updaterBusy) return;
  updaterBusy = true;
  try {
    autoUpdater.autoDownload = false;
    const result = await autoUpdater.checkForUpdates();
    const latest = result?.updateInfo?.version;
    if (latest && latest !== app.getVersion()) {
      const choice = await dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Có phiên bản mới',
        message: `Phiên bản mới ${latest} đã sẵn sàng.`,
        detail: `Bạn đang dùng v${app.getVersion()}. Tải về và cài đặt ngay?`,
        buttons: ['Tải về & Cài đặt', 'Để sau'],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice.response === 0) {
        await autoUpdater.downloadUpdate();
        const restart = await dialog.showMessageBox(mainWindow!, {
          type: 'info',
          title: 'Đã tải xong bản cập nhật',
          message: 'Bản cập nhật đã được tải xuống.',
          detail: 'Khởi động lại ứng dụng bây giờ để hoàn tất cài đặt?',
          buttons: ['Khởi động lại', 'Để sau'],
          defaultId: 0,
          cancelId: 1,
        });
        if (restart.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      }
    } else {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Phiên bản mới nhất',
        message: `Bạn đang dùng phiên bản mới nhất (v${app.getVersion()}).`,
      });
    }
  } catch (err) {
    dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: 'Không kiểm tra được cập nhật',
      message: 'Không thể kết nối máy chủ cập nhật.',
      detail: String((err as Error)?.message || err),
      buttons: ['Đóng'],
    });
  } finally {
    updaterBusy = false;
  }
}

/** Quiet background check; the user is only interrupted for a real update. */
async function checkForUpdatesOnLaunch(): Promise<void> {
  if (!app.isPackaged || updaterBusy) return;
  updaterBusy = true;
  try {
    autoUpdater.autoDownload = false;
    const result = await autoUpdater.checkForUpdates();
    const latest = result?.updateInfo?.version;
    if (!latest || latest === app.getVersion()) return;

    const choice = await dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Có phiên bản mới',
      message: `Au PDF ${latest} đã sẵn sàng.`,
      detail: `Bạn đang dùng v${app.getVersion()}. Tải và cài đặt bản mới ngay?`,
      buttons: ['Tải về & Cài đặt', 'Để sau'],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice.response !== 0) return;
    await autoUpdater.downloadUpdate();
    const restart = await dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Đã tải xong bản cập nhật',
      message: 'Bản cập nhật đã sẵn sàng để cài đặt.',
      detail: 'Khởi động lại ứng dụng bây giờ để hoàn tất?',
      buttons: ['Khởi động lại', 'Để sau'],
      defaultId: 0,
      cancelId: 1,
    });
    if (restart.response === 0) autoUpdater.quitAndInstall(false, true);
  } catch (error) {
    // A missing release or network failure must never prevent app startup.
    console.warn('Background update check failed:', error);
  } finally {
    updaterBusy = false;
  }
}

function createMenu(): Menu {
  const recent = readRecentEntries();
  const recentSubmenu: Electron.MenuItemConstructorOptions[] = recent.length
    ? recent.map((entry) => ({
        label: entry.name,
        click: () => mainWindow?.webContents.send('menu:openRecent', entry.path),
      }))
    : [{ label: 'No recent files', enabled: false }];

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Open File...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:action', 'openPdf') },
        { label: 'Open Recent', submenu: recentSubmenu, id: 'recentMenu' },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:action', 'save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send('menu:action', 'saveAs') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => mainWindow?.webContents.send('menu:action', 'closeTab') },
        { type: 'separator' },
        { label: 'Quit', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q', click: () => app.quit() },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    {
      label: 'Tools',
      submenu: [
        { label: 'View', accelerator: '1', click: () => mainWindow?.webContents.send('menu:action', 'tool:view') },
        { label: 'Organize Pages', accelerator: '2', click: () => mainWindow?.webContents.send('menu:action', 'tool:organize') },
        { label: 'Imposition', accelerator: '3', click: () => mainWindow?.webContents.send('menu:action', 'tool:impose') },
        { label: 'Boxes', accelerator: '4', click: () => mainWindow?.webContents.send('menu:action', 'tool:boxes') },
        { label: 'Bleed', accelerator: '5', click: () => mainWindow?.webContents.send('menu:action', 'tool:bleed') },
        { label: '2D Nesting', accelerator: '6', click: () => mainWindow?.webContents.send('menu:action', 'tool:nest') },
        { label: 'Output Preview', accelerator: '7', click: () => mainWindow?.webContents.send('menu:action', 'tool:output_preview') },
        { label: 'Preflight', accelerator: '8', click: () => mainWindow?.webContents.send('menu:action', 'tool:preflight') },
        { label: 'VDP', accelerator: '9', click: () => mainWindow?.webContents.send('menu:action', 'tool:vdp') },
        { type: 'separator' },
        { label: 'Trim Shift & Creep', click: () => mainWindow?.webContents.send('menu:action', 'tool:trimshift') },
        { label: 'Tile — Cắt Khổ Lớn', click: () => mainWindow?.webContents.send('menu:action', 'tool:tile') },
        { label: 'Stamp — Số Nhảy & Đóng Dấu', click: () => mainWindow?.webContents.send('menu:action', 'tool:stamp') },
        { label: 'BON — Bôn Máy Cắt', click: () => mainWindow?.webContents.send('menu:action', 'tool:bon') },
        { label: 'Layers — Quản Lý Layer', click: () => mainWindow?.webContents.send('menu:action', 'tool:layers') },
        { label: 'Knockout — Lót Trắng', click: () => mainWindow?.webContents.send('menu:action', 'tool:knockout') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Check for Updates...', click: () => { void checkForUpdatesInteractive(); } },
        { type: 'separator' },
        { label: 'About Au PDF', click: () => dialog.showMessageBox(mainWindow!, { type: 'info', title: 'About', message: 'Au PDF', detail: `Version ${app.getVersion()}\nDesktop PDF Viewer & Imposition Tool for Prepress\n\nBuilt with Electron, React, TypeScript, TailwindCSS` }) },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] });
  }

  return Menu.buildFromTemplate(template);
}

function setupIpcHandlers() {
  ipcMain.handle('dialog:openPdf', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open File',
      filters: [
        { name: 'Supported documents', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'ico', 'svg'] },
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'Image files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'ico', 'svg'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || !result.filePaths.length) return [];
    return Promise.all(result.filePaths.map(readOpenableDocument));
  });

  ipcMain.handle('dialog:savePdf', async (_, defaultName?: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save PDF',
      defaultPath: defaultName || 'output.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('dialog:openTextFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open CSV/Text File',
      filters: [{ name: 'CSV Files', extensions: ['csv', 'txt'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const path = result.filePaths[0];
    return { path, name: path.split(/[\\/]/).pop()!, text: fs.readFileSync(path, 'utf-8') };
  });

  ipcMain.handle('file:readPdf', async (_, path: string) => readOpenableDocument(path));
  ipcMain.handle('file:tempPdfPath', async () => { const tmpDir = os.tmpdir(); return join(tmpDir, 'pdf-prepress-' + Date.now() + '.pdf'); });
  ipcMain.handle('file:overwrite', async (_, from: string, to: string) => { fs.copyFileSync(from, to); });

  const profilesPath = join(app.getPath('userData'), 'impose-profiles.json');
  const bonPresetsPath = join(app.getPath('userData'), 'bon-presets.json');

  ipcMain.handle('impose:readProfiles', async () => {
    try {
      const data = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
      return { last: data.last, profiles: data.profiles || [] };
    } catch {
      return { last: null, profiles: [] };
    }
  });
  ipcMain.handle('impose:writeProfiles', async (_, data) => {
    fs.writeFileSync(profilesPath, JSON.stringify(data, null, 2));
  });
  ipcMain.handle('impose:exportProfiles', async (_, profiles) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Imposition Profiles',
      defaultPath: 'impose-profiles.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled) return false;
    fs.writeFileSync(result.filePath!, JSON.stringify(profiles, null, 2));
    return true;
  });
  ipcMain.handle('impose:importProfiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import Imposition Profiles',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
  });

  ipcMain.handle('bon:readPresets', async () => {
    try {
      return { presets: JSON.parse(fs.readFileSync(bonPresetsPath, 'utf-8')) };
    } catch {
      return { presets: [] };
    }
  });
  ipcMain.handle('bon:writePresets', async (_, data) => {
    fs.writeFileSync(bonPresetsPath, JSON.stringify(data, null, 2));
  });
  ipcMain.handle('bon:saveFile', async (_, srcPath: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save BON File',
      defaultPath: 'layout.bon',
      filters: [{ name: 'BON Files', extensions: ['bon'] }],
    });
    if (result.canceled) throw new Error('Canceled');
    fs.copyFileSync(srcPath, result.filePath!);
    return result.filePath!;
  });

  function writeRecent(arr: RecentEntry[]) {
    fs.writeFileSync(getRecentPath(), JSON.stringify(arr, null, 2));
    // Electron 33 exposes MenuItem.submenu as read-only. Rebuild and replace
    // the application menu after recent-file data changes.
    Menu.setApplicationMenu(createMenu());
  }

  ipcMain.handle('recent:get', () => readRecentEntries());
  ipcMain.handle('recent:add', (_, path: string) => {
    const recent = readRecentEntries();
    const name = path.split(/[\\/]/).pop()!;
    const filtered = recent.filter(r => r.path !== path);
    filtered.unshift({ path, name, ts: Date.now() });
    const next = filtered.slice(0, 10);
    writeRecent(next);
    return next;
  });
  ipcMain.handle('recent:clear', () => {
    writeRecent([]);
    return [];
  });

  ipcMain.handle('sidecar:getState', () => ({
    status: sidecarInfo ? 'ready' : 'stopped',
    info: sidecarInfo,
  }));

  // Handshake renderer ready (giống app gốc): khi renderer mount xong,
  // mở nốt file PDF được yêu cầu từ double-click / dòng lệnh lúc khởi động.
  ipcMain.on('app:rendererReady', () => {
    rendererReady = true;
    if (pendingOpenPath) {
      const p = pendingOpenPath;
      pendingOpenPath = null;
      openDocumentPathInRenderer(p);
    }
  });

  // Generic engine proxy: renderer gọi engine EXCLUSIVELY qua IPC để
  // (1) không bao giờ vướng CORS (origin file:// -> http://127.0.0.1),
  // (2) Bearer token không cần tồn tại phía renderer.
  async function engineProxy(endpoint: string, body: any, binary: boolean): Promise<any> {
    if (!sidecarInfo) throw new Error('Engine not connected');
    const url = 'http://127.0.0.1:' + sidecarInfo.port + endpoint;
    const res = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Authorization': 'Bearer ' + sidecarInfo.token,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || ('HTTP ' + res.status));
    }
    if (binary) return res.arrayBuffer();
    return res.json();
  }
  ipcMain.handle('engine:request', (_, endpoint: string, body: any) => engineProxy(endpoint, body, false));
  ipcMain.handle('engine:blob', (_, endpoint: string, body: any) => engineProxy(endpoint, body, true));
}

app.whenReady().then(() => {
  console.log('[Main] App is ready, creating window...');
  console.log('[Main] isDev:', isDev);
  console.log('[Main] __dirname:', __dirname);
  console.log('[Main] process.resourcesPath:', process.resourcesPath);
  console.log('[Main] app.isPackaged:', app.isPackaged);

  // Single instance lock must be acquired after app is ready
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log('[Main] Another instance is running, quitting...');
    app.quit();
    return;
  }

  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const documentPath = documentFromArgv(argv);
    if (documentPath) openDocumentPathInRenderer(documentPath);
  });

  createWindow();
  setupIpcHandlers();
  Menu.setApplicationMenu(createMenu());

  const argDocument = documentFromArgv(process.argv);
  if (argDocument) pendingOpenPath = argDocument;
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (!OPENABLE_EXTENSIONS.has(extensionOf(filePath))) return;
    if (rendererReady) openDocumentPathInRenderer(filePath);
    else pendingOpenPath = filePath;
  });
  app.on('activate', () => {
    console.log('[Main] App activate event');
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopSidecar();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  (app as any).isQuitting = true;
  stopSidecar();
});
// Safety net: guarantee the sidecar process tree is dead no matter how
// the app exits, so an upgrade install never hits a locked sidecar.exe.
app.on('will-quit', () => {
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/IM', 'sidecar.exe', '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } catch { /* best effort */ }
  }
});
