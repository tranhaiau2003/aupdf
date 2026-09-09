import {
  SidecarInfo,
  BoxesResponse,
  ApplyBoxesRequest,
  ApplyBoxesResponse,
  ContentBBoxResponse,
  ApplyPagesRequest,
  ApplyPagesResponse,
  LayersResponse,
  PreflightReport,
  ImposeRequest,
  ImposeResponse,
  BleedRequest,
  BleedResponse,
  NestRequest,
  NestResponse,
  OutputRenderRequest,
  OutputSample,
  OutputInfo,
  VariableDataRequest,
  TileRequest,
  StampRequest,
  BonRequest,
  BonResizeRequest,
  BonLayerSpec
} from '../types';

/**
 * Engine trả về mỗi box dạng `{rect: [x0, y0, x1, y1], source}` (đã probe thật
 * ngày 2026-08-29) — KHÔNG có sẵn x0/y0/w/h như types khai báo. Nếu không chuẩn
 * hóa, mọi chỗ UI đọc `box.w`/`box.h`/`box.x0`... sẽ ra undefined → "NaN × NaN mm"
 * (CanvasViewer, BoxesPanel, StatusBar) và overlay boxes vẽ sai.
 * Chuẩn hóa tại 1 cửa ngõ duy nhất (getBoxes) để toàn app đọc được.
 */
function normalizeBox(b: any): any {
  if (!b || typeof b !== 'object') return b;
  if (Array.isArray(b.rect) && b.rect.length >= 4 && (b.w === undefined || b.h === undefined)) {
    const [x0, y0, x1, y1] = b.rect;
    return {
      ...b,
      x0: typeof b.x0 === 'number' ? b.x0 : x0,
      y0: typeof b.y0 === 'number' ? b.y0 : y0,
      x1: typeof b.x1 === 'number' ? b.x1 : x1,
      y1: typeof b.y1 === 'number' ? b.y1 : y1,
      w: typeof b.w === 'number' ? b.w : Math.abs(x1 - x0),
      h: typeof b.h === 'number' ? b.h : Math.abs(y1 - y0),
    };
  }
  return b;
}

function normalizeBoxesResponse(res: BoxesResponse): BoxesResponse {
  const pages = Array.isArray(res?.pages) ? res.pages : [];
  return {
    ...res,
    pages: pages.map((p: any) => ({
      ...p,
      media: normalizeBox(p.media),
      crop: normalizeBox(p.crop),
      trim: normalizeBox(p.trim),
      bleed: normalizeBox(p.bleed),
      art: normalizeBox(p.art),
    })),
  };
}

export class PrepressApiClient {
  private port: number = 0;
  private token: string = '';

  setCredentials(info: SidecarInfo | null) {
    if (info) {
      this.port = info.port;
      this.token = info.token;
    } else {
      this.port = 0;
      this.token = '';
    }
  }

  private async request<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
    // Ưu tiên đường IPC qua main process (không CORS, token nằm ở main).
    const bridge = (globalThis as any)?.window?.api;
    if (bridge?.engineRequest) {
      if (method !== 'GET' && method !== 'POST') throw new Error('Unsupported method: ' + method);
      return bridge.engineRequest(endpoint, method === 'GET' ? undefined : body) as Promise<T>;
    }

    // Fallback: gọi trực tiếp (chỉ dùng khi không có preload bridge).
    if (!this.port || !this.token) {
      throw new Error('Prepress engine is not connected.');
    }

