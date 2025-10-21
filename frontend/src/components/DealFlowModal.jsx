import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../utils/api';
import { getAuthToken } from '../utils/authHelper';

const DealFlowModal = ({ deal, onClose, onSuccess, userRole, mode = 'view' }) => {
  // State for creating new deal (Buyer)
  const [productUrl, setProductUrl] = useState('');
  const [creatingDeal, setCreatingDeal] = useState(false);
  
  // Log when deal prop changes
  useEffect(() => {
    console.log('🔄 DealFlowModal: deal prop changed', {
      dealId: deal?._id,
      status: deal?.status,
      hasShippingDetails: !!deal?.shippingDetails,
      userRole
    });
  }, [deal, userRole]);
  
  // State for payment (Buyer)
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // State for address (Buyer)
  const [shippingDetails, setShippingDetails] = useState({
    name: '',
    mobile: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: ''
  });
  const [submittingAddress, setSubmittingAddress] = useState(false);
  
  // State for order submission (Cardholder)
  const [orderId, setOrderId] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  
  // State for cancellation
  const [cancelling, setCancelling] = useState(false);

  // Determine current step based on deal status and user role
  function getCurrentStep() {
    if (mode === 'create') return 'create_deal';
    if (!deal) return 'create_deal';
    
    if (userRole === 'buyer') {
      if (deal.status === 'pending') return 'waiting_cardholder';
      if (deal.status === 'matched') return 'make_payment';
      if (deal.status === 'payment_authorized') return 'provide_address';
      if (deal.status === 'address_shared') return 'waiting_order';
      if (deal.status === 'order_placed') return 'order_tracking';
      if (deal.status === 'shipped') return 'delivery_tracking';
      if (deal.status === 'disbursed') return 'mark_received';
      if (deal.status === 'completed') return 'completed';
    }
    
    if (userRole === 'cardholder') {
      if (deal.status === 'pending') return 'accept_deal';
      if (deal.status === 'matched') return 'waiting_payment';
      if (deal.status === 'payment_authorized') return 'waiting_address';
      if (deal.status === 'address_shared') return 'submit_order';
      if (deal.status === 'order_placed') return 'waiting_delivery';
      if (deal.status === 'shipped') return 'waiting_confirmation';
      if (deal.status === 'disbursed') return 'payment_received';
      if (deal.status === 'completed') return 'completed';
    }
    
    return 'view';
  }

  const currentStep = getCurrentStep();

  // Handler: Create Deal (Buyer)
  const handleCreateDeal = async () => {
    if (!productUrl.trim()) {
      toast.error('Please enter product URL');
      return;
    }

    setCreatingDeal(true);
    try {
      const token = getAuthToken(userRole);
      
      if (!token) {
        toast.error('❌ Authentication required. Please login again.');
        console.error('No token found for role:', userRole);
        return;
      }

      console.log('🔑 Creating deal with token:', token ? `${token.substring(0, 20)}...` : 'missing');
      console.log('📦 Product URL:', productUrl);

      const response = await fetch(`${API_BASE_URL}/api/deals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productUrl })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('✅ Deal created successfully!');
        if (onSuccess) onSuccess(data.deal);
        // Don't close modal - keep it open to show waiting state
      } else {
        const error = await response.json();
        console.error('❌ Deal creation failed:', error);
        toast.error(error.error || error.message || 'Failed to create deal');
      }
    } catch (error) {
      console.error('Error creating deal:', error);
      toast.error('Unable to create deal. Please try again.');
    } finally {
      setCreatingDeal(false);
    }
  };

  // Handler: Accept Deal (Cardholder)
  const handleAcceptDeal = async () => {
    try {
      const token = getAuthToken(userRole);
      const response = await fetch(`${API_BASE_URL}/api/deals/${deal._id}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('✅ Deal accepted! Waiting for buyer payment...');
        if (onSuccess) onSuccess();
        // Keep modal open
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to accept deal');
      }
    } catch (error) {
      console.error('Error accepting deal:', error);
      toast.error('Unable to accept deal');
    }
  };

  // Handler: Initiate Payment (Buyer)
  const handleInitiatePayment = async () => {
    setProcessingPayment(true);
    try {
      const token = getAuthToken(userRole);
      
      // Create Razorpay order
      const response = await fetch(`${API_BASE_URL}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dealId: deal._id })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create payment order');
        setProcessingPayment(false);
        return;
      }

      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: data.razorpayKeyId,
          amount: data.order.amount,
          currency: data.order.currency,
          name: 'SplitPay',
          description: deal.product?.title || 'Product Purchase',
          order_id: data.order.id,
          handler: async function (response) {
            // Verify payment
            const verifyResponse = await fetch(`${API_BASE_URL}/api/payment/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                dealId: deal._id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (verifyResponse.ok) {
              toast.success('💰 Payment successful!');
              if (onSuccess) onSuccess();
              // Keep modal open to show next step
            } else {
              toast.error('Payment verification failed');
            }
            setProcessingPayment(false);
          },
          prefill: {
            name: 'Buyer',
            email: 'buyer@example.com'
          },
          theme: {
            color: '#3B82F6'
          },
          modal: {
            ondismiss: function() {
              setProcessingPayment(false);
              toast.error('Payment cancelled');
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      };
    } catch (error) {
      console.error('Error initiating payment:', error);
      toast.error('Unable to initiate payment');
      setProcessingPayment(false);
    }
  };

  // Handler: Submit Address (Buyer)
  const handleSubmitAddress = async () => {
    if (!shippingDetails.name || !shippingDetails.mobile || !shippingDetails.addressLine1 || 
        !shippingDetails.city || !shippingDetails.state || !shippingDetails.pincode) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmittingAddress(true);
    try {
      const token = getAuthToken(userRole);
      const response = await fetch(`${API_BASE_URL}/api/payment/share-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dealId: deal._id,
          shippingDetails
        })
      });

      if (response.ok) {
        toast.success('📍 Address shared successfully!');
        if (onSuccess) onSuccess();
        // Keep modal open
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to share address');
      }
    } catch (error) {
      console.error('Error sharing address:', error);
      toast.error('Unable to share address');
    } finally {
      setSubmittingAddress(false);
    }
  };

  // Handler: Submit Order (Cardholder)
  const handleSubmitOrder = async () => {
    if (!orderId.trim()) {
      toast.error('Please enter Order/Product ID');
      return;
    }

    if (!trackingUrl.trim()) {
      toast.error('Please enter tracking URL');
      return;
    }

    if (!invoiceFile) {
      toast.error('Please upload invoice PDF file');
      return;
    }

    if (invoiceFile.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed for invoice');
      return;
    }

    setSubmittingOrder(true);
    try {
      const token = getAuthToken(userRole);
      
      // First, upload the invoice PDF
      const formData = new FormData();
      formData.append('invoice', invoiceFile);
      
      const uploadRes = await fetch(`${API_BASE_URL}/api/deals/${deal._id}/upload-invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        toast.error(error.error || 'Failed to upload invoice');
        setSubmittingOrder(false);
        return;
      }

      const { invoiceUrl } = await uploadRes.json();

      // Then submit order details
      const res = await fetch(`${API_BASE_URL}/api/payment/submit-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dealId: deal._id,
          orderId: orderId.trim(),
          trackingUrl: trackingUrl.trim(),
          invoiceUrl: invoiceUrl
        })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('✅ Order details submitted successfully!');
        if (onSuccess) onSuccess();
        // Keep modal open to show completion
      } else {
        toast.error(data.error || 'Failed to submit order details');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Unable to submit order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Handler: Mark as Received (Buyer)
  const handleMarkReceived = async () => {
    try {
      const token = getAuthToken(userRole);
      const response = await fetch(`${API_BASE_URL}/api/deals/${deal._id}/mark-received`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('✅ Order marked as received!');
        if (onSuccess) onSuccess();
        // Can close modal now
        setTimeout(() => onClose(), 2000);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to mark as received');
      }
    } catch (error) {
      console.error('Error marking as received:', error);
      toast.error('Unable to mark as received');
    }
  };

  // Handler: Cancel Deal
  const handleCancelDeal = async (reason) => {
    if (!confirm('Are you sure you want to cancel this deal? This action cannot be undone.')) {
      return;
    }

    setCancelling(true);
    try {
      const token = getAuthToken(userRole);
      const response = await fetch(`${API_BASE_URL}/api/payment/cancel-deal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          dealId: deal._id, 
          reason: reason || `Cancelled by ${userRole}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.refunded ? '❌ Deal cancelled and payment refunded' : '❌ Deal cancelled');
        if (onSuccess) onSuccess();
        setTimeout(() => onClose(), 1500);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to cancel deal');
      }
    } catch (error) {
      console.error('Error cancelling deal:', error);
      toast.error('Unable to cancel deal');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold">
            {currentStep === 'create_deal' && '🛒 Create New Deal'}
            {currentStep === 'waiting_cardholder' && '⏳ Waiting for Cardholder'}
            {currentStep === 'accept_deal' && '💼 New Deal Available'}
            {currentStep === 'make_payment' && '💳 Payment Required'}
            {currentStep === 'waiting_payment' && '⏳ Waiting for Payment'}
            {currentStep === 'provide_address' && '📍 Shipping Address'}
            {currentStep === 'waiting_address' && '⏳ Waiting for Address'}
            {currentStep === 'submit_order' && '📦 Submit Order Details'}
            {currentStep === 'waiting_order' && '⏳ Waiting for Order'}
            {currentStep === 'order_tracking' && '📦 Order Placed'}
            {currentStep === 'delivery_tracking' && '🚚 Out for Delivery'}
            {currentStep === 'waiting_delivery' && '🚚 Order in Transit'}
            {currentStep === 'mark_received' && '✅ Confirm Receipt'}
            {currentStep === 'waiting_confirmation' && '✅ Awaiting Confirmation'}
            {currentStep === 'payment_received' && '💰 Payment Received'}
            {currentStep === 'completed' && '🎉 Deal Completed'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* STEP: Create Deal (Buyer) */}
          {currentStep === 'create_deal' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">🛒</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Create a New Deal</h3>
                <p className="text-gray-600">Paste the product URL from any e-commerce site</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  placeholder="https://www.amazon.in/product/..."
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  📦 Supports Amazon, Flipkart, and other major e-commerce sites
                </p>
              </div>

              <button
                onClick={handleCreateDeal}
                disabled={creatingDeal}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
              >
                {creatingDeal ? '⏳ Creating Deal...' : '✨ Create Deal & Find Cardholder'}
              </button>
            </div>
          )}

          {/* Product Information - Show for all steps except create */}
          {deal && currentStep !== 'create_deal' && (
            <div className="mb-6 border-2 border-gray-200 rounded-lg p-4 bg-gradient-to-r from-gray-50 to-blue-50">
              <div className="flex gap-4">
                {deal.product?.image && (
                  <img
                    src={deal.product.image}
                    alt={deal.product.title}
                    className="w-32 h-32 object-cover rounded-lg shadow-md"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-3">{deal.product?.title}</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-700">
                      Original Price: <span className="font-bold text-lg">₹{deal.product?.price}</span>
                    </p>
                    <p className="text-gray-700">
                      Your Price: <span className="font-bold text-green-600 text-lg">₹{deal.discountedPrice}</span>
                    </p>
                    {deal.totalBankDiscount > 0 && (
                      <div className="text-xs bg-white rounded p-3 mt-2">
                        <p className="font-semibold text-gray-800 mb-2">💳 Discount Breakdown:</p>
                        <div className="space-y-1">
                          <p>• Total Bank Discount: <span className="font-bold">₹{deal.totalBankDiscount}</span></p>
                          {userRole === 'buyer' && (
                            <p className="text-green-700">• Your Savings (80%): <span className="font-bold">₹{deal.buyerDiscount}</span></p>
                          )}
                          {userRole === 'cardholder' && (
                            <p className="text-blue-700">• Your Commission (15%): <span className="font-bold">₹{deal.cardholderCommission}</span></p>
                          )}
                          <p className="text-purple-700">• Platform Fee (5%): <span className="font-bold">₹{deal.platformFee}</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Badge */}
          {deal && (
            <div className="mb-6 text-center">
              <span className={`inline-block px-6 py-3 rounded-full text-sm font-bold shadow-md ${
                deal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                deal.status === 'matched' ? 'bg-blue-100 text-blue-800' :
                deal.status === 'payment_authorized' ? 'bg-green-100 text-green-800' :
                deal.status === 'address_shared' ? 'bg-purple-100 text-purple-800' :
                deal.status === 'order_placed' ? 'bg-orange-100 text-orange-800' :
                deal.status === 'shipped' ? 'bg-teal-100 text-teal-800' :
                deal.status === 'disbursed' ? 'bg-indigo-100 text-indigo-800' :
                deal.status === 'completed' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                Status: {deal.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
          )}

          {/* STEP: Accept Deal (Cardholder) */}
          {currentStep === 'accept_deal' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">💼</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Accept this Deal?</h3>
                <p className="text-gray-600">You'll earn ₹{deal.cardholderCommission} commission</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleAcceptDeal}
                  className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 font-bold text-lg shadow-lg"
                >
                  ✅ Accept Deal & Continue
                </button>
                
                <button
                  onClick={() => handleCancelDeal('Declined by cardholder - deal not accepted')}
                  disabled={cancelling}
                  className="w-full bg-red-500 text-white py-3 px-6 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold text-sm"
                >
                  {cancelling ? '⏳ Cancelling...' : '❌ Decline Deal'}
                </button>
              </div>
            </div>
          )}

          {/* STEP: Make Payment (Buyer) */}
          {currentStep === 'make_payment' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center">
                <div className="text-6xl mb-4">💳</div>
                <h3 className="text-2xl font-bold text-blue-900 mb-2">Payment Required</h3>
                <p className="text-blue-700 mb-4">A cardholder has accepted your deal!</p>
                <p className="text-3xl font-bold text-green-600 mb-2">₹{deal.discountedPrice}</p>
                <p className="text-sm text-gray-600">Your payment will be held in escrow until delivery</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleInitiatePayment}
                  disabled={processingPayment}
                  className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold text-lg shadow-lg"
                >
                  {processingPayment ? '⏳ Processing...' : '💰 Pay Now via Razorpay'}
                </button>
                
                <button
                  onClick={() => handleCancelDeal('Cancelled by buyer before payment')}
                  disabled={cancelling || processingPayment}
                  className="w-full bg-red-500 text-white py-3 px-6 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold text-sm"
                >
                  {cancelling ? '⏳ Cancelling...' : '❌ Cancel Deal'}
                </button>
              </div>
            </div>
          )}

          {/* STEP: Provide Address (Buyer) */}
          {currentStep === 'provide_address' && (
            <div className="space-y-4">
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4 text-center">
                <p className="text-green-800 font-semibold">
                  💰 Payment Successful! Now provide shipping address
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shippingDetails.name}
                    onChange={(e) => setShippingDetails({...shippingDetails, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={shippingDetails.mobile}
                    onChange={(e) => setShippingDetails({...shippingDetails, mobile: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shippingDetails.addressLine1}
                    onChange={(e) => setShippingDetails({...shippingDetails, addressLine1: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    value={shippingDetails.addressLine2}
                    onChange={(e) => setShippingDetails({...shippingDetails, addressLine2: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shippingDetails.city}
                    onChange={(e) => setShippingDetails({...shippingDetails, city: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shippingDetails.state}
                    onChange={(e) => setShippingDetails({...shippingDetails, state: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shippingDetails.pincode}
                    onChange={(e) => setShippingDetails({...shippingDetails, pincode: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={shippingDetails.landmark}
                    onChange={(e) => setShippingDetails({...shippingDetails, landmark: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <button
                  onClick={handleSubmitAddress}
                  disabled={submittingAddress}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-bold text-lg shadow-lg"
                >
                  {submittingAddress ? '⏳ Submitting...' : '📍 Share Address & Continue'}
                </button>
                
                <button
                  onClick={() => handleCancelDeal('Cancelled by buyer after payment - refund will be processed')}
                  disabled={cancelling || submittingAddress}
                  className="w-full bg-red-500 text-white py-2 px-6 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold text-sm"
                >
                  {cancelling ? '⏳ Cancelling...' : '❌ Cancel Deal (Refund)'}
                </button>
              </div>
            </div>
          )}

          {/* STEP: Submit Order (Cardholder) */}
          {currentStep === 'submit_order' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-purple-800 font-semibold text-center">
                  📍 Address Received! Place the order and provide details
                </p>
              </div>

              {/* Shipping Address Display */}
              {deal.shippingDetails && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 border-2 border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-3 text-lg">📍 Shipping Address:</h4>
                  <div className="text-sm text-gray-700 space-y-1 bg-white p-3 rounded">
                    <p className="font-semibold text-base">{deal.shippingDetails.name}</p>
                    <p>{deal.shippingDetails.mobile}</p>
                    <p>{deal.shippingDetails.addressLine1}</p>
                    {deal.shippingDetails.addressLine2 && <p>{deal.shippingDetails.addressLine2}</p>}
                    <p>{deal.shippingDetails.city}, {deal.shippingDetails.state} - {deal.shippingDetails.pincode}</p>
                    {deal.shippingDetails.landmark && <p>Landmark: {deal.shippingDetails.landmark}</p>}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order ID / Product ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., #ORD123456 or Product-ABC-XYZ"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  📦 Enter the order ID or product ID from the e-commerce site
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="https://www.flipkart.com/track/order/123456"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  🔗 Link to track the shipment status
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice PDF File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setInvoiceFile(e.target.files[0])}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  📄 Upload the invoice PDF file (max 5MB)
                </p>
                {invoiceFile && (
                  <p className="text-sm text-green-600 mt-2 bg-green-50 p-2 rounded">
                    ✓ Selected: {invoiceFile.name} ({(invoiceFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={submittingOrder}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 font-bold text-lg shadow-lg"
              >
                {submittingOrder ? '⏳ Submitting...' : '📤 Submit Order Details & Complete'}
              </button>
            </div>
          )}

          {/* STEP: Mark Received (Buyer) */}
          {currentStep === 'mark_received' && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-6 text-center">
                <div className="text-6xl mb-4">💸</div>
                <h3 className="text-2xl font-bold text-indigo-900 mb-2">Payment Disbursed!</h3>
                <p className="text-indigo-700 mb-4">Did you receive the product?</p>
              </div>

              {deal.trackingUrl && (
                <a
                  href={deal.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-blue-100 text-blue-700 py-3 px-4 rounded-lg hover:bg-blue-200 font-semibold"
                >
                  🔗 Track Your Order
                </a>
              )}

              <button
                onClick={handleMarkReceived}
                className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 font-bold text-lg shadow-lg"
              >
                ✅ Yes, I Received the Product
              </button>
            </div>
          )}

          {/* Waiting States */}
          {currentStep === 'waiting_cardholder' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">⏳</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Looking for a Cardholder...</h3>
              <p className="text-gray-600 text-lg mb-6">Your deal is live! Waiting for someone to accept it.</p>
              <div className="mt-6 mb-8">
                <div className="animate-pulse inline-block bg-blue-100 text-blue-800 px-6 py-3 rounded-full font-semibold">
                  🔍 Searching...
                </div>
              </div>
              
              <button
                onClick={() => handleCancelDeal('Cancelled by buyer while waiting for cardholder')}
                disabled={cancelling}
                className="bg-red-500 text-white py-2 px-6 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
              >
                {cancelling ? '⏳ Cancelling...' : '❌ Cancel Deal'}
              </button>
            </div>
          )}

          {currentStep === 'waiting_payment' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">💳</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Waiting for Buyer Payment</h3>
              <p className="text-gray-600 text-lg mb-6">The buyer will make the payment soon</p>
              
              <button
                onClick={() => handleCancelDeal('Cancelled by cardholder before payment')}
                disabled={cancelling}
                className="bg-red-500 text-white py-2 px-6 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
              >
                {cancelling ? '⏳ Cancelling...' : '❌ Cancel Deal'}
              </button>
            </div>
          )}

          {currentStep === 'waiting_address' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">📍</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Waiting for Shipping Address</h3>
              <p className="text-gray-600 text-lg mb-6">Buyer will provide the delivery address</p>
              
              <button
                onClick={() => handleCancelDeal('Cancelled by cardholder after buyer payment - refund will be processed')}
                disabled={cancelling}
                className="bg-red-500 text-white py-2 px-6 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
              >
                {cancelling ? '⏳ Cancelling...' : '❌ Cancel Deal (Refund)'}
              </button>
            </div>
          )}

          {currentStep === 'waiting_order' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">📦</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Waiting for Order</h3>
              <p className="text-gray-600 text-lg mb-6">Cardholder will place the order and provide details</p>
              
              <button
                onClick={() => handleCancelDeal('Cancelled by buyer after address shared - refund will be processed')}
                disabled={cancelling}
                className="bg-red-500 text-white py-2 px-6 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
              >
                {cancelling ? '⏳ Cancelling...' : '❌ Cancel Deal (Refund)'}
              </button>
            </div>
          )}

          {currentStep === 'order_tracking' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">📦</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Order Placed!</h3>
              <p className="text-gray-600 text-lg mb-6">Tracking your order...</p>
              {deal.trackingUrl && (
                <a
                  href={deal.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-600 text-white py-3 px-8 rounded-lg hover:bg-blue-700 font-semibold"
                >
                  🔗 Track Order
                </a>
              )}
            </div>
          )}

          {currentStep === 'waiting_delivery' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">🚚</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Order in Transit</h3>
              <p className="text-gray-600 text-lg">Waiting for buyer to confirm delivery</p>
              {deal.trackingUrl && (
                <a
                  href={deal.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 bg-blue-100 text-blue-700 py-3 px-6 rounded-lg hover:bg-blue-200 font-semibold"
                >
                  🔗 Track Shipment
                </a>
              )}
            </div>
          )}

          {currentStep === 'delivery_tracking' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">🚚</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Out for Delivery</h3>
              <p className="text-gray-600 text-lg mb-6">Your order is on its way!</p>
              {deal.trackingUrl && (
                <a
                  href={deal.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-teal-600 text-white py-3 px-8 rounded-lg hover:bg-teal-700 font-semibold"
                >
                  🔗 Track Delivery
                </a>
              )}
            </div>
          )}

          {currentStep === 'waiting_confirmation' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">✅</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Payment Disbursed!</h3>
              <p className="text-gray-600 text-lg">Waiting for buyer to confirm receipt</p>
              <div className="mt-6 bg-green-50 border-2 border-green-200 rounded-lg p-6">
                <p className="text-green-800 font-semibold text-lg">
                  💰 Your commission of ₹{deal.cardholderCommission} has been paid!
                </p>
              </div>
            </div>
          )}

          {currentStep === 'payment_received' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">💰</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Payment Received!</h3>
              <p className="text-gray-600 text-lg mb-4">Your commission has been disbursed</p>
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-8">
                <p className="text-4xl font-bold text-green-600 mb-2">
                  ₹{deal.cardholderCommission}
                </p>
                <p className="text-gray-700 font-semibold">Commission Earned</p>
              </div>
            </div>
          )}

          {currentStep === 'completed' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">🎉</div>
              <h3 className="text-3xl font-bold text-gray-800 mb-4">Deal Completed!</h3>
              <p className="text-gray-600 text-xl mb-6">Thank you for using SplitPay</p>
              <div className="bg-gradient-to-r from-green-50 to-purple-50 border-2 border-green-300 rounded-lg p-8">
                {userRole === 'buyer' && (
                  <>
                    <p className="text-2xl font-bold text-green-600 mb-2">
                      You Saved: ₹{deal.buyerDiscount}
                    </p>
                    <p className="text-gray-700">Enjoy your product! 🎁</p>
                  </>
                )}
                {userRole === 'cardholder' && (
                  <>
                    <p className="text-2xl font-bold text-blue-600 mb-2">
                      You Earned: ₹{deal.cardholderCommission}
                    </p>
                    <p className="text-gray-700">Great job! 💪</p>
                  </>
                )}
              </div>
              <button
                onClick={onClose}
                className="mt-6 bg-gray-200 text-gray-700 py-3 px-8 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealFlowModal;
