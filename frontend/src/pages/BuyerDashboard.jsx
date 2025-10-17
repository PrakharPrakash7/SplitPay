import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import AddressForm from '../components/AddressForm';
import { API_BASE_URL } from '../utils/api';

const BuyerDashboard = () => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productUrl, setProductUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [paymentModal, setPaymentModal] = useState({ show: false, deal: null });

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

  // Fetch deals from backend
  const fetchDeals = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/deals`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDeals(data.deals || []);
        console.log('✅ Deals refreshed:', data.deals?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Cancel deal function
  const cancelDeal = async (dealId, reason = 'Cancelled by buyer') => {
    if (!confirm('Are you sure you want to cancel this deal? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/payment/cancel-deal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ dealId, reason })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.refunded ? '❌ Deal cancelled and payment refunded' : '❌ Deal cancelled');
        fetchDeals();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to cancel deal');
      }
    } catch (error) {
      console.error('Error cancelling deal:', error);
      toast.error('Unable to cancel deal');
    }
  };

  // Mark order as received
  const markAsReceived = async (dealId) => {
    if (!confirm('Have you received your order? This will mark the deal as completed.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/deals/${dealId}/mark-received`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('✅ Order marked as received! Deal completed.');
        fetchDeals();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to mark as received');
      }
    } catch (error) {
      console.error('Error marking as received:', error);
      toast.error('Unable to mark as received');
    }
  };

  // Create new deal
  const handleCreateDeal = async (e) => {
    e.preventDefault();
    
    if (!productUrl.trim()) {
      toast.error('Please enter a product URL');
      return;
    }

    setCreating(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/deals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          productUrl: productUrl.trim(),
          discountPct: 10 
        })
      });

      if (response.ok) {
        toast.success('Deal created successfully! 🎉');
        setProductUrl('');
        fetchDeals(); // Refresh deals list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create deal');
      }
    } catch (error) {
      console.error('Error creating deal:', error);
      toast.error('Failed to create deal');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
  };

  // Razorpay Payment Function
  const handlePayment = (dealData) => {
    const { deal, order } = dealData;
    
    const options = {
      key: order.razorpayKeyId || "rzp_test_RBdZZFe44Lnw5j",
      amount: order.order.amount, // Amount in paise from backend
      currency: order.order.currency || "INR",
      order_id: order.order.id, // Razorpay order ID
      name: "SplitPay",
      description: `Payment for ${deal.product?.title || 'Product'}`,
      handler: async function (response) {
        console.log("💳 Payment successful:", response);
        
        try {
          const token = localStorage.getItem("token");
          const verifyResponse = await fetch(`${API_BASE_URL}/api/payment/verify-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              dealId: deal._id
            })
          });

          if (verifyResponse.ok) {
            toast.success("💰 Payment successful! Funds held in escrow.");
            setPaymentModal({ show: false, deal: null });
            
            // Refresh deals to show updated status
            await fetchDeals();
            
            // Open address form automatically after a short delay
            setTimeout(() => {
              console.log("📍 Opening address form for deal:", deal._id);
              setSelectedDeal(deal);
              setShowAddressForm(true);
            }, 1500);
          } else {
            const errorData = await verifyResponse.json();
            console.error("Verification failed:", errorData);
            toast.error(errorData.error || "Payment verification failed");
          }
        } catch (error) {
          console.error("Payment verification error:", error);
          toast.error("Something went wrong with payment verification");
        }
      },
      modal: {
        ondismiss: function() {
          console.log("Payment cancelled");
          setPaymentModal({ show: false, deal: null });
          toast.info("Payment cancelled");
        }
      },
      prefill: {
        name: "Buyer",
        email: "buyer@example.com"
      },
      theme: {
        color: "#3399cc"
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  // Initiate payment
  const initiatePayment = async (deal) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ dealId: deal._id })
      });

      if (response.ok) {
        const orderData = await response.json();
        console.log("📦 Order created:", orderData);
        handlePayment({ deal, order: orderData });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to create payment order");
      }
    } catch (error) {
      console.error("Payment initiation error:", error);
      toast.error("Unable to process payment");
    }
  };

  // Socket.io setup
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    console.log("🔌 Connecting to Socket.io...");
    
    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      console.log("✅ Socket.io connected:", socket.id);
      socket.emit("joinBuyers");
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
    });

    // Listen for deal accepted
    socket.on("dealAcceptedByCardholder", ({ dealId, cardholder, message }) => {
      console.log("🎉 Deal accepted by cardholder:", dealId);
      toast.success(message || "🎉 A cardholder accepted your deal!");
      fetchDeals();
    });

    // Listen for payment authorized
    socket.on("paymentAuthorized", ({ dealId, message }) => {
      console.log("💰 Payment authorized:", dealId);
      toast.success(message || "💰 Payment authorized successfully!");
      fetchDeals();
    });

    // Listen for order submitted by cardholder
    socket.on("orderSubmitted", ({ dealId, orderId, trackingUrl, invoiceUrl, message }) => {
      console.log("📦 Order submitted:", dealId, orderId);
      console.log("🔗 Tracking URL:", trackingUrl);
      console.log("📄 Invoice URL:", invoiceUrl);
      toast.success(message || "📦 Cardholder placed the order!");
      fetchDeals(); // Auto-refresh to show tracking and invoice links
    });

    // Listen for order shipped
    socket.on("orderShipped", ({ dealId, message }) => {
      console.log("🚚 Order shipped:", dealId);
      toast.success(message || "🚚 Order has been shipped!");
      fetchDeals();
    });

    // Listen for payment captured
    socket.on("paymentCaptured", ({ dealId, message }) => {
      console.log("✅ Payment captured:", dealId);
      toast.success(message || "✅ Payment has been processed!");
      fetchDeals();
    });

    // Listen for deal expired
    socket.on("dealExpired", ({ dealId, message }) => {
      console.log("⏰ Deal expired:", dealId);
      toast.error(message || "⏰ Deal expired");
      fetchDeals();
    });

    // Listen for deal cancelled
    socket.on("dealCancelled", ({ dealId, cancelledBy, message }) => {
      console.log("❌ Deal cancelled:", dealId, "by", cancelledBy);
      toast.info(message || "Deal cancelled");
      fetchDeals();
    });

    // Listen for deal completed
    socket.on("dealCompleted", ({ dealId, message }) => {
      console.log("✅ Deal completed:", dealId);
      toast.success(message || "✅ Deal completed!");
      fetchDeals();
    });

    // Fetch initial deals
    fetchDeals();

    // Cleanup
    return () => {
      console.log("🔌 Disconnecting Socket.io");
      socket.disconnect();
      document.body.removeChild(script);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">🛒 Buyer Dashboard</h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/buyer-profile")}
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
        {/* Create Deal Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Create New Deal</h2>
          <form onSubmit={handleCreateDeal} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product URL (Flipkart or Amazon)
              </label>
              <input
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://www.flipkart.com/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={creating}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating Deal...' : 'Create Deal (10% discount)'}
            </button>
          </form>
        </div>

        {/* Deals List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Your Deals</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading deals...</p>
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No deals yet. Create your first deal above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deals.map((deal) => (
                <div 
                  key={deal._id} 
                  className={`border rounded-lg p-4 ${
                    deal.status === 'matched' ? 'border-green-500 bg-green-50' :
                    deal.status === 'expired' ? 'border-red-500 bg-red-50' :
                    'border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {deal.product?.image && (
                      <img 
                        src={deal.product.image} 
                        alt={deal.product.title}
                        className="w-24 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{deal.product?.title}</h3>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-600">
                          Original Price: <span className="font-semibold">₹{deal.product?.price}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Discounted Price: <span className="font-semibold text-green-600">₹{deal.discountedPrice}</span>
                        </p>
                        {deal.totalBankDiscount > 0 && (
                          <div className="text-xs text-gray-500 mt-2 border-t pt-2">
                            <p className="font-semibold text-gray-700 mb-1">💳 Discount Breakdown:</p>
                            <p>• Total Bank Discount: <span className="font-semibold">₹{deal.totalBankDiscount}</span></p>
                            <p className="text-green-600">• Your Savings (70%): <span className="font-semibold">₹{deal.buyerDiscount}</span></p>
                            <p className="text-blue-600">• Cardholder Commission (20%): <span className="font-semibold">₹{deal.cardholderCommission}</span></p>
                            <p className="text-purple-600">• Platform Fee (10%): <span className="font-semibold">₹{deal.platformFee}</span></p>
                          </div>
                        )}
                        <p className="text-sm">
                          Status: <span className={`font-semibold ${
                            deal.status === 'matched' ? 'text-green-600' :
                            deal.status === 'expired' ? 'text-red-600' :
                            deal.status === 'pending' ? 'text-yellow-600' :
                            deal.status === 'payment_authorized' ? 'text-green-600' :
                            deal.status === 'address_shared' ? 'text-purple-600' :
                            deal.status === 'order_placed' ? 'text-orange-600' :
                            deal.status === 'shipped' ? 'text-teal-600' :
                            deal.status === 'disbursed' ? 'text-purple-600' :
                            deal.status === 'completed' ? 'text-green-600' :
                            'text-gray-600'
                          }`}>
                            {deal.status.toUpperCase()}
                          </span>
                        </p>
                        {deal.status === 'pending' && (
                          <p className="text-sm text-orange-600">
                            ⏰ Expires in: <span className="font-semibold">{getTimeRemaining(deal.expiresAt)}</span>
                          </p>
                        )}
                        {deal.status === 'matched' && deal.paymentExpiresAt && (
                          <p className="text-sm text-orange-600">
                            ⏰ Pay within: <span className="font-semibold">{getTimeRemaining(deal.paymentExpiresAt)}</span>
                          </p>
                        )}
                        {deal.status === 'payment_authorized' && deal.addressExpiresAt && (
                          <p className="text-sm text-orange-600">
                            ⏰ Share address within: <span className="font-semibold">{getTimeRemaining(deal.addressExpiresAt)}</span>
                          </p>
                        )}
                        {deal.status === 'address_shared' && deal.orderExpiresAt && (
                          <p className="text-sm text-orange-600">
                            ⏰ Cardholder must submit within: <span className="font-semibold">{getTimeRemaining(deal.orderExpiresAt)}</span>
                          </p>
                        )}
                        {deal.product?.bankOffers && deal.product.bankOffers.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-semibold text-blue-600">Bank Offers:</p>
                            <ul className="text-sm text-gray-600 ml-4">
                              {deal.product.bankOffers.map((offer, idx) => (
                                <li key={idx}>
                                  {offer.bank}: {offer.discount && `₹${offer.discount} off`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {deal.status === 'matched' && (
                        <div className="mt-4 space-y-2">
                          <button
                            onClick={() => initiatePayment(deal)}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition"
                          >
                            💳 Pay Now (₹{deal.totalAmount})
                          </button>
                          <button
                            onClick={() => cancelDeal(deal._id, 'Cancelled by buyer before payment')}
                            className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition text-sm"
                          >
                            ❌ Cancel Deal
                          </button>
                        </div>
                      )}

                      {deal.status === 'payment_authorized' && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                          <p className="text-sm text-green-800 text-center">
                            💰 Payment successful! Share your address.
                          </p>
                          <button
                            onClick={() => {
                              console.log("🖱️ Share Address button clicked for deal:", deal._id);
                              console.log("📦 Deal object:", deal);
                              setSelectedDeal(deal);
                              setShowAddressForm(true);
                              console.log("✅ Modal state set to true");
                            }}
                            className="w-full mt-2 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                          >
                            📍 Share Address
                          </button>
                          <button
                            onClick={() => cancelDeal(deal._id, 'Cancelled by buyer after payment - refund will be processed')}
                            className="w-full mt-2 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 text-sm"
                          >
                            ❌ Cancel Deal (Refund)
                          </button>
                        </div>
                      )}

                      {deal.status === 'address_shared' && (
                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                          <p className="text-sm text-purple-800 text-center">
                            📍 Address shared! Waiting for cardholder to place order...
                          </p>
                          <button
                            onClick={() => cancelDeal(deal._id, 'Cancelled by buyer after address shared - refund will be processed')}
                            className="w-full mt-2 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 text-sm"
                          >
                            ❌ Cancel Deal (Refund)
                          </button>
                        </div>
                      )}

                      {deal.status === 'order_placed' && deal.orderIdFromCardholder && (
                        <div className="mt-4 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                          <p className="text-sm text-orange-900 font-semibold mb-2">
                            📦 Order Details:
                          </p>
                          <div className="space-y-2 text-sm">
                            <p className="text-orange-800">
                              <span className="font-semibold">Order ID:</span> {deal.orderIdFromCardholder}
                            </p>
                            {deal.trackingUrl && (
                              <p>
                                <a 
                                  href={deal.trackingUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                >
                                  🔗 Track Your Order →
                                </a>
                              </p>
                            )}
                            {deal.invoiceUrl && (
                              <p>
                                <a 
                                  href={deal.invoiceUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                >
                                  � View Invoice/Order Details →
                                </a>
                              </p>
                            )}
                          </div>
                          <p className="text-sm text-orange-600 mt-3 font-medium">
                            ⏳ Waiting for shipping confirmation...
                          </p>
                        </div>
                      )}

                      {deal.status === 'shipped' && (
                        <div className="mt-4 p-4 bg-teal-50 border-2 border-teal-300 rounded-lg">
                          <p className="text-sm text-teal-900 font-semibold mb-2 text-center">
                            🚚 Order Shipped!
                          </p>
                          {(deal.trackingUrl || deal.invoiceUrl) && (
                            <div className="space-y-2 text-sm mb-3">
                              {deal.trackingUrl && (
                                <p className="text-center">
                                  <a 
                                    href={deal.trackingUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                  >
                                    � Track Your Shipment →
                                  </a>
                                </p>
                              )}
                              {deal.invoiceUrl && (
                                <p className="text-center">
                                  <a 
                                    href={deal.invoiceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                  >
                                    📄 View Invoice →
                                  </a>
                                </p>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-teal-700 text-center">
                            Payment will be processed soon.
                          </p>
                        </div>
                      )}

                      {deal.status === 'disbursed' && (
                        <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
                          
                          {(deal.trackingUrl || deal.invoiceUrl) && (
                            <div className="space-y-2 text-sm mb-3">
                              {deal.trackingUrl && (
                                <p className="text-center">
                                  <a 
                                    href={deal.trackingUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                  >
                                    📦 Track Your Shipment →
                                  </a>
                                </p>
                              )}
                              {deal.invoiceUrl && (
                                <p className="text-center">
                                  <a 
                                    href={deal.invoiceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                  >
                                    📄 View Invoice →
                                  </a>
                                </p>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-purple-700 text-center mb-3">
                          Mark as received once you get your order.
                          </p>
                          <button
                            onClick={() => markAsReceived(deal._id)}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition font-semibold"
                          >
                            ✅ Mark as Received
                          </button>
                        </div>
                      )}

                      {deal.status === 'completed' && (
                        <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                          <p className="text-sm text-green-900 font-semibold mb-2 text-center">
                            ✅ Order Completed!
                          </p>
                          {(deal.trackingUrl || deal.invoiceUrl) && (
                            <div className="space-y-2 text-sm mb-3">
                              {deal.trackingUrl && (
                                <p className="text-center">
                                  <a 
                                    href={deal.trackingUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                  >
                                    📦 View Tracking →
                                  </a>
                                </p>
                              )}
                              {deal.invoiceUrl && (
                                <p className="text-center">
                                  <a 
                                    href={deal.invoiceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                  >
                                    📄 View Invoice →
                                  </a>
                                </p>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-green-800 text-center font-medium">
                            🎉 Thank you for using SplitPay! Enjoy your purchase!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Address Form Modal */}
      {console.log("🔍 Modal render check - showAddressForm:", showAddressForm, "selectedDeal:", selectedDeal?._id)}
      {showAddressForm && selectedDeal && (
        <AddressForm
          dealId={selectedDeal._id}
          onSuccess={() => {
            console.log("✅ Address shared successfully");
            setShowAddressForm(false);
            setSelectedDeal(null);
            toast.success("📍 Address shared successfully!");
            fetchDeals();
          }}
          onClose={() => {
            console.log("❌ Address modal closed");
            setShowAddressForm(false);
            setSelectedDeal(null);
          }}
        />
      )}
    </div>
  );
};

export default BuyerDashboard;
