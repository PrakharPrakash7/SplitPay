import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import DealFlowModal from "../components/DealFlowModal";
import { API_BASE_URL } from "../utils/api";
import { getAuthToken, clearAuth } from "../utils/authHelper";

const CardholderDashboard = () => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showDealModal, setShowDealModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [autoOpenedDealId, setAutoOpenedDealId] = useState(null); // Track auto-opened deal
  const [modalRefreshKey, setModalRefreshKey] = useState(0); // Force modal refresh
  const navigate = useNavigate();
  
  // Use refs to access latest state in socket handlers
  const selectedDealRef = useRef(selectedDeal);
  const showDealModalRef = useRef(showDealModal);
  
  useEffect(() => {
    selectedDealRef.current = selectedDeal;
    showDealModalRef.current = showDealModal;
  }, [selectedDeal, showDealModal]);
  
  // Auto-refresh modal when it's open - poll every 3 seconds
  // BUT: Don't refresh when user is filling order form (address_shared status)
  useEffect(() => {
    if (!showDealModal || !selectedDeal?._id) {
      return;
    }
    
    // Don't auto-refresh if user is filling order form
    if (selectedDeal.status === 'address_shared') {
      console.log('⏸️ Pausing auto-refresh - user is filling order form');
      return;
    }
    
    console.log('🔄 Starting auto-refresh for modal with deal:', selectedDeal._id);
    
    const refreshInterval = setInterval(async () => {
      console.log('⏰ Auto-refreshing modal deal data...');
      try {
        const token = getAuthToken('cardholder');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === selectedDeal._id);
          
          if (updatedDeal && updatedDeal.status !== selectedDeal.status) {
            console.log('✅ Deal status changed:', selectedDeal.status, '→', updatedDeal.status);
            setSelectedDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          } else if (updatedDeal && updatedDeal.status === 'address_shared' && !selectedDeal.shippingDetails && updatedDeal.shippingDetails) {
            console.log('✅ Address details received!');
            setSelectedDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      } catch (error) {
        console.error('❌ Error refreshing modal:', error);
      }
    }, 3000); // Poll every 3 seconds
    
    return () => {
      console.log('🛑 Stopping auto-refresh');
      clearInterval(refreshInterval);
    };
  }, [showDealModal, selectedDeal]);

  const getStatusLabel = (deal) => {
    const labels = {
      pending: 'Awaiting Cardholder',
      matched: 'Buyer Payment Pending',
      awaiting_payment: 'Buyer Payment Pending',
      payment_authorized: 'Awaiting Buyer Address',
      address_shared: 'Ready to Place Order',
      order_placed: 'Order Submitted',
      shipped: 'Order Shipped',
      payment_captured: 'Payment Captured',
      disbursed: 'Commission Disbursed',
      completed: 'Deal Completed',
      expired: 'Deal Expired',
      cancelled: 'Deal Cancelled',
      refunded: 'Payment Refunded',
      failed: 'Deal Failed'
    };

    return labels[deal.status] || deal.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getStatusBadgeClass = (status) => {
    if (['pending'].includes(status)) return 'bg-yellow-100 text-yellow-800';
    if (['matched', 'awaiting_payment'].includes(status)) return 'bg-blue-100 text-blue-800';
    if (['payment_authorized', 'address_shared'].includes(status)) return 'bg-purple-100 text-purple-800';
    if (status === 'order_placed') return 'bg-orange-100 text-orange-800';
    if (status === 'shipped') return 'bg-teal-100 text-teal-800';
    if (status === 'payment_captured') return 'bg-indigo-100 text-indigo-800';
    if (['disbursed', 'completed'].includes(status)) return 'bg-green-100 text-green-800';
    if (['expired', 'cancelled', 'refunded', 'failed'].includes(status)) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

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
    clearAuth('cardholder');
    navigate("/cardholder");
  };

  // Fetch available deals
  const fetchDeals = async () => {
    try {
      const token = getAuthToken('cardholder');
      const response = await fetch(`${API_BASE_URL}/api/deals`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📊 Fetched deals:", data.deals?.length || 0);
        
        // Filter deals: show all active deals + only last 5 expired deals
        const allDeals = data.deals || [];
        const inactiveStatuses = ['expired', 'cancelled', 'refunded', 'failed'];
        const activeDeals = allDeals.filter(deal => !inactiveStatuses.includes(deal.status));
        const historicalDeals = allDeals
          .filter(deal => inactiveStatuses.includes(deal.status))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5);
        
        // Combine active deals with last 5 historical deals
        const filteredDeals = [...activeDeals, ...historicalDeals];
        
        console.log(`📋 Showing ${activeDeals.length} active + ${historicalDeals.length} historical (statuses: ${inactiveStatuses.join(', ')})`);
        setDeals(filteredDeals);
        
        // Auto-open modal for deals that need cardholder action
        const actionNeededStatuses = ['pending', 'address_shared'];
        const dealNeedingAction = filteredDeals.find(d => actionNeededStatuses.includes(d.status));
        
        if (dealNeedingAction && dealNeedingAction._id !== autoOpenedDealId) {
          console.log(`🚀 Auto-opening modal for deal ${dealNeedingAction._id} in status: ${dealNeedingAction.status}`);
          setSelectedDeal(dealNeedingAction);
          setShowDealModal(true);
          setAutoOpenedDealId(dealNeedingAction._id);
        }
      } else {
        console.error("Failed to fetch deals:", response.status);
        toast.error("Failed to load deals");
      }
    } catch (error) {
      console.error("Error fetching deals:", error);
      toast.error("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  // Accept a deal
  const acceptDeal = async (dealId) => {
    console.log("🎯 Attempting to accept deal:", dealId);
    setAccepting(dealId);
    
    try {
      const token = getAuthToken('cardholder');
      const response = await fetch(`${API_BASE_URL}/api/deals/${dealId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log("✅ Deal accepted successfully:", data);
        toast.success("✅ Deal accepted! Waiting for buyer payment...");
        fetchDeals(); // Refresh deals
      } else {
        console.error("❌ Failed to accept deal:", data);
        toast.error(data.error || data.message || "Failed to accept deal");
      }
    } catch (error) {
      console.error("❌ Error accepting deal:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setAccepting(null);
    }
  };

  // Cancel a deal
  const cancelDeal = async (dealId, reason = 'Cancelled by cardholder') => {
    if (!confirm('Are you sure you want to cancel this deal? This action cannot be undone.')) {
      return;
    }

    try {
      const token = getAuthToken('cardholder');
      const response = await fetch(`${API_BASE_URL}/api/payment/cancel-deal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dealId, reason })
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.refunded) {
          toast.success('✅ Deal cancelled and buyer refunded successfully');
        } else {
          toast.success('✅ Deal cancelled successfully');
        }
        await fetchDeals(); // Wait for deals to refresh
      } else {
        toast.error(data.error || 'Failed to cancel deal');
      }
    } catch (error) {
      console.error('Error cancelling deal:', error);
      toast.error('Failed to cancel deal');
    }
  };

  // Setup Socket.io
  useEffect(() => {
    const token = getAuthToken('cardholder');
    if (!token) {
      console.error("❌ No token found, redirecting to login");
      navigate("/cardholder");
      return;
    }

    console.log("🔌 Connecting to Socket.io...");
    
    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      console.log("✅ Socket.io connected:", socket.id);
      socket.emit("joinCardholders");
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
    });

    // Listen for new deals
    socket.on("newDeal", async (deal) => {
      console.log("🆕 New deal received:", deal);
      toast.success("🆕 New deal available!");
      await fetchDeals();
    });

    // Listen for deal accepted by another cardholder
    socket.on("dealAccepted", async ({ dealId, message }) => {
      console.log("⚠️ Deal accepted by another cardholder:", dealId);
      toast.info(message || "Deal was accepted by another cardholder");
      await fetchDeals();
      
      // Close modal if it was open for this deal - use refs for latest state
      if (showDealModalRef.current && selectedDealRef.current?._id === dealId) {
        setShowDealModal(false);
        setSelectedDeal(null);
      }
    });

    // Listen for payment authorization
    socket.on("paymentAuthorized", async ({ dealId, message }) => {
      console.log("💰 Payment authorized for deal:", dealId);
      toast.success(message || "💰 Payment authorized! Waiting for address...");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      console.log("🔍 Modal state check - showDealModal:", showDealModalRef.current, "selectedDeal._id:", selectedDealRef.current?._id);
      if (showDealModalRef.current && selectedDealRef.current?._id === dealId) {
        console.log("✅ Modal is open for this deal, fetching updated data...");
        const token = getAuthToken('cardholder');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with payment authorized data");
            setSelectedDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Listen for address received - CRITICAL for cardholder modal refresh
    socket.on("addressReceived", async ({ dealId, address, product }) => {
      console.log("📍 Address received for deal:", dealId);
      console.log("📦 Product details:", product);
      console.log("🏠 Address:", address);
      
      toast.success("📍 Buyer shared shipping address!");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      console.log("🔍 Modal state check - showDealModal:", showDealModalRef.current, "selectedDeal._id:", selectedDealRef.current?._id);
      if (showDealModalRef.current && selectedDealRef.current?._id === dealId) {
        console.log("✅ Modal is open for this deal, fetching updated data with ADDRESS...");
        const token = getAuthToken('cardholder');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with address data - FORCE REFRESH", updatedDeal.status, updatedDeal.shippingDetails);
            setSelectedDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      } else {
        // If modal not open, open it with the updated deal
        console.log("🚀 Modal not open, opening with address data...");
        const token = getAuthToken('cardholder');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🚀 Opening modal with address data", updatedDeal.status);
            setSelectedDeal(updatedDeal);
            setShowDealModal(true);
            setAutoOpenedDealId(dealId);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Listen for order shipped
    socket.on("orderShipped", async ({ dealId, message }) => {
      console.log("🚚 Order shipped:", dealId);
      toast.success(message || "🚚 Order has been shipped!");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && selectedDealRef.current?._id === dealId) {
        const token = getAuthToken('cardholder');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with shipped data");
            setSelectedDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Listen for payment captured
    socket.on("paymentCaptured", async ({ dealId, amount, message }) => {
      console.log("✅ Payment captured:", dealId, amount);
      toast.success(message || "✅ Payment captured!");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && selectedDealRef.current?._id === dealId) {
        const token = getAuthToken('cardholder');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with payment captured data");
            setSelectedDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Listen for payout initiated
    socket.on("payoutInitiated", async ({ dealId, amount, message }) => {
      console.log("💸 Payout initiated:", dealId, amount);
      toast.success(message || "💸 Your payout has been initiated!");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && selectedDealRef.current?._id === dealId) {
        const token = getAuthToken('cardholder');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with payout data");
            setSelectedDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Listen for deal expired
    socket.on("dealExpired", async ({ dealId, message }) => {
      console.log("⏰ Deal expired:", dealId);
      toast.error(message || "⏰ Deal has expired!");
      await fetchDeals();
      
      // Close modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && selectedDealRef.current?._id === dealId) {
        toast.info("Closing expired deal...");
        setTimeout(() => {
          setShowDealModal(false);
          setSelectedDeal(null);
          setAutoOpenedDealId(null);
        }, 2000);
      }
    });

    // Listen for deal cancelled
    socket.on("dealCancelled", async ({ dealId, message, cancelledBy }) => {
      console.log("❌ Deal cancelled:", dealId, "by:", cancelledBy);
      toast.info(message || "❌ Deal has been cancelled");
      await fetchDeals();
      
      // Close modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && selectedDealRef.current?._id === dealId) {
        setTimeout(() => {
          setShowDealModal(false);
          setSelectedDeal(null);
          setAutoOpenedDealId(null);
        }, 2000);
      }
    });

    // Listen for deal completed
    socket.on("dealCompleted", async ({ dealId, message }) => {
      console.log("✅ Deal completed:", dealId);
      toast.success(message || "✅ Deal completed! Thank you!");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && selectedDealRef.current?._id === dealId) {
        const token = getAuthToken('cardholder');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with completed data");
            setSelectedDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Fetch initial deals
    fetchDeals();

    // Cleanup
    return () => {
      console.log("🔌 Disconnecting Socket.io");
      socket.disconnect();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">💳 Cardholder Dashboard</h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/cardholder-profile")}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              👤 Profile
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">📋 Available Deals</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading deals...</p>
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No available deals at the moment</p>
              <p className="text-sm text-gray-400 mt-2">Check back later for new opportunities!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deals.map((deal) => {
                const timeRemaining = getTimeRemaining(deal.expiresAt);
                const isExpired = timeRemaining === 'Expired';
                
                return (
                  <div key={deal._id} className={`border rounded-lg overflow-hidden ${isExpired ? 'opacity-50' : ''}`}>
                    {deal.product?.image && (
                      <img 
                        src={deal.product.image} 
                        alt={deal.product.title}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-2 line-clamp-2">
                        {deal.product?.title || 'Product'}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-semibold">Price:</span> ₹{deal.product?.price || 0}</p>
                       
                        {deal.totalBankDiscount > 0 ? (
                          <div className="border-t pt-2 mt-2">
                            <p className="font-semibold text-blue-600 mb-1">
                              💰 Your Commission: ₹{deal.cardholderCommission}
                            </p>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <p>• Total Bank Discount: ₹{deal.totalBankDiscount}</p>
                             
                            </div>
                          </div>
                        ) : (
                          <p><span className="font-semibold">Commission:</span> ₹{deal.commissionForCardholder || 0}</p>
                        )}
                        
                        {deal.status === 'pending' && (
                          <p className={`font-semibold ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
                            {isExpired ? '⏰ Expired' : `⏱️ ${timeRemaining} remaining`}
                          </p>
                        )}
                        {deal.status === 'matched' && deal.paymentExpiresAt && (
                          <p className="text-sm text-orange-600">
                            ⏰ Buyer must pay within: <span className="font-semibold">{getTimeRemaining(deal.paymentExpiresAt)}</span>
                          </p>
                        )}
                        {deal.status === 'awaiting_payment' && deal.paymentExpiresAt && (
                          <p className="text-sm text-orange-600">
                            ⏰ Buyer must complete payment within: <span className="font-semibold">{getTimeRemaining(deal.paymentExpiresAt)}</span>
                          </p>
                        )}
                        {deal.status === 'payment_authorized' && deal.addressExpiresAt && (
                          <p className="text-sm text-orange-600">
                            ⏰ Buyer must share address within: <span className="font-semibold">{getTimeRemaining(deal.addressExpiresAt)}</span>
                          </p>
                        )}
                        {deal.status === 'address_shared' && deal.orderExpiresAt && (
                          <p className="text-sm text-orange-600">
                            ⏰ Submit order within: <span className="font-semibold">{getTimeRemaining(deal.orderExpiresAt)}</span>
                          </p>
                        )}
                        <p><span className="font-semibold">Status:</span> 
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${getStatusBadgeClass(deal.status)}`}>
                            {getStatusLabel(deal)}
                          </span>
                        </p>
                      </div>
                      
                      {deal.status === 'pending' && !isExpired && (
                        <div className="mt-4 space-y-2">
                          <button
                            onClick={() => acceptDeal(deal._id)}
                            disabled={accepting === deal._id}
                            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {accepting === deal._id ? '⏳ Accepting...' : '✅ Accept Deal'}
                          </button>
                          <button
                            onClick={() => cancelDeal(deal._id, 'Cancelled by cardholder - deal not accepted')}
                            className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition text-sm"
                          >
                            ❌ Decline Deal
                          </button>
                        </div>
                      )}
                      
                      {deal.status === 'matched' && (
                        <div className="mt-4">
                          <div className="p-3 bg-blue-50 rounded text-center">
                            <p className="text-sm text-blue-800">⏳ Waiting for buyer payment...</p>
                          </div>
                          <button
                            onClick={() => cancelDeal(deal._id, 'Cancelled by cardholder before payment')}
                            className="w-full mt-2 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 text-sm"
                          >
                            ❌ Cancel Deal
                          </button>
                        </div>
                      )}
                      
                      {deal.status === 'payment_authorized' && (
                        <div className="mt-4">
                          <div className="p-3 bg-green-50 rounded text-center">
                            <p className="text-sm text-green-800">💰 Payment received! Waiting for address...</p>
                          </div>
                          <button
                            onClick={() => cancelDeal(deal._id, 'Cancelled by cardholder after payment - buyer will be refunded')}
                            className="w-full mt-2 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 text-sm"
                          >
                            ❌ Cancel Deal (Refund Buyer)
                          </button>
                        </div>
                      )}
                      
                      {deal.status === 'address_shared' && (
                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                          <p className="text-sm text-purple-800 text-center mb-2">📍 Address received! Place the order.</p>
                          <button
                            onClick={() => {
                              console.log("🖱️ Place Order button clicked for deal:", deal._id);
                              setSelectedDeal(deal);
                              setShowDealModal(true);
                              console.log("✅ Deal flow modal opened");
                            }}
                            className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
                          >
                            📦 Place Order
                          </button>
                          <button
                            onClick={() => cancelDeal(deal._id, 'Cancelled by cardholder after address shared - buyer will be refunded')}
                            className="w-full mt-2 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 text-sm"
                          >
                            ❌ Cancel Deal (Refund Buyer)
                          </button>
                        </div>
                      )}
                      
                      {deal.status === 'order_placed' && (
                        <div className="mt-4 p-3 bg-orange-50 rounded text-center">
                          <p className="text-sm text-orange-800">📦 Order submitted! Waiting for shipping...</p>
                        </div>
                      )}

                      {deal.status === 'cancelled' && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-center">
                          <p className="text-sm text-red-800 font-semibold">❌ Deal Cancelled</p>
                          {deal.cancelledBy && (
                            <p className="text-sm text-red-700 mt-1">Cancelled by {deal.cancelledBy}</p>
                          )}
                          {deal.cancelReason && (
                            <p className="text-xs text-red-600 mt-1">Reason: {deal.cancelReason}</p>
                          )}
                        </div>
                      )}

                      {deal.status === 'expired' && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-center">
                          <p className="text-sm text-red-800 font-semibold">⏰ Deal Expired</p>
                          {deal.cancelReason && (
                            <p className="text-xs text-red-600 mt-1">Reason: {deal.cancelReason}</p>
                          )}
                          {deal.escrowStatus === 'refunded' && (
                            <p className="text-xs text-red-600 mt-1">Any payment hold has been refunded.</p>
                          )}
                        </div>
                      )}

                      {deal.status === 'refunded' && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-center">
                          <p className="text-sm text-red-800 font-semibold">💸 Payment Refunded</p>
                          <p className="text-xs text-red-600 mt-1">Deal closed and payment returned to buyer.</p>
                        </div>
                      )}

                      {deal.status === 'shipped' && (
                        <div className="mt-4 p-4 bg-teal-50 border-2 border-teal-300 rounded-lg text-center">
                          <p className="text-sm text-teal-900 font-semibold mb-2">
                            🚚 Order Shipped!
                          </p>
                          <p className="text-sm text-teal-700">
                            Payment will be processed and disbursed soon.
                          </p>
                        </div>
                      )}

                      {deal.status === 'disbursed' && (
                        <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg text-center">
                          <p className="text-sm text-purple-900 font-semibold mb-2">
                            💸 Payment Disbursed!
                          </p>
                          <p className="text-sm text-purple-700">
                            Your commission of ₹{deal.commissionForCardholder} has been paid.
                          </p>
                        </div>
                      )}

                      {deal.status === 'completed' && (
                        <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg text-center">
                          <p className="text-sm text-green-900 font-semibold mb-2">
                            ✅ Deal Completed!
                          </p>
                          <p className="text-sm text-green-800">
                            🎉 Thank you! Your commission of ₹{deal.commissionForCardholder} was paid.
                          </p>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Deal Flow Modal */}
      {showDealModal && selectedDeal && (
        <DealFlowModal
          key={`${selectedDeal._id}-${selectedDeal.status}-${modalRefreshKey}`}
          deal={selectedDeal}
          userRole="cardholder"
          onClose={() => {
            console.log("❌ Deal modal closed");
            setShowDealModal(false);
            setSelectedDeal(null);
          }}
          onSuccess={async () => {
            console.log("✅ Deal action completed");
            
            // Refresh deals
            await fetchDeals();
            
            // Always update the modal with latest deal data
            const token = getAuthToken('cardholder');
            const response = await fetch(`${API_BASE_URL}/api/deals`, {
              headers: {'Authorization': `Bearer ${token}`}
            });
            
            if (response.ok) {
              const data = await response.json();
              const updatedDeal = data.deals?.find(d => d._id === selectedDeal._id);
              
              if (updatedDeal) {
                // Update modal with latest deal data
                console.log("🔄 onSuccess: Updating modal with latest deal data");
                setSelectedDeal(updatedDeal);
                setModalRefreshKey(prev => prev + 1);
                
                // Close modal only for order_placed, cancelled, or expired
                if (['order_placed', 'cancelled', 'expired', 'refunded', 'failed'].includes(updatedDeal.status)) {
                  console.log("🏁 Deal reached final state, closing modal");
                  setTimeout(() => {
                    setShowDealModal(false);
                    setSelectedDeal(null);
                    setAutoOpenedDealId(null);
                  }, 2000); // Small delay to show final screen
                }
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default CardholderDashboard;
