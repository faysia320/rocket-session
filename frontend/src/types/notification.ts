// ---------------------------------------------------------------------------
// CESP 기반 알림 카테고리 (PeonPing 개념 차용)
// ---------------------------------------------------------------------------

/** CESP 알림 카테고리 */
export type NotificationCategory =
  | "task.complete" // 세션 완료 (running → idle)
  | "task.error" // 세션 에러 (status: error)
  | "input.required" // Permission 요청 (도구 승인 필요)
  | "session.start"; // 세션 시작 (status: running)

/** 알림 채널: 어떤 방식으로 알릴지 */
export type NotificationChannel = "sound" | "desktop" | "toast";

/** 카테고리별 알림 설정 */
export interface CategoryNotificationConfig {
  enabled: boolean;
  channels: Record<NotificationChannel, boolean>;
}

/** 전체 알림 설정 */
export interface NotificationSettings {
  /** 전역 알림 활성화 */
  enabled: boolean;
  /** 사운드 볼륨 (0.0 ~ 1.0) */
  volume: number;
  /** 사운드 팩 ID */
  soundPack: string;
  /** 카테고리별 설정 */
  categories: Record<NotificationCategory, CategoryNotificationConfig>;
}

/** 사운드 팩 정의 */
export interface SoundPack {
  id: string;
  name: string;
  description: string;
  sounds: Partial<Record<NotificationCategory, string>>;
}

/** 기본 알림 설정 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  volume: 0.7,
  soundPack: "peon",
  categories: {
    "task.complete": {
      enabled: true,
      channels: { sound: true, desktop: true, toast: false },
    },
    "task.error": {
      enabled: true,
      channels: { sound: true, desktop: true, toast: true },
    },
    "input.required": {
      enabled: true,
      channels: { sound: true, desktop: true, toast: false },
    },
    "session.start": {
      enabled: false,
      channels: { sound: false, desktop: false, toast: false },
    },
  },
};

/** 카테고리 표시 정보 */
export const CATEGORY_LABELS: Record<
  NotificationCategory,
  { label: string; description: string }
> = {
  "task.complete": {
    label: "작업 완료",
    description: "세션이 실행 완료되었을 때",
  },
  "task.error": {
    label: "에러 발생",
    description: "세션에서 에러가 발생했을 때",
  },
  "input.required": {
    label: "입력 필요",
    description: "Permission 승인이 필요할 때",
  },
  "session.start": {
    label: "세션 시작",
    description: "세션이 실행을 시작했을 때",
  },
};
