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
                 bg-green-50 dark:bg-green-900/30
                 border border-green-200 dark:border-green-800
                 text-green-800 dark:text-green-300
                 rounded-lg shadow-lg
                 animate-fade-in"
    >
      <CheckCircle size={18} className="text-green-500 dark:text-green-400" />
      <div className="text-sm">
        <span className="font-medium">프로젝트 자동 저장됨</span>
        {timestamp && (
          <span className="text-green-600 dark:text-green-400 ml-2 text-xs">{timeString}</span>
        )}
      </div>
    </div>
  );
}
