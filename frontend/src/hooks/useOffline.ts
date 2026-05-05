import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/**
 * Monitors the browser online/offline events and updates the store.
 * Also handles syncing the offline queue when connectivity resumes.
 */
export function useOfflineDetector() {
  const { setOffline, isSimulatingOffline, syncOfflineQueue, pendingSyncCount } = useStore();

  useEffect(() => {
    if (isSimulatingOffline) return;

    const handleOnline  = () => { setOffline(false); };
    const handleOffline = () => { setOffline(true); };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSimulatingOffline, setOffline]);

  // Auto-sync when coming back online with queued items
  useEffect(() => {
    const { isOffline } = useStore.getState();
    if (!isOffline && pendingSyncCount > 0) {
      const timer = setTimeout(() => syncOfflineQueue(), 1200);
      return () => clearTimeout(timer);
    }
  }, [pendingSyncCount, syncOfflineQueue]);
}
