import { useState, useCallback, useEffect } from "react";
import type {
  NotificationSettings,
  NotificationCategory,
  NotificationChannel,
} from "@/types";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/types";

const STORAGE_KEY = "notification-settings";

function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    const defaults = DEFAULT_NOTIFICATION_SETTINGS;
    const categories = { ...defaults.categories };
    if (parsed.categories) {
      for (const key of Object.keys(categories) as NotificationCategory[]) {
        if (parsed.categories[key]) {
          categories[key] = {
            ...categories[key],
            ...parsed.categories[key],
            channels: {
              ...categories[key].channels,
              ...parsed.categories[key]?.channels,
            },
          };
        }
      }
    }
    return { ...defaults, ...parsed, categories };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

function saveSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage not available
  }
}

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const toggleEnabled = useCallback(() => {
    setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings((prev) => ({
      ...prev,
      volume: Math.max(0, Math.min(1, volume)),
    }));
  }, []);

  const setSoundPack = useCallback((soundPack: string) => {
    setSettings((prev) => ({ ...prev, soundPack }));
  }, []);

  const toggleCategory = useCallback((category: NotificationCategory) => {
    setSettings((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          enabled: !prev.categories[category].enabled,
        },
      },
    }));
  }, []);

  const toggleChannel = useCallback(
    (category: NotificationCategory, channel: NotificationChannel) => {
      setSettings((prev) => ({
        ...prev,
        categories: {
          ...prev.categories,
          [category]: {
            ...prev.categories[category],
            channels: {
              ...prev.categories[category].channels,
              [channel]: !prev.categories[category].channels[channel],
            },
          },
        },
      }));
    },
    [],
  );

  return {
    settings,
    toggleEnabled,
    setVolume,
    setSoundPack,
    toggleCategory,
    toggleChannel,
  };
}
