import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { NotificationCategory } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { useNotificationSettings } from './useNotificationSettings';
import { useSoundEngine } from './useSoundEngine';

interface NotifyOptions {
  title?: string;
  body?: string;
}

export function useNotificationCenter() {
  const { settings, toggleEnabled, setVolume, setSoundPack, toggleCategory, toggleChannel } = useNotificationSettings();
  const { playSound } = useSoundEngine();
  const permissionRequested = useRef(false);

  /** 데스크톱 알림 권한 요청 */
  const requestDesktopPermission = useCallback(async () => {
    if (!('Notification' in window) || Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    if (permissionRequested.current) return false;
    permissionRequested.current = true;
    const result = await Notification.requestPermission();
    permissionRequested.current = false;
    return result === 'granted';
  }, []);

  /** 알림 트리거 */
  const notify = useCallback(
    (category: NotificationCategory, options?: NotifyOptions) => {
      if (!settings.enabled) return;

      const config = settings.categories[category];
      if (!config?.enabled) return;

      const label = CATEGORY_LABELS[category];
      const title = options?.title ?? label.label;
      const body = options?.body ?? label.description;

      // 사운드
      if (config.channels.sound) {
        playSound(category, settings.volume, settings.soundPack);
      }

      // 데스크톱 알림 (탭이 비활성 상태일 때만)
      if (config.channels.desktop && document.hidden) {
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(title, { body, icon: '/favicon.ico' });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        }
      }

      // 토스트
      if (config.channels.toast) {
        if (category === 'task.error') {
          toast.error(body);
        } else {
          toast.info(body);
        }
      }
    },
    [settings, playSound],
  );

  /** 설정 UI에서 카테고리별 사운드 미리듣기 (설정 무시, 강제 재생) */
  const testSound = useCallback(
    (category: NotificationCategory) => {
      playSound(category, settings.volume, settings.soundPack);
    },
    [playSound, settings.volume, settings.soundPack],
  );

  return {
    settings,
    notify,
    testSound,
    toggleEnabled,
    setVolume,
    setSoundPack,
    toggleCategory,
    toggleChannel,
    requestDesktopPermission,
  };
}
