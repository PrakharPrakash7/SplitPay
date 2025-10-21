import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import AddressForm from '../components/AddressForm';
import DealFlowModal from '../components/DealFlowModal';
import { API_BASE_URL } from '../utils/api';
import { getAuthToken, clearAuth } from '../utils/authHelper';

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
  const [showDealModal, setShowDealModal] = useState(false);
  const [modalDeal, setModalDeal] = useState(null);
  const [autoOpenedDealId, setAutoOpenedDealId] = useState(null); // Track auto-opened deal
  const [modalRefreshKey, setModalRefreshKey] = useState(0); // Force modal refresh
  
  // Use refs to access latest state in socket handlers
  const modalDealRef = useRef(modalDeal);
  const showDealModalRef = useRef(showDealModal);
  
  useEffect(() => {
    modalDealRef.current = modalDeal;
    showDealModalRef.current = showDealModal;
  }, [modalDeal, showDealModal]);
  
  // Auto-refresh modal when it's open - poll every 3 seconds
  // BUT: Don't refresh when user is on address form (payment_authorized status)
  useEffect(() => {
    if (!showDealModal || !modalDeal?._id) {
      return;
    }
    
    // Don't auto-refresh if user is filling address form
    if (modalDeal.status === 'payment_authorized') {
      console.log('⏸️ Pausing auto-refresh - user is filling address form');
      return;
    }
    
    console.log('🔄 Starting auto-refresh for modal with deal:', modalDeal._id);
    
    const refreshInterval = setInterval(async () => {
      console.log('⏰ Auto-refreshing modal deal data...');
      try {
        const token = getAuthToken('buyer');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === modalDeal._id);
          
          if (updatedDeal && updatedDeal.status !== modalDeal.status) {
            console.log('✅ Deal status changed:', modalDeal.status, '→', updatedDeal.status);
            setModalDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
            
            // Show notification for order placed
            if (updatedDeal.status === 'order_placed') {
              toast.success('📦 Order has been placed by cardholder!');
            }
          } else if (updatedDeal && JSON.stringify(updatedDeal) !== JSON.stringify(modalDeal)) {
            console.log('✅ Deal data updated');
            setModalDeal(updatedDeal);
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
  }, [showDealModal, modalDeal]);

  const resolveInvoiceUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const sanitized = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE_URL}${sanitized}`;
  };

  const getStatusLabel = (deal) => {
    const labels = {
      pending: 'Finding Cardholder',
      matched: 'Awaiting Payment',
      awaiting_payment: 'Awaiting Payment',
      payment_authorized: 'Provide Shipping Address',
      address_shared: 'Awaiting Order Placement',
      order_placed: 'Order Placed',
      shipped: 'Order Shipped',
      payment_captured: 'Payment Captured',
      disbursed: 'Payout In Progress',
      completed: 'Deal Completed',
      expired: 'Deal Expired',
      cancelled: 'Deal Cancelled',
      refunded: 'Payment Refunded',
      failed: 'Deal Failed'
    };

    return labels[deal.status] || deal.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getStatusTextClass = (status) => {
    if (status === 'pending') return 'text-yellow-600';
    if (['matched', 'awaiting_payment'].includes(status)) return 'text-blue-600';
    if (['payment_authorized', 'address_shared'].includes(status)) return 'text-purple-600';
    if (status === 'order_placed') return 'text-orange-600';
    if (status === 'shipped') return 'text-teal-600';
    if (['payment_captured', 'disbursed', 'completed'].includes(status)) return 'text-green-600';
    if (['expired', 'cancelled', 'refunded', 'failed'].includes(status)) return 'text-red-600';
    return 'text-gray-600';
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

  // Fetch deals from backend
  const fetchDeals = useCallback(async () => {
    try {
      const token = getAuthToken('buyer');
      const response = await fetch(`${API_BASE_URL}/api/deals`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDeals(data.deals || []);
        console.log('✅ Deals refreshed:', data.deals?.length || 0);
        
        // Auto-open modal for active deals that need buyer action
        const activeStatuses = ['pending', 'matched', 'awaiting_payment', 'payment_authorized', 'address_shared', 'disbursed'];
        const activeDeal = data.deals?.find(d => activeStatuses.includes(d.status));
        
        if (activeDeal && activeDeal._id !== autoOpenedDealId) {
          console.log(`🚀 Auto-opening modal for deal ${activeDeal._id} in status: ${activeDeal.status}`);
          setModalDeal(activeDeal);
          setShowDealModal(true);
          setAutoOpenedDealId(activeDeal._id);
        }
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
      const token = getAuthToken('buyer');
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
        await fetchDeals(); // Wait for deals to refresh
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
      const token = getAuthToken('buyer');
      const response = await fetch(`${API_BASE_URL}/api/deals/${dealId}/mark-received`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('✅ Order marked as received! Deal completed.');
        await fetchDeals(); // Wait for deals to refresh
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
      const token = getAuthToken('buyer');
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
    clearAuth('buyer');
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
          const token = getAuthToken('buyer');
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
      const token = getAuthToken('buyer');
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
    const token = getAuthToken('buyer');
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
    socket.on("dealAcceptedByCardholder", async ({ dealId, cardholder, message }) => {
      console.log("🎉 Deal accepted by cardholder:", dealId);
      toast.success(message || "🎉 A cardholder accepted your deal!");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      console.log("🔍 Modal state check - showDealModal:", showDealModalRef.current, "modalDeal._id:", modalDealRef.current?._id);
      if (showDealModalRef.current && modalDealRef.current?._id === dealId) {
        console.log("✅ Modal is open for this deal, fetching updated data...");
        const token = getAuthToken('buyer');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with accepted deal data");
            setModalDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Listen for payment authorized
    socket.on("paymentAuthorized", async ({ dealId, message }) => {
      console.log("💰 Payment authorized:", dealId);
      toast.success(message || "💰 Payment authorized successfully!");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      console.log("🔍 Modal state check - showDealModal:", showDealModalRef.current, "modalDeal._id:", modalDealRef.current?._id);
      if (showDealModalRef.current && modalDealRef.current?._id === dealId) {
        console.log("✅ Modal is open for this deal, fetching updated data...");
        const token = getAuthToken('buyer');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with payment authorized data");
            setModalDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Listen for order submitted by cardholder
    socket.on("orderSubmitted", async ({ dealId, orderId, trackingUrl, invoiceUrl, message }) => {
      console.log("📦 Order submitted:", dealId, orderId);
      console.log("🔗 Tracking URL:", trackingUrl);
      console.log("📄 Invoice URL:", invoiceUrl);
      toast.success(message || "📦 Cardholder placed the order!");
      await fetchDeals(); // Auto-refresh to show tracking and invoice links
      
      // Update modal if it's open for this deal, then close it - use refs for latest state
      console.log("🔍 Modal state check - showDealModal:", showDealModalRef.current, "modalDeal._id:", modalDealRef.current?._id);
      if (showDealModalRef.current && modalDealRef.current?._id === dealId) {
        console.log("✅ Modal is open for this deal, fetching updated data...");
        const token = getAuthToken('buyer');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with order submitted data");
            setModalDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
            // Close modal after showing order placed status
            setTimeout(() => {
              setShowDealModal(false);
              setModalDeal(null);
            }, 2000);
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
      if (showDealModalRef.current && modalDealRef.current?._id === dealId) {
        const token = getAuthToken('buyer');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with shipped data");
            setModalDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Listen for payment captured
    socket.on("paymentCaptured", async ({ dealId, message }) => {
      console.log("✅ Payment captured:", dealId);
      toast.success(message || "✅ Payment has been processed!");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && modalDealRef.current?._id === dealId) {
        const token = getAuthToken('buyer');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with payment captured data");
            setModalDeal(updatedDeal);
            setModalRefreshKey(prev => prev + 1);
          }
        }
      }
    });

    // Listen for deal expired
    socket.on("dealExpired", async ({ dealId, message }) => {
      console.log("⏰ Deal expired:", dealId);
      toast.error(message || "⏰ Deal expired");
      await fetchDeals();
      
      // Close modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && modalDealRef.current?._id === dealId) {
        toast.info("Closing expired deal...");
        setTimeout(() => {
          setShowDealModal(false);
          setModalDeal(null);
          setAutoOpenedDealId(null);
        }, 2000);
      }
    });

    // Listen for deal cancelled
    socket.on("dealCancelled", async ({ dealId, cancelledBy, message }) => {
      console.log("❌ Deal cancelled:", dealId, "by", cancelledBy);
      toast.info(message || "Deal cancelled");
      await fetchDeals();
      
      // Close modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && modalDealRef.current?._id === dealId) {
        setTimeout(() => {
          setShowDealModal(false);
          setModalDeal(null);
          setAutoOpenedDealId(null);
        }, 2000);
      }
    });

    // Listen for deal completed
    socket.on("dealCompleted", async ({ dealId, message }) => {
      console.log("✅ Deal completed:", dealId);
      toast.success(message || "✅ Deal completed!");
      await fetchDeals();
      
      // Update modal if it's open for this deal - use refs for latest state
      if (showDealModalRef.current && modalDealRef.current?._id === dealId) {
        const token = getAuthToken('buyer');
        const response = await fetch(`${API_BASE_URL}/api/deals`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if (response.ok) {
          const data = await response.json();
          const updatedDeal = data.deals?.find(d => d._id === dealId);
          if (updatedDeal) {
            console.log("🔄 Updating modal with completed data");
            setModalDeal(updatedDeal);
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
        {/* Create Deal Button */}
        <div className="mb-8">
          <button
            onClick={() => { setModalDeal(null); setShowDealModal(true); }}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-6 rounded-lg hover:from-blue-700 hover:to-purple-700 shadow-lg text-xl font-bold"
          >
            🛒 Create New Deal
          </button>
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
                    ['matched', 'payment_authorized', 'address_shared', 'order_placed', 'shipped', 'disbursed', 'completed'].includes(deal.status)
                      ? 'border-blue-500 bg-blue-50'
                      : ['expired', 'cancelled', 'refunded', 'failed'].includes(deal.status)
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300'
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
                            <p className="text-green-600">• Your Savings: <span className="font-semibold">₹{deal.buyerDiscount}</span></p>
                            
                          </div>
                        )}
                        <p className="text-sm">
                          Status: <span className={`font-semibold ${
                            deal.status === 'matched' ? 'text-green-600' :
                            deal.status === 'expired' ? 'text-red-600' :
                            deal.status === 'cancelled' ? 'text-red-600' :
                            deal.status === 'refunded' ? 'text-red-600' :
                            deal.status === 'failed' ? 'text-red-600' :
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
                        {deal.status === 'awaiting_payment' && deal.paymentExpiresAt && (
                          <p className="text-sm text-orange-600">
                            ⏰ Complete payment within: <span className="font-semibold">{getTimeRemaining(deal.paymentExpiresAt)}</span>
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
                            <p className="text-sm font-semibold text-blue-600">Bank Offers ({deal.product.bankOffers.length}):</p>
                            <ul className="text-sm text-gray-700 ml-2 space-y-2">
                              {deal.product.bankOffers.map((offer, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="text-blue-500 mr-2">•</span>
                                  <span className="flex-1">{offer.description || `${offer.bank} - ₹${offer.discount} off`}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {deal.status === 'pending' && (
                        <div className="mt-4">
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded mb-2">
                            <p className="text-sm text-yellow-800 text-center">
                              ⏳ Waiting for a cardholder to accept...
                            </p>
                          </div>
                          <button
                            onClick={() => cancelDeal(deal._id, 'Cancelled by buyer while waiting for cardholder')}
                            className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition text-sm"
                          >
                            ❌ Cancel Deal
                          </button>
                        </div>
                      )}

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

                      {deal.status === 'awaiting_payment' && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <p className="text-sm text-yellow-800 text-center mb-3">
                            ⏳ Payment in progress... If Razorpay doesn't load, please cancel and try again.
                          </p>
                          <button
                            onClick={() => initiatePayment(deal)}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition mb-2"
                          >
                            💳 Retry Payment (₹{deal.discountedPrice})
                          </button>
                          <button
                            onClick={() => cancelDeal(deal._id, 'Payment not completed - cancelled by buyer')}
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

                      {deal.status === 'order_placed' && (
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
                                  href={resolveInvoiceUrl(deal.invoiceUrl)} 
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

                      {deal.status === 'cancelled' && (
                        <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                          <p className="text-sm text-red-900 font-semibold mb-2">
                            ❌ Deal Cancelled
                          </p>
                          {deal.cancelledBy && (
                            <p className="text-sm text-red-700">Cancelled by {deal.cancelledBy}</p>
                          )}
                          {deal.cancelReason && (
                            <p className="text-xs text-red-600 mt-1">Reason: {deal.cancelReason}</p>
                          )}
                          {deal.escrowStatus === 'refunded' && (
                            <p className="text-xs text-red-600 mt-2">Refund has been initiated for your payment.</p>
                          )}
                        </div>
                      )}

                      {deal.status === 'expired' && (
                        <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                          <p className="text-sm text-red-900 font-semibold mb-2">
                            ⏰ Deal Expired
                          </p>
                          {deal.cancelReason && (
                            <p className="text-xs text-red-600 mt-1">Reason: {deal.cancelReason}</p>
                          )}
                          {deal.escrowStatus === 'refunded' && (
                            <p className="text-xs text-red-600 mt-2">Any payment hold has been refunded.</p>
                          )}
                        </div>
                      )}

                      {deal.status === 'refunded' && (
                        <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                          <p className="text-sm text-red-900 font-semibold mb-2">
                            💸 Payment Refunded
                          </p>
                          <p className="text-xs text-red-600">Payment has been returned to your source account.</p>
                        </div>
                      )}

                      {deal.status === 'failed' && (
                        <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                          <p className="text-sm text-red-900 font-semibold mb-2">
                            ⚠️ Deal Failed
                          </p>
                          <p className="text-xs text-red-600">Something went wrong during processing. Please review and retry if needed.</p>
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
                                    📦 Track Your Shipment →
                                  </a>
                                </p>
                              )}
                              {deal.invoiceUrl && (
                                <p className="text-center">
                                  <a 
                                    href={resolveInvoiceUrl(deal.invoiceUrl)} 
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
                                    href={resolveInvoiceUrl(deal.invoiceUrl)} 
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
                                    href={resolveInvoiceUrl(deal.invoiceUrl)} 
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

      {/* Deal Flow Modal */}
      {showDealModal && (
        <DealFlowModal
          key={`${modalDeal?._id || 'create'}-${modalDeal?.status}-${modalRefreshKey}`}
          deal={modalDeal}
          mode={modalDeal ? 'view' : 'create'}
          userRole="buyer"
          onClose={() => {
            console.log("❌ Deal modal closed");
            setShowDealModal(false);
            setModalDeal(null);
          }}
          onSuccess={async (createdDeal) => {
            console.log("✅ Deal action completed");
            
            // Refresh deals after any action
            await fetchDeals();
            
            if (createdDeal) {
              // New deal created - set it as modalDeal to show waiting state
              setModalDeal(createdDeal);
              setAutoOpenedDealId(createdDeal._id);
            } else if (modalDeal) {
              // Check updated status of current deal
              const token = getAuthToken('buyer');
              const response = await fetch(`${API_BASE_URL}/api/deals`, {
                headers: {'Authorization': `Bearer ${token}`}
              });
              
              if (response.ok) {
                const data = await response.json();
                const updatedDeal = data.deals?.find(d => d._id === modalDeal._id);
                
                if (updatedDeal) {
                  // Always update modal with latest data
                  console.log("🔄 onSuccess: Updating modal with latest deal data");
                  setModalDeal(updatedDeal);
                  setModalRefreshKey(prev => prev + 1);
                  
                  // Close modal only for order_placed, cancelled, or expired
                  if (['order_placed', 'cancelled', 'expired', 'refunded', 'failed'].includes(updatedDeal.status)) {
                    console.log("🏁 Deal reached final state, closing modal");
                    setTimeout(() => {
                      setShowDealModal(false);
                      setModalDeal(null);
                      setAutoOpenedDealId(null);
                    }, 2000); // Small delay to show final screen
                  }
                }
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default BuyerDashboard;
