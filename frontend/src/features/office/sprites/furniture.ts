import type { OfficeTheme } from "../types/office";

/** 가구 프리렌더링 캐시: type-themeHash → OffscreenCanvas */
const furnitureCache = new Map<string, OffscreenCanvas>();

function hashTheme(theme: OfficeTheme): string {
  return `${theme.desk}${theme.monitor}${theme.chair}${theme.plant}`;
}

function fillPixels(
  ctx: OffscreenCanvasRenderingContext2D,
  data: (string | null)[][],
  scale: number,
): void {
  for (let y = 0; y < data.length; y++) {
    for (let x = 0; x < data[y].length; x++) {
      const c = data[y][x];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
}

/** 책상 (24x12 픽셀) */
function renderDesk(theme: OfficeTheme, scale: number): OffscreenCanvas {
  const w = 24, h = 12;
  const canvas = new OffscreenCanvas(w * scale, h * scale);
  const ctx = canvas.getContext("2d")!;
  const t = theme.deskTop;
  const d = theme.desk;

  // 책상 상판
  const data: (string | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  for (let x = 0; x < w; x++) { data[0][x] = t; data[1][x] = t; }
  for (let y = 2; y < h; y++) {
    data[y][0] = d; data[y][1] = d;
    data[y][w - 2] = d; data[y][w - 1] = d;
  }
  // 중간 선반
  for (let x = 0; x < w; x++) { data[5][x] = d; }

  fillPixels(ctx, data, scale);
  return canvas;
}

/** 의자 (10x12 픽셀) */
function renderChair(theme: OfficeTheme, scale: number): OffscreenCanvas {
  const w = 10, h = 12;
  const canvas = new OffscreenCanvas(w * scale, h * scale);
  const ctx = canvas.getContext("2d")!;
  const c = theme.chair;

  const data: (string | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  // 등받이
  for (let y = 0; y < 5; y++) { data[y][1] = c; data[y][w - 2] = c; }
  for (let x = 1; x < w - 1; x++) { data[0][x] = c; }
  // 좌석
  for (let x = 1; x < w - 1; x++) { data[5][x] = c; data[6][x] = c; }
  // 다리
  data[7][2] = c; data[7][w - 3] = c;
  data[8][2] = c; data[8][w - 3] = c;
  for (let x = 1; x < w - 1; x++) { data[9][x] = c; }

  fillPixels(ctx, data, scale);
  return canvas;
}

/** 모니터 (14x12 픽셀) */
function renderMonitor(theme: OfficeTheme, active: boolean, scale: number): OffscreenCanvas {
  const w = 14, h = 12;
  const canvas = new OffscreenCanvas(w * scale, h * scale);
  const ctx = canvas.getContext("2d")!;
  const m = theme.monitor;
  const s = active ? theme.monitorScreenActive : theme.monitorScreen;

  const data: (string | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  // 프레임
  for (let x = 1; x < w - 1; x++) { data[0][x] = m; data[7][x] = m; }
  for (let y = 0; y < 8; y++) { data[y][0] = m; data[y][1] = m; data[y][w - 2] = m; data[y][w - 1] = m; }
  // 화면
  for (let y = 1; y < 7; y++) for (let x = 2; x < w - 2; x++) data[y][x] = s;
  // 받침대
  data[8][6] = m; data[8][7] = m;
  data[9][6] = m; data[9][7] = m;
  for (let x = 4; x < 10; x++) { data[10][x] = m; }

  fillPixels(ctx, data, scale);
  return canvas;
}

/** 식물 (10x16 픽셀) */
function renderPlant(theme: OfficeTheme, scale: number): OffscreenCanvas {
  const w = 10, h = 16;
  const canvas = new OffscreenCanvas(w * scale, h * scale);
  const ctx = canvas.getContext("2d")!;
  const g = theme.plant;
  const p = theme.plantPot;

  const data: (string | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  // 잎
  data[0][5] = g;
  data[1][4] = g; data[1][5] = g; data[1][6] = g;
  data[2][3] = g; data[2][4] = g; data[2][5] = g; data[2][6] = g; data[2][7] = g;
  data[3][2] = g; data[3][3] = g; data[3][5] = g; data[3][7] = g; data[3][8] = g;
  data[4][3] = g; data[4][4] = g; data[4][5] = g; data[4][6] = g; data[4][7] = g;
  data[5][4] = g; data[5][5] = g; data[5][6] = g;
  // 줄기
  data[6][5] = g; data[7][5] = g; data[8][5] = g;
  // 화분
  for (let x = 2; x < 8; x++) { data[9][x] = p; data[10][x] = p; }
  for (let x = 3; x < 7; x++) { data[11][x] = p; data[12][x] = p; }
  for (let x = 3; x < 7; x++) { data[13][x] = p; }

  fillPixels(ctx, data, scale);
  return canvas;
}

/** 커피머신 (10x14 픽셀) */
function renderCoffee(theme: OfficeTheme, scale: number): OffscreenCanvas {
  const w = 10, h = 14;
  const canvas = new OffscreenCanvas(w * scale, h * scale);
  const ctx = canvas.getContext("2d")!;
  const c = theme.coffee;

  const data: (string | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  // 본체
  for (let y = 0; y < 10; y++) for (let x = 2; x < 8; x++) data[y][x] = c;
  // 버튼
  data[3][4] = "#FF4444"; data[3][5] = "#44FF44";
  // 받침대
  for (let x = 1; x < 9; x++) { data[10][x] = c; data[11][x] = c; }
  // 다리
  data[12][2] = c; data[12][7] = c;
  data[13][2] = c; data[13][7] = c;

  fillPixels(ctx, data, scale);
  return canvas;
}

/** 문 (12x20 픽셀) */
function renderDoor(theme: OfficeTheme, scale: number): OffscreenCanvas {
  const w = 12, h = 20;
  const canvas = new OffscreenCanvas(w * scale, h * scale);
  const ctx = canvas.getContext("2d")!;
  const f = theme.doorFrame;
  const d = theme.door;

  const data: (string | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  // 프레임
  for (let x = 0; x < w; x++) { data[0][x] = f; data[1][x] = f; }
  for (let y = 0; y < h; y++) { data[y][0] = f; data[y][1] = f; data[y][w - 2] = f; data[y][w - 1] = f; }
  // 문
  for (let y = 2; y < h; y++) for (let x = 2; x < w - 2; x++) data[y][x] = d;
  // 손잡이
  data[10][8] = "#FFD700"; data[11][8] = "#FFD700";

  fillPixels(ctx, data, scale);
  return canvas;
}

export type FurnitureType = "desk" | "chair" | "monitor" | "monitorActive" | "plant" | "coffee" | "door";

const RENDERERS: Record<FurnitureType, (theme: OfficeTheme, scale: number) => OffscreenCanvas> = {
  desk: (t, s) => renderDesk(t, s),
  chair: (t, s) => renderChair(t, s),
  monitor: (t, s) => renderMonitor(t, false, s),
  monitorActive: (t, s) => renderMonitor(t, true, s),
  plant: (t, s) => renderPlant(t, s),
  coffee: (t, s) => renderCoffee(t, s),
  door: (t, s) => renderDoor(t, s),
};

/**
 * 가구 스프라이트를 가져온다 (캐시).
 */
export function getFurnitureSprite(
  type: FurnitureType,
  theme: OfficeTheme,
  pixelScale = 1,
): OffscreenCanvas {
  const key = `${type}-${hashTheme(theme)}-${pixelScale}`;
  let cached = furnitureCache.get(key);
  if (cached) return cached;

  const renderer = RENDERERS[type];
  cached = renderer(theme, pixelScale);
  furnitureCache.set(key, cached);
  return cached;
}

/** 가구 캐시 초기화 (테마 변경 시) */
export function clearFurnitureCache(): void {
  furnitureCache.clear();
}
