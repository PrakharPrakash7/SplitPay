import { useEffect } from "react";
import { getToken } from "firebase/messaging";
import { messaging } from "../firebase";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const CardholderDashboard = () => {
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/cardholder";
  };

  useEffect(() => {
    const registerFCM = async () => {
      try {
        // Request notification permission
        const permission = await Notification.requestPermission();
        
        if (permission === "granted") {
          console.log("Notification permission granted");
          
          // Get FCM token using VAPID key from environment
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          
          if (!vapidKey || vapidKey === "YOUR_VAPID_KEY_HERE") {
            console.warn("⚠ VAPID key not configured. Please add it to .env file");
            toast.warning("Push notifications not configured. Please contact admin.");
            return;
          }
          
          const token = await getToken(messaging, { vapidKey });
          
          if (token) {
            console.log("FCM Token:", token);
            
            // Send token to backend
            const jwt = localStorage.getItem("token");
            const res = await fetch("http://localhost:5000/api/users/fcm", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`
              },
              body: JSON.stringify({ fcmToken: token })
            });
            
            if (res.ok) {
              console.log("✓ FCM token registered successfully");
              toast.success("🔔 Push notifications enabled!");
            } else {
              console.error("Failed to register FCM token");
              toast.error("Failed to register for notifications");
            }
          } else {
            console.log("No registration token available");
          }
        } else {
          console.log("Notification permission denied");
          toast.info("Enable notifications to receive deal alerts!");
        }
      } catch (err) {
        console.error("FCM token error:", err);
        // Don't show error toast for missing VAPID key in development
        if (!err.message.includes("messaging/registration-token-not-registered")) {
          toast.error("Failed to enable notifications");
        }
      }
    };
    
    registerFCM();
  }, []);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-900">
      <ToastContainer />
      <h1 className="text-3xl font-bold mb-6">Cardholder Dashboard</h1>
      <p>Welcome, view pending orders or make payments here.</p>
      <button
        onClick={handleLogout}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      >
        Logout
      </button>
    </div>
  );
};

export default CardholderDashboard;
