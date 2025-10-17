import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

  const navigate = useNavigate();

  // Update current time every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate time remaining for a deal
  const getTimeRemaining = (expiresAt) => {
    const now = currentTime;
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) {
      return 'Expired';
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/cardholder");
  };

  // Fetch available deals
  const fetchDeals = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/deals", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Filter only pending deals for cardholders
        const pendingDeals = (data.deals || []).filter(deal => deal.status === 'pending');
        setDeals(pendingDeals);
        console.log('✅ Deals refreshed:', pendingDeals.length, 'pending');
      }
    } catch (error) {
      console.error("Error fetching deals:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Handle FCM foreground messages - auto-refresh when new deal is created
  useFCMForeground((data) => {
    console.log('🔔 New deal notification received, refreshing...');
    fetchDeals();
  });

  // Accept a deal
  const handleAcceptDeal = async (dealId) => {
    setAccepting(dealId);
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/deals/${dealId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Deal accepted! 🎉');
        fetchDeals(); // Refresh to remove accepted deal
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to accept deal');
      }
    } catch (error) {
      console.error("Error accepting deal:", error);
      toast.error('Failed to accept deal');
    } finally {
      setAccepting(null);
    }
  };

  useEffect(() => {
    const registerFCM = async () => {
      try {
        // Check if already registered in this session
        const fcmRegistered = sessionStorage.getItem('fcm_registered');
        
        // Request notification permission
        const permission = await Notification.requestPermission();
        
        if (permission === "granted") {
          console.log("Notification permission granted");
          
          // Get FCM token using VAPID key from environment
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          
          if (!vapidKey || vapidKey === "YOUR_VAPID_KEY_HERE") {
            console.warn("⚠ VAPID key not configured. Please add it to .env file");
            if (!fcmRegistered) {
              toast.warning("Push notifications not configured. Please contact admin.");
              sessionStorage.setItem('fcm_registered', 'true');
            }
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
              // Only show toast on first registration
              if (!fcmRegistered) {
                toast.success("🔔 Push notifications enabled!");
                sessionStorage.setItem('fcm_registered', 'true');
              }
            } else {
              console.error("Failed to register FCM token");
              if (!fcmRegistered) {
                toast.error("Failed to register for notifications");
              }
            }
          } else {
            console.log("No registration token available");
          }
        } else {
          console.log("Notification permission denied");
          if (!fcmRegistered) {
            toast.info("Enable notifications to receive deal alerts!");
            sessionStorage.setItem('fcm_registered', 'true');
          }
        }
      } catch (err) {
        console.error("FCM token error:", err);
        const fcmRegistered = sessionStorage.getItem('fcm_registered');
        // Don't show error toast for missing VAPID key in development
        if (!err.message.includes("messaging/registration-token-not-registered") && !fcmRegistered) {
          toast.error("Failed to enable notifications");
          sessionStorage.setItem('fcm_registered', 'true');
        }
      }
    };
    
    registerFCM();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Cardholder Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Available Deals</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading deals...</p>
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No pending deals available. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deals.map((deal) => (
                <div 
                  key={deal._id} 
                  className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 transition"
                >
                  <div className="flex items-start space-x-4">
                    {deal.product?.image && (
                      <img 
                        src={deal.product.image} 
                        alt={deal.product.title}
                        className="w-32 h-32 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{deal.product?.title}</h3>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-600">
                          Original Price: <span className="font-semibold line-through">₹{deal.product?.price}</span>
                        </p>
                        <p className="text-sm">
                          Your Price: <span className="font-semibold text-green-600 text-xl">₹{deal.discountedPrice}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          You Save: <span className="font-semibold text-green-600">₹{deal.product?.price - deal.discountedPrice}</span>
                        </p>
                        <p className="text-sm text-orange-600">
                          ⏰ Expires in: <span className="font-semibold">{getTimeRemaining(deal.expiresAt)}</span>
                        </p>
                        {deal.product?.bankOffers && deal.product.bankOffers.length > 0 && (
                          <div className="mt-3 bg-blue-50 p-3 rounded">
                            <p className="text-sm font-semibold text-blue-900 mb-2">💳 Bank Credit Card Offers:</p>
                            <ul className="text-sm text-blue-800 space-y-1">
                              {deal.product.bankOffers.map((offer, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="font-semibold mr-2">{offer.bank}:</span>
                                  <span>
                                    {offer.discount && `Extra ₹${offer.discount} off with `}
                                    {offer.bank} Credit Card
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleAcceptDeal(deal._id)}
                        disabled={accepting === deal._id}
                        className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {accepting === deal._id ? 'Accepting...' : 'Accept Deal'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardholderDashboard;
