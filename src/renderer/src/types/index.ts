export interface SidecarInfo {
  port: number;
  token: string;
}

export interface SidecarState {
  status: 'stopped' | 'starting' | 'ready' | 'error';
  info: SidecarInfo | null;
  message?: string;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
  source: string;
}

export interface PageBoxes {
  index: number;
  rotation: number;
  width: number;
  height: number;
  media: Box;
  crop: Box;
  trim: Box;
  bleed: Box;
  art: Box;
}

export interface BoxesResponse {
  pages: PageBoxes[];
}

export interface BoxEdit {
  target: string;
  rect?: number[];
  margins?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  auto_content?: boolean;
}

export interface PageSizeEdit {
  width: number;
  height: number;
  align: 'center' | 'bottom-left' | 'top-left' | 'bottom-right' | 'top-right';
}

export interface ApplyBoxesRequest {
  src: string;
  out: string;
  pages: number[];
  box_edits?: BoxEdit[];
  page_size?: PageSizeEdit | null;
}

export interface ApplyBoxesResponse {
  out: string;
  pages_changed: number;
  src_unchanged: boolean;
}

export interface ContentBBoxItem {
  page: number;
  rect: number[] | null;
}

export interface ContentBBoxResponse {
  items: ContentBBoxItem[];
}

export interface PageItem {
  source: number | null;
  rotate?: number;
  width?: number | null;
  height?: number | null;
}

export interface ApplyPagesRequest {
  src: string;
  out: string;
  arrangement: PageItem[];
}

export interface ApplyPagesResponse {
  out: string;
  page_count: number;
  src_unchanged: boolean;
}

export interface LayerInfo {
  xref: number;
  name: string;
  visible: boolean;
}

export interface LayersResponse {
  layers: LayerInfo[];
}

export interface PreflightImage {
  page: number;
  dpi: number;
  width: number;
  height: number;
  colorspace: string;
}

export interface FontInfo {
  name: string;
  embedded: boolean;
  type: string;
}

export interface PreflightReport {
  path: string;
  page_count: number;
  encrypted: boolean;
  page_sizes: string[];
  fonts: FontInfo[];
  fonts_not_embedded: string[];
  image_colorspaces: Record<string, number>;
  low_res_images: PreflightImage[];
  pages_without_bleed: number[];
  warnings: string[];
}

export interface ImposeRequest {
  src: string;
  out: string;
  mode?: 'nup' | 'step' | 'booklet' | 'cut_stack';
  sheet_w?: number;
  sheet_h?: number;
  rows?: number;
  cols?: number;
  margin?: number;
  gutter?: number;
  rotate?: number;
  nup_fill?: boolean;
  max_cols?: number;
  max_rows?: number;
  orient?: 'tall' | 'wide' | 'best';
  trim_sheet?: boolean;
  align?: 'center' | 'topleft';
  pack_rotate?: boolean;
  duplex?: boolean;
  duplex_flip?: 'long' | 'short';
  duplex_content_rot?: number;
  scale_mode?: 'fit' | 'full' | 'percent';
  scale_pct?: number;
  copies_mode?: 'fit' | 'count';
  count?: number;
  gutter_h?: number;
  gutter_v?: number;
  auto_sheet_size?: boolean;
  trim_to_content?: boolean;
  center?: boolean;
  crop_marks?: boolean;
  mark_style?: number;
  mark_length?: number;
  mark_offset?: number;
  mark_weight?: number;
  reg_marks?: boolean;
  frames?: boolean;
  frame_weight?: number;
  num_scope?: 'off' | 'each_piece' | 'each_sheet';
  num_start?: number;
  num_width?: number;
  num_step?: number;
  num_repeat?: number;
  num_before?: string;
  num_after?: string;
  num_font?: string;
  num_size?: number;
  num_color?: number[];
  num_anchor?: string;
  num_off_x?: number;
  num_off_y?: number;
  num_rotate?: number;
}

export interface ImposeResponse {
  out: string;
  page_count: number;
  src_unchanged: boolean;
  warnings?: string[];
}

export interface BleedRequest {
  src: string;
  out: string;
  pages: number[];
  mode?: 'all' | 'custom' | 'three';
  amount?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  outside?: boolean;
  fold_edge?: 'left' | 'right' | 'top' | 'bottom' | 'odd_left' | 'odd_right';
}

export interface BleedResponse {
  out: string;
  pages_changed: number;
  src_unchanged: boolean;
}

export interface NestPart {
  src_path: string;
  page?: number;
  qty?: number;
  rotate?: '0' | '90' | 'free';
  shape?: 'content' | 'rect';
}

