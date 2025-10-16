import { useEffect } from 'react';
import { onMessage } from 'firebase/messaging';
import { messaging } from '../firebase';
import toast from 'react-hot-toast';

/**
 * Custom hook to handle FCM foreground messages
 * Automatically refreshes data when notifications are received
 */
export const useFCMForeground = (onMessageReceived) => {
  useEffect(() => {
    if (!messaging) {
      console.warn('Firebase Messaging not available');
      return;
    }

    // Listen for foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('📨 Foreground message received:', payload);

      const { notification, data } = payload;

      // Show toast notification
      if (notification) {
        toast(`${notification.title}\n${notification.body}`, {
          duration: 5000,
          icon: '📨',
        });
      }

      // Call the callback to refresh data
      if (onMessageReceived) {
        onMessageReceived(data);
      }
    });

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [onMessageReceived]);
};

export default useFCMForeground;
