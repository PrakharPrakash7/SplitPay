import { useEffect } from 'react';
import { onMessage } from 'firebase/messaging';
import { messaging } from '../firebase';
import { toast } from 'react-toastify';

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
        toast.info(
          `${notification.title}\n${notification.body}`,
          {
            position: 'top-right',
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );
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
