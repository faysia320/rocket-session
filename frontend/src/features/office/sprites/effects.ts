import type { AgentActivity, OfficeTheme } from "../types/office";

/** 활동별 상태 아이콘 문자 */
const ACTIVITY_ICONS: Record<AgentActivity, string> = {
  idle: "",
  thinking: "\u2026",       // …
  reading: "\uD83D\uDCD6",  // 📖
  writing: "\u270F\uFE0F",  // ✏️
  running: ">_",
  searching: "\uD83D\uDD0D", // 🔍
  error: "!",
};

/**
 * 말풍선을 Canvas에 그린다.
 * 캐릭터 위에 떠 있는 둥근 사각형 + 꼬리.
 */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  theme: OfficeTheme,
  maxWidth = 120,
): void {
  if (!text) return;

  ctx.save();
  ctx.font = "bold 9px monospace";
  ctx.textBaseline = "top";

  const measured = ctx.measureText(text);
  const textW = Math.min(measured.width, maxWidth);
  const padding = 4;
  const bubbleW = textW + padding * 2;
  const bubbleH = 14;
  const bx = x - bubbleW / 2;
  const by = y - bubbleH - 6;
  const radius = 3;

  // 배경
  ctx.fillStyle = theme.bubbleBg;
  ctx.strokeStyle = theme.bubbleBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + radius, by);
  ctx.lineTo(bx + bubbleW - radius, by);
  ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + radius);
  ctx.lineTo(bx + bubbleW, by + bubbleH - radius);
  ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - radius, by + bubbleH);
  // 꼬리
  ctx.lineTo(x + 3, by + bubbleH);
  ctx.lineTo(x, by + bubbleH + 4);
  ctx.lineTo(x - 3, by + bubbleH);
  ctx.lineTo(bx + radius, by + bubbleH);
  ctx.quadraticCurveTo(bx, by + bubbleH, bx, by + bubbleH - radius);
  ctx.lineTo(bx, by + radius);
  ctx.quadraticCurveTo(bx, by, bx + radius, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 텍스트
  ctx.fillStyle = theme.text;
  const displayText =
    measured.width > maxWidth ? text.slice(0, Math.floor((maxWidth / measured.width) * text.length)) + "\u2026" : text;
  ctx.fillText(displayText, bx + padding, by + 3);
  ctx.restore();
}

/**
 * 활동별 상태 아이콘을 그린다.
 * 캐릭터 머리 위, 말풍선이 없을 때 간단한 아이콘 표시.
 */
export function drawStatusIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  activity: AgentActivity,
  theme: OfficeTheme,
  frameIndex: number,
): void {
  const icon = ACTIVITY_ICONS[activity];
  if (!icon) return;

  ctx.save();

  if (activity === "error") {
    // 에러: 빨간 느낌표 깜빡임
    ctx.globalAlpha = frameIndex % 2 === 0 ? 1 : 0.3;
    ctx.fillStyle = "#FF4444";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("!", x, y - 2);
  } else if (activity === "thinking") {
    // thinking: 점 애니메이션
    ctx.fillStyle = theme.textMuted;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const dots = ".".repeat((frameIndex % 3) + 1);
    ctx.fillText(dots, x, y - 2);
  } else {
    // 기타: 작은 아이콘
    ctx.font = "10px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(icon, x, y - 2);
  }

  ctx.restore();
}
