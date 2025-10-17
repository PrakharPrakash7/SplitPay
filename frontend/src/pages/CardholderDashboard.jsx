import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import OrderSubmissionForm from "../components/OrderSubmissionForm";
import { API_BASE_URL } from "../utils/api";

const CardholderDashboard = () => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [shippingAddress, setShippingAddress] = useState(null);
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
  const fetchDeals = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/deals`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📊 Fetched deals:", data.deals?.length || 0);
        setDeals(data.deals || []);
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
      const token = localStorage.getItem("token");
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
      const token = localStorage.getItem("token");
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
        fetchDeals();
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
    const token = localStorage.getItem("token");
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
    socket.on("newDeal", (deal) => {
      console.log("🆕 New deal received:", deal);
      toast.success("🆕 New deal available!");
      fetchDeals();
    });

    // Listen for deal accepted by another cardholder
    socket.on("dealAccepted", ({ dealId, message }) => {
      console.log("⚠️ Deal accepted by another cardholder:", dealId);
      toast.info(message || "Deal was accepted by another cardholder");
      fetchDeals();
    });

    // Listen for payment authorization
    socket.on("paymentAuthorized", ({ dealId, message }) => {
      console.log("💰 Payment authorized for deal:", dealId);
      toast.success(message || "💰 Payment authorized! Waiting for address...");
      fetchDeals();
    });

    // Listen for address received - THIS OPENS THE ORDER FORM
    socket.on("addressReceived", ({ dealId, address, product }) => {
      console.log("📍 Address received for deal:", dealId);
      console.log("📦 Product details:", product);
      console.log("🏠 Address:", address);
      
      toast.success("📍 Buyer shared shipping address!");
      
      // Set the deal and address data for the order form
      console.log("🔧 Setting modal state - dealId:", dealId, "hasAddress:", !!address, "hasProduct:", !!product);
      setSelectedDeal({ _id: dealId, product: product || {} });
      setShippingAddress(address);
      setShowOrderForm(true);
      console.log("✅ Modal state set to true");
      
      fetchDeals();
    });

    // Listen for order shipped
    socket.on("orderShipped", ({ dealId, message }) => {
      console.log("🚚 Order shipped:", dealId);
      toast.success(message || "🚚 Order has been shipped!");
      fetchDeals();
    });

    // Listen for payment captured
    socket.on("paymentCaptured", ({ dealId, amount, message }) => {
      console.log("✅ Payment captured:", dealId, amount);
      toast.success(message || "✅ Payment captured!");
      fetchDeals();
    });

    // Listen for payout initiated
    socket.on("payoutInitiated", ({ dealId, amount, message }) => {
      console.log("💸 Payout initiated:", dealId, amount);
      toast.success(message || "💸 Your payout has been initiated!");
      fetchDeals();
    });

    // Listen for deal expired
    socket.on("dealExpired", ({ dealId, message }) => {
      console.log("⏰ Deal expired:", dealId);
      toast.error(message || "⏰ Deal has expired!");
      fetchDeals();
    });

    // Listen for deal cancelled
    socket.on("dealCancelled", ({ dealId, message, cancelledBy }) => {
      console.log("❌ Deal cancelled:", dealId, "by:", cancelledBy);
      toast.info(message || "❌ Deal has been cancelled");
      fetchDeals();
    });

    // Listen for deal completed
    socket.on("dealCompleted", ({ dealId, message }) => {
      console.log("✅ Deal completed:", dealId);
      toast.success(message || "✅ Deal completed! Thank you!");
      fetchDeals();
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
                        <p><span className="font-semibold">Discount:</span> {deal.discountPercentage}%</p>
                        <p><span className="font-semibold">Commission:</span> ₹{deal.commissionForCardholder || 0}</p>
                        <p><span className="font-semibold">Buyer:</span> {deal.buyerId?.name || 'Unknown'}</p>
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
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            deal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            deal.status === 'matched' ? 'bg-blue-100 text-blue-800' :
                            deal.status === 'payment_authorized' ? 'bg-green-100 text-green-800' :
                            deal.status === 'address_shared' ? 'bg-purple-100 text-purple-800' :
                            deal.status === 'order_placed' ? 'bg-orange-100 text-orange-800' :
                            deal.status === 'shipped' ? 'bg-teal-100 text-teal-800' :
                            deal.status === 'disbursed' ? 'bg-purple-100 text-purple-800' :
                            deal.status === 'completed' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {deal.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </p>
                      </div>
                      
                      {deal.status === 'pending' && !isExpired && (
                        <button
                          onClick={() => acceptDeal(deal._id)}
                          disabled={accepting === deal._id}
                          className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          {accepting === deal._id ? '⏳ Accepting...' : '✅ Accept Deal'}
                        </button>
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
                              setShippingAddress(deal.shippingDetails);
                              setShowOrderForm(true);
                              console.log("✅ Order form modal opened manually");
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

      {/* Order Submission Form Modal */}
      {console.log("🔍 Order Form render check - showOrderForm:", showOrderForm, "selectedDeal:", selectedDeal?._id, "hasAddress:", !!shippingAddress)}
      {showOrderForm && selectedDeal && shippingAddress && (
        <OrderSubmissionForm
          dealId={selectedDeal._id}
          product={selectedDeal.product}
          shippingAddress={shippingAddress}
          onClose={() => {
            console.log("❌ Order form closed");
            setShowOrderForm(false);
            setSelectedDeal(null);
            setShippingAddress(null);
          }}
        />
      )}
    </div>
  );
};

export default CardholderDashboard;
