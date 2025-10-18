import { useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../utils/api';

const DealFlowModal = ({ deal, onClose, onSuccess, userRole }) => {
  const [step, setStep] = useState(getInitialStep(deal, userRole));
  const [orderId, setOrderId] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Determine initial step based on deal status and user role
  function getInitialStep(deal, role) {
    if (!deal) return 'view';
    
    if (role === 'buyer') {
      if (deal.status === 'pending') return 'view';
      if (deal.status === 'matched') return 'payment';
      if (deal.status === 'payment_authorized') return 'address';
      if (deal.status === 'address_shared') return 'waiting_order';
      if (deal.status === 'order_placed') return 'shipped';
      if (deal.status === 'shipped') return 'delivery';
      if (deal.status === 'disbursed') return 'complete';
    }
    
    if (role === 'cardholder') {
      if (deal.status === 'pending') return 'view';
      if (deal.status === 'matched') return 'waiting_payment';
      if (deal.status === 'payment_authorized') return 'waiting_address';
      if (deal.status === 'address_shared') return 'order_form';
      if (deal.status === 'order_placed') return 'waiting_delivery';
      if (deal.status === 'shipped') return 'waiting_confirmation';
      if (deal.status === 'disbursed') return 'complete';
    }
    
    return 'view';
  }

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

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
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
        setLoading(false);
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
        onClose();
      } else {
        toast.error(data.error || 'Failed to submit order details');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Unable to submit order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!deal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            {step === 'view' && '📦 Deal Details'}
            {step === 'payment' && '💳 Payment Required'}
            {step === 'address' && '📍 Shipping Address'}
            {step === 'waiting_order' && '⏳ Waiting for Order'}
            {step === 'order_form' && '📝 Submit Order Details'}
            {step === 'waiting_payment' && '⏳ Waiting for Payment'}
            {step === 'waiting_address' && '⏳ Waiting for Address'}
            {step === 'waiting_delivery' && '🚚 Order in Transit'}
            {step === 'waiting_confirmation' && '✅ Awaiting Confirmation'}
            {step === 'complete' && '🎉 Deal Completed'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Product Information - Always visible */}
          <div className="mb-6 border rounded-lg p-4 bg-gray-50">
            <div className="flex gap-4">
              {deal.product?.image && (
                <img
                  src={deal.product.image}
                  alt={deal.product.title}
                  className="w-24 h-24 object-cover rounded"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">{deal.product?.title}</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">
                    Original Price: <span className="font-semibold">₹{deal.product?.price}</span>
                  </p>
                  <p className="text-gray-600">
                    Your Price: <span className="font-semibold text-green-600">₹{deal.discountedPrice}</span>
                  </p>
                  {deal.totalBankDiscount > 0 && (
                    <div className="text-xs text-gray-500 mt-2 border-t pt-2">
                      <p className="font-semibold text-gray-700 mb-1">💳 Discount Breakdown:</p>
                      <p>• Total Bank Discount: <span className="font-semibold">₹{deal.totalBankDiscount}</span></p>
                      {userRole === 'buyer' && (
                        <p className="text-green-600">• Your Savings (80%): <span className="font-semibold">₹{deal.buyerDiscount}</span></p>
                      )}
                      {userRole === 'cardholder' && (
                        <p className="text-blue-600">• Your Commission (15%): <span className="font-semibold">₹{deal.cardholderCommission}</span></p>
                      )}
                      <p className="text-purple-600">• Platform Fee (5%): <span className="font-semibold">₹{deal.platformFee}</span></p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mb-6 text-center">
            <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
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

          {/* Cardholder - Order Submission Form */}
          {step === 'order_form' && userRole === 'cardholder' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  📝 Please provide the order details after placing the order with your card
                </p>
              </div>

              {/* Shipping Address Display */}
              {deal.shippingDetails && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-gray-700 mb-2">📍 Shipping Address:</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>{deal.shippingDetails.name}</strong></p>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  📄 Upload the invoice PDF file (max 5MB)
                </p>
                {invoiceFile && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ Selected: {invoiceFile.name} ({(invoiceFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              >
                {loading ? '⏳ Submitting...' : '📤 Submit Order Details'}
              </button>
            </div>
          )}

          {/* Waiting States */}
          {step === 'waiting_payment' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">⏳</div>
              <p className="text-lg text-gray-700 mb-2">Waiting for buyer to make payment</p>
              <p className="text-sm text-gray-500">You'll be notified once the payment is authorized</p>
            </div>
          )}

          {step === 'waiting_address' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📍</div>
              <p className="text-lg text-gray-700 mb-2">Waiting for buyer to share shipping address</p>
              <p className="text-sm text-gray-500">You can place the order once the address is provided</p>
            </div>
          )}

          {step === 'waiting_order' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-lg text-gray-700 mb-2">Waiting for cardholder to place order</p>
              <p className="text-sm text-gray-500">The cardholder will provide order details soon</p>
            </div>
          )}

          {step === 'waiting_delivery' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🚚</div>
              <p className="text-lg text-gray-700 mb-2">Order is in transit</p>
              <p className="text-sm text-gray-500">Waiting for buyer to confirm delivery</p>
              {deal.trackingUrl && (
                <a
                  href={deal.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-blue-600 hover:underline"
                >
                  🔗 Track Shipment
                </a>
              )}
            </div>
          )}

          {step === 'waiting_confirmation' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg text-gray-700 mb-2">Payment is disbursed!</p>
              <p className="text-sm text-gray-500">Waiting for buyer to confirm receipt</p>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <p className="text-lg text-gray-700 mb-2">Deal Completed Successfully!</p>
              <p className="text-sm text-gray-500">Thank you for using SplitPay</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DealFlowModal;
