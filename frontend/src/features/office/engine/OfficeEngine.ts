import type { AgentState, OfficeLayout, OfficeTheme } from "../types/office";
import { Camera } from "./Camera";
import { TileMap } from "./TileMap";
import { AgentRenderer } from "./AgentRenderer";
import { clearSpriteCache } from "../sprites/characters";
import { clearFurnitureCache } from "../sprites/furniture";

export type HitResult =
  | { type: "agent"; agent: AgentState }
  | { type: "emptyDesk"; deskIndex: number }
  | null;

/** 오피스 렌더링 엔진 (Canvas 2D + requestAnimationFrame) */
export class OfficeEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tileMap: TileMap;
  readonly camera: Camera;
  private agentRenderer: AgentRenderer;
  private rafId: number | null = null;
  private lastTime = 0;
  private layout: OfficeLayout;
  private theme: OfficeTheme;

  // React에서 ref로 주입
  private agentsRef: { current: AgentState[] } = { current: [] };
  private hoveredAgentIdRef: { current: string | null } = { current: null };
  private showLabelsRef: { current: boolean } = { current: true };

  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, layout: OfficeLayout, theme: OfficeTheme) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.layout = layout;
    this.theme = theme;
    this.tileMap = new TileMap(layout, theme);
    this.camera = new Camera();
    this.agentRenderer = new AgentRenderer(4);

    this.setupResize();
  }

  private setupResize(): void {
    const sync = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
      this.ctx.imageSmoothingEnabled = false;
    };
    sync();
    this.resizeObserver = new ResizeObserver(sync);
    this.resizeObserver.observe(this.canvas);
  }

  /** 렌더 루프 시작 */
  start(
    agentsRef: { current: AgentState[] },
    hoveredAgentIdRef: { current: string | null },
    showLabelsRef: { current: boolean },
  ): void {
    this.agentsRef = agentsRef;
    this.hoveredAgentIdRef = hoveredAgentIdRef;
    this.showLabelsRef = showLabelsRef;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  /** 렌더 루프 정지 */
  stop(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resizeObserver?.disconnect();
  }

  setTheme(theme: OfficeTheme): void {
    this.theme = theme;
    this.tileMap.setTheme(theme);
    clearSpriteCache();
    clearFurnitureCache();
  }

  /** 화면 좌표에서 히트 테스트 */
  hitTest(screenX: number, screenY: number): HitResult {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const px = (screenX - rect.left) * dpr;
    const py = (screenY - rect.top) * dpr;
    const mapW = this.layout.cols * this.layout.tileSize;
    const mapH = this.layout.rows * this.layout.tileSize;
    const { col, row } = this.camera.screenToWorld(
      px, py, this.canvas.width, this.canvas.height, mapW, mapH, this.layout.tileSize,
    );

    const deskIdx = this.tileMap.getDeskIndexAt(col, row);
    if (deskIdx >= 0) {
      const agent = this.agentsRef.current.find((a) => a.deskIndex === deskIdx);
      if (agent) return { type: "agent", agent };
      return { type: "emptyDesk", deskIndex: deskIdx };
    }
    return null;
  }

  private loop = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.agentRenderer.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private render(): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const mapW = this.layout.cols * this.layout.tileSize;
    const mapH = this.layout.rows * this.layout.tileSize;

    // 배경 클리어
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, width, height);

    // 카메라 적용
    this.camera.apply(ctx, width, height, mapW, mapH);

    // 레이어 1: 바닥 + 벽
    this.tileMap.renderFloor(ctx);
    this.tileMap.renderWalls(ctx);

    // 레이어 2: 장식물 (뒤쪽)
    this.tileMap.renderDecorations(ctx);

    // 활성 책상 세트 (에이전트가 앉아있는 책상)
    const agents = this.agentsRef.current;
    const activeDesks = new Set<number>();
    for (const a of agents) {
      if (a.activity !== "idle") activeDesks.add(a.deskIndex);
    }

    // 레이어 3: 책상 + 의자 + 모니터
    this.tileMap.renderDesks(ctx, activeDesks);

    // 레이어 4: 에이전트 (Y-sort: 낮은 row 먼저)
    const sortedAgents = [...agents].sort((a, b) => {
      const da = this.layout.desks[a.deskIndex];
      const db = this.layout.desks[b.deskIndex];
      return (da?.seatRow ?? 0) - (db?.seatRow ?? 0);
    });

    const hoveredId = this.hoveredAgentIdRef.current;
    const showLabels = this.showLabelsRef.current;
    const tileSize = this.layout.tileSize;

    for (const agent of sortedAgents) {
      const desk = this.tileMap.getDeskPosition(agent.deskIndex);
      if (!desk) continue;
      this.agentRenderer.renderAgent(
        ctx, agent, desk, tileSize,
        showLabels, agent.sessionId === hoveredId, this.theme,
      );
    }

    // 변환 리셋
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
