import { useEffect } from 'react';
import { Platform } from 'react-native';

interface UseVolumeShortcutOptions {
  onTrigger: () => void;
  enabled?: boolean;
}

/**
 * Optional and experimental hardware volume button shortcut hook.
 *
 * Intercepting physical volume buttons requires custom native modules / Dev Clients
 * and has App Store guideline restrictions on iOS.
 *
 * This hook provides a safe, non-crashing abstraction:
 * - On Web: Listens for ArrowUp key for quick testing.
 * - On Native: Serves as the extension point for native KeyEvent / volume listeners.
 * - Invariant: Tapping or triggering NEVER auto-commits.
 */
export function useVolumeShortcut({ onTrigger, enabled = true }: UseVolumeShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          onTrigger();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    // Native implementation placeholder for custom dev client plugin:
    // When a custom native module like react-native-volume-manager is installed,
    // it will be attached here behind a platform guard.
  }, [enabled, onTrigger]);
}
