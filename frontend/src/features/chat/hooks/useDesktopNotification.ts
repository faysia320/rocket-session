import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'notifications-enabled';

export function useDesktopNotification() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // localStorage 접근 불가 시 무시
    }
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      if (!prev && 'Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') setEnabled(true);
        });
        return prev;
      }
      return !prev;
    });
  }, []);

  const notify = useCallback(
    (title: string, body?: string) => {
      if (
        !enabled ||
        !('Notification' in window) ||
        Notification.permission !== 'granted' ||
        !document.hidden
      ) {
        return;
      }
      const n = new Notification(title, { body, icon: '/favicon.ico' });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    },
    [enabled],
  );

  return { enabled, toggle, notify };
}
