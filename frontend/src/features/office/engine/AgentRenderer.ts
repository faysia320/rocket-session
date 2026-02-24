import type { AgentState, DeskPosition, OfficeTheme } from "../types/office";
import { getCharacterSprite, getFrameCount, CHAR_WIDTH, CHAR_HEIGHT } from "../sprites/characters";
import { drawStatusIcon, drawBubble } from "../sprites/effects";

/** 에이전트 캐릭터 렌더러 + 프레임 애니메이션 관리 */
export class AgentRenderer {
  private frameTimer = 0;
  private frameIndex = 0;
  private readonly frameDuration: number;

  constructor(fps = 4) {
    this.frameDuration = 1 / fps;
  }

  /** 시간 업데이트 → 프레임 인덱스 순환 */
  update(dt: number): void {
    this.frameTimer += dt;
    if (this.frameTimer >= this.frameDuration) {
      this.frameTimer -= this.frameDuration;
      this.frameIndex++;
    }
  }

  /** 에이전트 캐릭터 렌더링 */
  renderAgent(
    ctx: CanvasRenderingContext2D,
    agent: AgentState,
    desk: DeskPosition,
    tileSize: number,
    showLabel: boolean,
    isHovered: boolean,
    theme: OfficeTheme,
  ): void {
    const frameCount = getFrameCount(agent.activity);
    const frame = this.frameIndex % frameCount;
    const sprite = getCharacterSprite(agent.characterId, agent.activity, frame);

    // 캐릭터 위치: 좌석 타일 중앙, 하단 정렬
    const cx = desk.seatCol * tileSize + tileSize / 2;
    const cy = desk.seatRow * tileSize + tileSize;
    const drawX = cx - CHAR_WIDTH / 2;
    const drawY = cy - CHAR_HEIGHT;

    // 호버 시 하이라이트
    if (isHovered) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = theme.text;
      ctx.fillRect(drawX - 1, drawY - 1, CHAR_WIDTH + 2, CHAR_HEIGHT + 2);
      ctx.restore();
    }

    // 캐릭터 스프라이트
    ctx.drawImage(sprite, drawX, drawY);

    // 상태 아이콘 (캐릭터 머리 위)
    if (agent.activity !== "idle") {
      drawStatusIcon(ctx, cx, drawY - 2, agent.activity, theme, this.frameIndex);
    }

    // 호버 시 말풍선 (활동 라벨)
    if (isHovered && agent.activityLabel) {
      drawBubble(ctx, cx, drawY - 14, agent.activityLabel, theme);
    }

    // 이름표
    if (showLabel) {
      ctx.save();
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = theme.textMuted;
      const name = agent.sessionName.length > 10
        ? agent.sessionName.slice(0, 9) + "\u2026"
        : agent.sessionName;
      ctx.fillText(name, cx, cy + 2);
      ctx.restore();
    }
  }

  getFrameIndex(): number {
    return this.frameIndex;
  }
}
