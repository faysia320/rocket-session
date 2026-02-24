import type { AgentActivity, CharacterPalette } from "../types/office";

/**
 * 6가지 캐릭터 팔레트.
 * 각 캐릭터는 고유한 skin/hair/shirt/pants 색상 조합.
 */
export const PALETTES: CharacterPalette[] = [
  { skin: "#FDBCB4", skinShadow: "#D4968E", hair: "#3B2219", shirt: "#4466FF", shirtShadow: "#2244CC", pants: "#334455", pantsShadow: "#222E3B", shoes: "#1A1A1A" },
  { skin: "#D4A574", skinShadow: "#B08050", hair: "#1A0F0A", shirt: "#44BB66", shirtShadow: "#2D8A47", pants: "#224433", pantsShadow: "#163025", shoes: "#2A1A0A" },
  { skin: "#F5D0A9", skinShadow: "#D4AE80", hair: "#C2501A", shirt: "#CC4466", shirtShadow: "#992244", pants: "#443355", pantsShadow: "#2E223B", shoes: "#222222" },
  { skin: "#8D5524", skinShadow: "#6D3E1A", hair: "#2A1A0A", shirt: "#DDAA33", shirtShadow: "#AA7722", pants: "#335544", pantsShadow: "#223B2E", shoes: "#1A1A1A" },
  { skin: "#FCEBD0", skinShadow: "#DCC9A8", hair: "#FFD700", shirt: "#6644CC", shirtShadow: "#4422AA", pants: "#444455", pantsShadow: "#2E2E3B", shoes: "#2A2A2A" },
  { skin: "#C68E6A", skinShadow: "#A06E4A", hair: "#0A0A0A", shirt: "#22AACC", shirtShadow: "#1188AA", pants: "#334455", pantsShadow: "#222E3B", shoes: "#1A1A1A" },
];

// 팔레트 키: H=hair, S=skin, s=skinShadow, T=shirt, t=shirtShadow, P=pants, p=pantsShadow, E=shoes
type PKey = "H" | "S" | "s" | "T" | "t" | "P" | "p" | "E";
const P_MAP: Record<PKey, keyof CharacterPalette> = {
  H: "hair", S: "skin", s: "skinShadow", T: "shirt", t: "shirtShadow",
  P: "pants", p: "pantsShadow", E: "shoes",
};

// 캐릭터 크기: 12x18 (12 wide, 18 tall)
const W = 12;
const H = 18;

/**
 * 캐릭터 프레임 템플릿 (12×18).
 * ""=투명, 팔레트 키=팔레트 색상, "#hex"=직접 색상.
 */
function makeTemplate(data: string[]): (string | PKey)[][] {
  return data.map((row) => {
    const cells: (string | PKey)[] = [];
    for (let i = 0; i < row.length; i += 2) {
      cells.push(row.substring(i, i + 2).trim() as string | PKey);
    }
    return cells;
  });
}

// --- idle: 앉아서 가만히 (2 프레임) ---
const IDLE_0 = makeTemplate([
  "            H H H H H H            ", // row 0: hair top
  "          H H H H H H H H          ", // row 1
  "          H S S S S S S H          ", // row 2: face
  "          H S S S S S S H          ", // row 3
  "            S S S S S S            ", // row 4
  "              S s S s              ", // row 5: eyes (dark dots)
  "              S S S S              ", // row 6
  "          T T T T T T T T          ", // row 7: shirt
  "        T T T T T T T T T T        ", // row 8
  "        T T t T T T T t T T        ", // row 9
  "        S S T T T T T T S S        ", // row 10: hands on desk
  "          S T T T T T T S          ", // row 11
  "            P P P P P P            ", // row 12: pants
  "            P P P P P P            ", // row 13
  "            P p P P p P            ", // row 14
  "            P P P P P P            ", // row 15
  "            E E    E E            ", // row 16: shoes
  "            E E    E E            ", // row 17
]);

const IDLE_1 = makeTemplate([
  "            H H H H H H            ",
  "          H H H H H H H H          ",
  "          H S S S S S S H          ",
  "          H S S S S S S H          ",
  "            S S S S S S            ",
  "              S s S s              ",
  "              S S S S              ",
  "          T T T T T T T T          ",
  "        T T T T T T T T T T        ",
  "        T T t T T T T t T T        ",
  "        S S T T T T T T S S        ",
  "          S T T T T T T S          ",
  "            P P P P P P            ",
  "            P P P P P P            ",
  "            P p P P p P            ",
  "            P P P P P P            ",
  "          E E      E E            ",
  "          E E      E E            ",
]);

// --- typing: 타이핑 중 (3 프레임) ---
const TYPING_0 = makeTemplate([
  "            H H H H H H            ",
  "          H H H H H H H H          ",
  "          H S S S S S S H          ",
  "          H S S S S S S H          ",
  "            S S S S S S            ",
  "              S s S s              ",
  "              S S S S              ",
  "          T T T T T T T T          ",
  "        T T T T T T T T T T        ",
  "        T T t T T T T t T T        ",
  "      S S T T T T T T T T S S      ",
  "      S   T T T T T T   S          ",
  "            P P P P P P            ",
  "            P P P P P P            ",
  "            P p P P p P            ",
  "            P P P P P P            ",
  "            E E    E E            ",
  "            E E    E E            ",
]);

