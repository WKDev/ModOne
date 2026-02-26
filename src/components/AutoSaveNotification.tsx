import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface AutoSaveNotificationProps {
  /** Duration to show the notification in milliseconds */
  duration?: number;
}

export function AutoSaveNotification({ duration = 3000 }: AutoSaveNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [timestamp, setTimestamp] = useState<Date | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const setup = async () => {
      unlisten = await listen('auto-save-completed', () => {
        setTimestamp(new Date());
        setVisible(true);

        // Auto-hide after duration
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          setVisible(false);
        }, duration);
      });
    };

    setup();

    return () => {
      unlisten?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [duration]);

  if (!visible) return null;

  const timeString = timestamp?.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2
                 bg-[var(--color-success)]/10
                 border border-[var(--color-success)]/30
                 text-[var(--color-success)]
                 rounded-lg shadow-lg
                 animate-fade-in"
    >
      <CheckCircle size={18} className="text-[var(--color-success)]" />
      <div className="text-sm">
        <span className="font-medium">프로젝트 자동 저장됨</span>
        {timestamp && (
          <span className="text-[var(--color-success)] ml-2 text-xs">{timeString}</span>
        )}
      </div>
    </div>
  );
}
