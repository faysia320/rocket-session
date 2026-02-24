/** 에이전트 캐릭터의 활동 상태 */
export type AgentActivity =
  | "idle"
  | "thinking"
  | "reading"
  | "writing"
  | "running"
  | "searching"
  | "error";

/** 오피스 내 에이전트 상태 */
export interface AgentState {
  sessionId: string;
  sessionName: string;
  activity: AgentActivity;
  activityLabel: string;
  deskIndex: number;
  characterId: number;
}

/** 책상 위치 (타일 좌표) */
export interface DeskPosition {
  col: number;
  row: number;
  seatCol: number;
  seatRow: number;
}

/** 장식 오브젝트 */
export interface Decoration {
  type: "plant" | "coffee" | "door";
  col: number;
  row: number;
}

/** 오피스 레이아웃 */
export interface OfficeLayout {
  cols: number;
  rows: number;
  tileSize: number;
  desks: DeskPosition[];
  decorations: Decoration[];
  tiles: number[];
}

/** Canvas 테마 색상 */
export interface OfficeTheme {
  floor: string;
  floorAlt: string;
  wall: string;
  wallTop: string;
  desk: string;
  deskTop: string;
  monitor: string;
  monitorScreen: string;
  monitorScreenActive: string;
  chair: string;
  plant: string;
  plantPot: string;
  coffee: string;
  door: string;
  doorFrame: string;
  text: string;
  textMuted: string;
  bubbleBg: string;
  bubbleBorder: string;
  bg: string;
}

/** 스프라이트 프레임: 2D 색상 배열 (""=투명) */
export type SpriteFrame = string[][];

/** 캐릭터 팔레트 */
export interface CharacterPalette {
  skin: string;
  skinShadow: string;
  hair: string;
  shirt: string;
  shirtShadow: string;
  pants: string;
  pantsShadow: string;
  shoes: string;
}
