import type { DeskPosition, Decoration, OfficeLayout, OfficeTheme } from "../types/office";
import { getFurnitureSprite, type FurnitureType } from "../sprites/furniture";

/** 타일맵 렌더러 */
export class TileMap {
  private layout: OfficeLayout;
  private theme: OfficeTheme;

  constructor(layout: OfficeLayout, theme: OfficeTheme) {
    this.layout = layout;
    this.theme = theme;
  }

  setTheme(theme: OfficeTheme): void {
    this.theme = theme;
  }

  /** 바닥 타일 렌더링 */
  renderFloor(ctx: CanvasRenderingContext2D): void {
    const { cols, rows, tileSize, tiles } = this.layout;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = tiles[r * cols + c];
        if (tile === 1) {
          // 체커보드 패턴
          ctx.fillStyle = (r + c) % 2 === 0 ? this.theme.floor : this.theme.floorAlt;
          ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
        }
      }
    }
  }

  /** 벽 타일 렌더링 */
  renderWalls(ctx: CanvasRenderingContext2D): void {
    const { cols, rows, tileSize, tiles } = this.layout;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = tiles[r * cols + c];
        if (tile === 2) {
          // 벽 본체
          ctx.fillStyle = this.theme.wall;
          ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
          // 벽 상단 하이라이트
          if (r === 0) {
            ctx.fillStyle = this.theme.wallTop;
            ctx.fillRect(c * tileSize, r * tileSize, tileSize, 3);
          }
        }
      }
    }
  }

  /** 책상 + 의자 + 모니터 렌더링 */
  renderDesks(ctx: CanvasRenderingContext2D, activeDesks: Set<number>): void {
    const { tileSize } = this.layout;

    for (let i = 0; i < this.layout.desks.length; i++) {
      const desk = this.layout.desks[i];
      const isActive = activeDesks.has(i);

      // 의자 (좌석 위치)
      const chairSprite = getFurnitureSprite("chair", this.theme);
      ctx.drawImage(
        chairSprite,
        desk.seatCol * tileSize + (tileSize - chairSprite.width) / 2,
        desk.seatRow * tileSize + (tileSize - chairSprite.height) / 2,
      );

      // 책상
      const deskSprite = getFurnitureSprite("desk", this.theme);
      ctx.drawImage(
        deskSprite,
        desk.col * tileSize - deskSprite.width / 2 + tileSize / 2,
        desk.row * tileSize,
      );

      // 모니터
      const monType: FurnitureType = isActive ? "monitorActive" : "monitor";
      const monSprite = getFurnitureSprite(monType, this.theme);
      ctx.drawImage(
        monSprite,
        desk.col * tileSize + (tileSize - monSprite.width) / 2,
        desk.row * tileSize - monSprite.height + 4,
      );
    }
  }

  /** 장식물 렌더링 */
  renderDecorations(ctx: CanvasRenderingContext2D): void {
    const { tileSize } = this.layout;
    for (const deco of this.layout.decorations) {
      const sprite = getFurnitureSprite(deco.type as FurnitureType, this.theme);
      ctx.drawImage(
        sprite,
        deco.col * tileSize + (tileSize - sprite.width) / 2,
        deco.row * tileSize + (tileSize - sprite.height),
      );
    }
  }

  /** 타일 좌표로 책상 인덱스 찾기 (히트 테스트) */
  getDeskIndexAt(col: number, row: number): number {
    for (let i = 0; i < this.layout.desks.length; i++) {
      const d = this.layout.desks[i];
      // 책상 영역: col±1, row ~ row+2 (좌석 포함)
      if (col >= d.col - 1 && col <= d.col + 1 && row >= d.row - 1 && row <= d.seatRow + 1) {
        return i;
      }
    }
    return -1;
  }

  getDeskPosition(index: number): DeskPosition | null {
    return this.layout.desks[index] ?? null;
  }

  getDecorations(): Decoration[] {
    return this.layout.decorations;
  }
}