const TYPING_1 = makeTemplate([
  "            H H H H H H            ",
  "          H H H H H H H H          ",
  "          H S S S S S S H          ",
  "          H S S S S S S H          ",
  "            S S S S S S            ",
  "              S s S s              ",
  "              S S S S              ",
  "          T T T T T T T T          ",
  "        T T T T T T T T T T        ",
  "        T T t T T T T t T T        ",
  "        S S T T T T T T S S        ",
  "        S   T T T T T T   S        ",
  "            P P P P P P            ",
  "            P P P P P P            ",
  "            P p P P p P            ",
  "            P P P P P P            ",
  "            E E    E E            ",
  "            E E    E E            ",
]);

const TYPING_2 = makeTemplate([
  "            H H H H H H            ",
  "          H H H H H H H H          ",
  "          H S S S S S S H          ",
  "          H S S S S S S H          ",
  "            S S S S S S            ",
  "              S s S s              ",
  "              S S S S              ",
  "          T T T T T T T T          ",
  "        T T T T T T T T T T        ",
  "        T T t T T T T t T T        ",
  "          S S T T T T S S S S      ",
  "          S   T T T T T T   S      ",
  "            P P P P P P            ",
  "            P P P P P P            ",
  "            P p P P p P            ",
  "            P P P P P P            ",
  "            E E    E E            ",
  "            E E    E E            ",
]);

// --- reading: 문서 보는 중 (2 프레임) ---
const READING_0 = IDLE_0; // 같은 자세, 이펙트로 구분
const READING_1 = IDLE_1;

// --- running: 터미널 보는 중 (2 프레임) ---
const RUNNING_0 = IDLE_0;
const RUNNING_1 = IDLE_1;

// --- searching: 검색 중 (2 프레임) ---
const SEARCHING_0 = IDLE_0;
const SEARCHING_1 = IDLE_1;

// --- thinking: 생각 중 (2 프레임) ---
const THINKING_0 = IDLE_0;
const THINKING_1 = IDLE_1;

// --- error: 에러 상태 (2 프레임) ---
const ERROR_0 = IDLE_0;
const ERROR_1 = IDLE_1;

/** 활동별 프레임 세트 */
const FRAME_SETS: Record<AgentActivity, (string | PKey)[][][]> = {
  idle: [IDLE_0, IDLE_1],
  thinking: [THINKING_0, THINKING_1],
  reading: [READING_0, READING_1],
  writing: [TYPING_0, TYPING_1, TYPING_2],
  running: [RUNNING_0, RUNNING_1],
  searching: [SEARCHING_0, SEARCHING_1],
  error: [ERROR_0, ERROR_1],
};

/** 스프라이트 캐시: paletteIndex-activity-frame → OffscreenCanvas */
const spriteCache = new Map<string, OffscreenCanvas>();

function resolveColor(cell: string, palette: CharacterPalette): string {
  if (cell === "" || cell === " ") return "";
  if (cell in P_MAP) return palette[P_MAP[cell as PKey]];
  if (cell.startsWith("#")) return cell;
  return "";
}

function prerenderFrame(
  template: (string | PKey)[][],
  palette: CharacterPalette,
  scale: number,
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(W * scale, H * scale);
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < template.length; y++) {
    const row = template[y];
    for (let x = 0; x < row.length; x++) {
      const color = resolveColor(row[x] as string, palette);
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  return canvas;
}

/**
 * 프리렌더링된 캐릭터 스프라이트를 가져온다.
 * Lazy init + 캐시.
 */
export function getCharacterSprite(
  paletteIndex: number,
  activity: AgentActivity,
  frameIndex: number,
  pixelScale = 1,
): OffscreenCanvas {
  const key = `${paletteIndex}-${activity}-${frameIndex}-${pixelScale}`;
  let cached = spriteCache.get(key);
  if (cached) return cached;

  const palette = PALETTES[paletteIndex % PALETTES.length];
  const frames = FRAME_SETS[activity] || FRAME_SETS.idle;
  const template = frames[frameIndex % frames.length];
  cached = prerenderFrame(template, palette, pixelScale);
  spriteCache.set(key, cached);
  return cached;
}

/** 활동별 프레임 수 */
export function getFrameCount(activity: AgentActivity): number {
  return (FRAME_SETS[activity] || FRAME_SETS.idle).length;
}

/** 캐릭터 크기 (픽셀 단위, 스케일 미적용) */
export const CHAR_WIDTH = W;
export const CHAR_HEIGHT = H;

/** 스프라이트 캐시 초기화 (테마 변경 시) */
export function clearSpriteCache(): void {
  spriteCache.clear();
}
