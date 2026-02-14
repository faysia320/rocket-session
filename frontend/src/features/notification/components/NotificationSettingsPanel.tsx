import { Volume2, VolumeX, Bell, BellOff, Play } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NotificationCategory, NotificationChannel } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { useNotificationCenter } from '../hooks/useNotificationCenter';
import { SOUND_PACKS } from '../hooks/useSoundEngine';

const CATEGORIES: NotificationCategory[] = [
  'task.complete',
  'task.error',
  'input.required',
  'session.start',
];

const CHANNELS: { id: NotificationChannel; label: string }[] = [
  { id: 'sound', label: 'Sound' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'toast', label: 'Toast' },
];

export function NotificationSettingsPanel() {
  const {
    settings,
    toggleEnabled,
    setVolume,
    setSoundPack,
    toggleCategory,
    toggleChannel,
    requestDesktopPermission,
    testSound,
  } = useNotificationCenter();

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const handleToggleEnabled = async () => {
    if (!settings.enabled) {
      await requestDesktopPermission();
    }
    toggleEnabled();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          NOTIFICATIONS
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 px-2 font-mono text-[11px] gap-1.5', settings.enabled && 'text-primary')}
          onClick={handleToggleEnabled}
        >
          {settings.enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          {settings.enabled ? 'ON' : 'OFF'}
        </Button>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground/70">
        CESP 기반 알림 시스템입니다. 카테고리별로 사운드, 데스크톱 알림, 토스트를 개별 제어할 수 있습니다.
      </p>

      {settings.enabled ? (
        <>
          {/* 볼륨 슬라이더 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {settings.volume > 0 ? (
                <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                aria-label="알림 볼륨"
              />
              <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
          </div>

          {/* 사운드 팩 선택 */}
          <div className="space-y-2">
            <Label className="font-mono text-[10px] font-semibold text-muted-foreground tracking-wider">
              SOUND PACK
            </Label>
            <select
              className="font-mono text-xs bg-input border border-border rounded px-2 py-1.5 w-full outline-none focus:border-primary/50"
              value={settings.soundPack}
              onChange={(e) => setSoundPack(e.target.value)}
              aria-label="사운드 팩 선택"
            >
              {SOUND_PACKS.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name} — {pack.description}
                </option>
              ))}
            </select>
          </div>

          {/* 카테고리별 설정 */}
          <div className="space-y-3">
            {CATEGORIES.map((category) => {
              const config = settings.categories[category];
              const label = CATEGORY_LABELS[category];
              return (
                <div
                  key={category}
                  className={cn(
                    'rounded-md border p-3 space-y-2 transition-colors',
                    config.enabled ? 'border-border bg-card' : 'border-transparent bg-muted/30',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={config.enabled}
                        onCheckedChange={() => toggleCategory(category)}
                      />
                      <span className="font-mono text-xs font-medium text-foreground">
                        {label.label}
                      </span>
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={() => testSound(category)}
                      aria-label={`${label.label} 사운드 미리듣기`}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/70 pl-6">
                    {label.description}
                  </p>
                  {config.enabled ? (
                    <div className="flex gap-3 pl-6">
                      {CHANNELS.map((ch) => (
                        <label key={ch.id} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={config.channels[ch.id]}
                            onCheckedChange={() => toggleChannel(category, ch.id)}
                          />
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {ch.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