export interface NestRequest {
  out: string;
  sheet_w: number;
  sheet_h: number;
  margin?: number;
  gap?: number;
  parts: NestPart[];
  max_sheets?: number;
  fill_sheet?: boolean;
  center?: boolean;
  background?: string | null;
  graptech?: boolean;
  bg_margin?: number;
  bon_clearance_mm?: number;
  algorithm?: 'auto' | 'grid' | 'hex' | 'sparrow' | 'multi';
  sparrow_time_s?: number;
  learn_ref?: string | null;
  diecut_out?: string | null;
}

export interface NestResponse {
  out: string;
  sheets: number;
  placed: number;
  unplaced: number;
  utilization: number;
  page_count: number;
  diecut_out?: string | null;
  diecut_jsx?: string | null;
  warnings?: string[];
}

export interface OutputRenderRequest {
  path: string;
  page?: number;
  zoom?: number;
  rotation?: number;
  c?: boolean;
  m?: boolean;
  y?: boolean;
  k?: boolean;
  tac_on?: boolean;
  tac_threshold?: number;
  tac_color?: number[];
  rich_on?: boolean;
  rich_k?: number;
  rich_cmy?: number;
  rich_color?: number[];
  warn_opacity?: number;
  bg_on?: boolean;
  bg_color?: number[];
}

export interface OutputSample {
  c: number;
  m: number;
  y: number;
  k: number;
  tac: number;
}

export interface OutputInfo {
  has_transparency: boolean;
  has_overprint: boolean;
  colorspaces: string[];
  rgb_image_bboxes: number[][];
  overprint_bboxes?: number[][];
}

export interface VarField {
  text?: string;
  page?: number;
  anchor?: string;
  off_x?: number;
  off_y?: number;
  font?: string;
  size?: number;
  color?: number[];
  rotate?: number;
}

export interface VariableDataRequest {
  src: string;
  out: string;
  new_doc?: boolean;
  csv_path: string;
  fields: VarField[];
}

export interface TileRequest {
  src: string;
  out: string;
  pages: number[];
  new_doc?: boolean;
  mode?: 'cr' | 'size';
  cols?: number;
  rows?: number;
  tile_w?: number;
  tile_h?: number;
  overlap?: number;
  overlap_bleed?: boolean;
  wide_only?: boolean;
  move_first_last?: boolean;
}

export interface StampRequest {
  src: string;
  out: string;
  pages: number[];
  new_doc?: boolean;
  numbering?: boolean;
  number_start?: number;
  number_width?: number;
  number_repeat?: number;
  number_step?: number;
  text_before?: string;
  text_after?: string;
  every_n?: number;
  font?: string;
  size?: number;
  color?: number[];
  anchor?: string;
  off_x?: number;
  off_y?: number;
  rotate?: number;
  fields?: Record<string, string>;
}

export interface TrimShiftRequest {
  src: string;
  out: string;
  pages: number[];
  /** Lệch ngang theo pt (âm = trái, dương = phải) */
  shift_x?: number;
  /** Lệch dọc theo pt */
  shift_y?: number;
  /** Chế độ bù gáy lũy tiến cho sách (giá trị do engine quy định, vd 'linear') */
  creep_mode?: string;
}

export interface BonLayerSpec {
  name: string;
  color?: number[];
  size_mm?: number;
  line_pt?: number;
  dl?: number;
  dr?: number;
  dt?: number;
  db?: number;
}

export interface BonRequest {
  out: string;
  src?: string | null;
  target?: 'current' | 'new';
  /** Millimetres (BON engine contract). */
  sheet_w?: number;
  /** Millimetres (BON engine contract). */
  sheet_h?: number;
  artwork?: string[];
  /** Millimetres (BON engine contract). */
  art_margin?: number;
  pages?: number[];
  layers?: BonLayerSpec[];
}

export interface BonResizeRequest {
  src: string;
  out: string;
  sheet_w: number;
  sheet_h: number;
}

export interface ImposeProfile {
  id: string;
  name: string;
  config: Partial<ImposeRequest>;
}

export interface BonPreset {
  id: string;
  name: string;
  file: string;
  graptech?: boolean;
}

export interface RecentFile {
  path: string;
  name: string;
  ts: number;
}

export interface OpenedDocument {
  id: string;
  path: string;
  name: string;
  size: number;
  pageCount: number;
  currentPage: number;
  boxes?: PageBoxes[];
  isDirty?: boolean;
}

export type ActiveTool = 
  | 'view' 
  | 'organize' 
  | 'impose' 
  | 'boxes' 
  | 'bleed' 
  | 'nest' 
  | 'output_preview' 
  | 'preflight' 
  | 'vdp' 
  | 'tile' 
  | 'stamp' 
  | 'bon' 
  | 'layers'
  | 'knockout'
  | 'trimshift';
