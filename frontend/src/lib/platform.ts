/** 모바일 디바이스 감지 (iOS/Android) */
export const isMobileDevice = (): boolean => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