    const url = `http://127.0.0.1:${this.port}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      let errDetail = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data.detail) errDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      } catch {
        errDetail = await res.text();
      }
      throw new Error(errDetail || `Request failed (${res.status})`);
    }

    return res.json();
  }

  // Health
  healthz() { return this.request<{ status: string }>('/healthz'); }
  version() { return this.request<{ version: string }>('/version'); }

  // Boxes
  async getBoxes(path: string): Promise<BoxesResponse> {
    const res = await this.request<BoxesResponse>('/boxes', 'POST', { path });
    return normalizeBoxesResponse(res);
  }

  applyBoxes(req: ApplyBoxesRequest): Promise<ApplyBoxesResponse> {
    return this.request('/boxes/apply', 'POST', req);
  }

  getContentBBox(path: string, pages: number[]): Promise<ContentBBoxResponse> {
    return this.request('/content-bbox', 'POST', { path, pages });
  }

  // Pages
  applyPages(req: ApplyPagesRequest): Promise<ApplyPagesResponse> {
    return this.request('/pages/apply', 'POST', req);
  }

  // Layers
  getLayers(path: string): Promise<LayersResponse> {
    return this.request('/layers', 'POST', { path });
  }

  setLayerVisibility(path: string, out: string, visibility: Record<number, boolean>) {
    // Engine contract (/openapi.json SetLayerVisibilityRequest) expects
    // { src, out, on: number[], off: number[] }, NOT { path, visibility }.
    const on: number[] = [];
    const off: number[] = [];
    for (const [xref, vis] of Object.entries(visibility)) {
      if (vis) on.push(Number(xref)); else off.push(Number(xref));
    }
    return this.request('/layers/visibility', 'POST', { src: path, out, on, off });
  }

  flattenLayers(path: string, out: string) {
    return this.request('/layers/flatten', 'POST', { src: path, out });
  }

  // Preflight
  async runPreflight(path: string, minDpi: number = 300): Promise<PreflightReport> {
    const report: any = await this.request('/preflight', 'POST', { path, min_dpi: minDpi });
    // Keep the renderer resilient to older sidecars that omit empty result arrays.
    return {
      ...report,
      page_count: Number(report?.page_count ?? 0),
      fonts: Array.isArray(report?.fonts) ? report.fonts : [],
      warnings: Array.isArray(report?.warnings) ? report.warnings : [],
      low_res_images: Array.isArray(report?.low_res_images) ? report.low_res_images : [],
      fonts_not_embedded: Array.isArray(report?.fonts_not_embedded) ? report.fonts_not_embedded : [],
      pages_without_bleed: Array.isArray(report?.pages_without_bleed) ? report.pages_without_bleed : [],
    } as PreflightReport;
  }

  // Imposition
  impose(req: ImposeRequest): Promise<ImposeResponse> {
    return this.request('/impose', 'POST', req);
  }

  // Bleed
  defineBleed(req: BleedRequest): Promise<BleedResponse> {
    return this.request('/bleed', 'POST', req);
  }

  // Output Preview
  async renderOutputPreview(req: OutputRenderRequest): Promise<Blob> {
    const bridge = (globalThis as any)?.window?.api;
    if (bridge?.engineBlob) {
      const buf: ArrayBuffer = await bridge.engineBlob('/output/render', req);
      return new Blob([buf], { type: 'image/png' });
    }
    if (!this.port || !this.token) throw new Error('Engine not ready');
    const url = `http://127.0.0.1:${this.port}/output/render`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req)
    });
    if (!res.ok) throw new Error('Failed to render separation plate');
    return res.blob();
  }

  sampleColor(path: string, page: number, x: number, y: number, size: number = 1): Promise<OutputSample> {
    return this.request('/output/sample', 'POST', { path, page, x, y, size });
  }

  getOutputInfo(path: string, page: number = 0, x: number = 0, y: number = 0): Promise<OutputInfo> {
    // Engine's OutputInfoRequest currently reuses the OutputSampleRequest
    // schema which requires x/y (verified against /openapi.json 2026-08-25).
    return this.request('/output/info', 'POST', { path, page, x, y });
  }

  // 2D Nesting
  nest(req: NestRequest): Promise<NestResponse> {
    return this.request('/nest', 'POST', req);
  }

  // Variable Data
  variableData(req: VariableDataRequest) {
    return this.request('/variable-data', 'POST', req);
  }

  // Tile
  tile(req: TileRequest) {
    return this.request('/tile', 'POST', req);
  }

  // Stamp
  stamp(req: StampRequest) {
    return this.request('/stamp', 'POST', req);
  }

  // Trim Shift
  trimShift(src: string, out: string, pages: number[], shift_x: number, shift_y: number, creep_mode?: string) {
    return this.request('/trim-shift', 'POST', { src, out, pages, shift_x, shift_y, creep_mode });
  }

  // Knockout
  knockout(src: string, out: string, pages: number[], tolerance: number = 12, dpi: number = 300) {
    return this.request('/knockout', 'POST', { src, out, pages, tolerance, dpi });
  }

  // Bon
  analyzeBon(path: string): Promise<{ layers: BonLayerSpec[] }> {
    return this.request('/bon/analyze', 'POST', { path });
  }

  applyBon(req: BonRequest) {
    return this.request('/bon', 'POST', req);
  }

  resizeBon(req: BonResizeRequest) {
    return this.request('/bon/resize', 'POST', req);
  }
}

export const apiClient = new PrepressApiClient();
