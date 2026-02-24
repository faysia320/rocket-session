import type { OfficeTheme } from "../types/office";

/**
 * 현재 DOM에서 CSS 변수를 읽어 OfficeTheme 생성.
 * HSL CSS 변수를 hex로 변환하지 않고, 직접 색상값을 정의.
 * 다크/라이트 모드에 따라 다른 색상 세트 반환.
 */
export function readThemeFromCSS(): OfficeTheme {
  const isDark = document.documentElement.classList.contains("dark");

  if (isDark) {
    return {
      bg: "#060A12",
      floor: "#1A2030",
      floorAlt: "#172030",
      wall: "#0F1520",
      wallTop: "#2A3550",
      desk: "#3A2A1A",
      deskTop: "#5A4A3A",
      monitor: "#2A2A3A",
      monitorScreen: "#1A1A2A",
      monitorScreenActive: "#1A3A5A",
      chair: "#3A3A4A",
      plant: "#2A8A3A",
      plantPot: "#6A4A2A",
      coffee: "#4A4A5A",
      door: "#4A3A2A",
      doorFrame: "#3A2A1A",
      text: "#E0E0E0",
      textMuted: "#8A8A9A",
      bubbleBg: "#1A2030E0",
      bubbleBorder: "#3A4A5A",
    };
  }

  return {
    bg: "#F0F0F0",
    floor: "#E8DCC8",
    floorAlt: "#E0D4C0",
    wall: "#D0C0A8",
    wallTop: "#E8D8C0",
    desk: "#8B7355",
    deskTop: "#A08868",
    monitor: "#505060",
    monitorScreen: "#C0C0D0",
    monitorScreenActive: "#A0C0E0",
    chair: "#606070",
    plant: "#3AAA4A",
    plantPot: "#9A7A5A",
    coffee: "#707080",
    door: "#7A6A5A",
    doorFrame: "#6A5A4A",
    text: "#202020",
    textMuted: "#606060",
    bubbleBg: "#FFFFFFE0",
    bubbleBorder: "#C0C0D0",
  };
}
