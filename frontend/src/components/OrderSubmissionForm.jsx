import { useState } from 'react';
import toast from 'react-hot-toast';

const OrderSubmissionForm = ({ dealId, shippingAddress, productDetails, onSuccess }) => {
  const [orderId, setOrderId] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!orderId.trim()) {
      toast.error('Please enter order ID');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/payment/submit-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dealId,
          orderId: orderId.trim(),
          trackingUrl: trackingUrl.trim() || null
        })
      });

      if (res.ok) {
        toast.success('📦 Order submitted! Buyer has been notified.');
        onSuccess && onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to submit order');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto my-6">
      <h3 className="text-2xl font-bold mb-4 text-gray-800">📦 Submit Order Details</h3>
      
      {/* Show product details */}
      {productDetails && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-purple-900 mb-3">🛍️ Product to Order:</h4>
          <div className="flex items-start space-x-4">
            {productDetails.image && (
              <img 
                src={productDetails.image} 
                alt={productDetails.title}
                className="w-20 h-20 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-900">{productDetails.title}</p>
              <p className="text-sm text-purple-700 mt-1">Price: ₹{productDetails.price}</p>
              {productDetails.url && (
                <a 
                  href={productDetails.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                >
                  🔗 Open product page →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Show shipping address */}
      {shippingAddress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-900 mb-2">📍 Shipping Address:</h4>
          <div className="text-sm text-blue-800">
            <p className="font-medium">{shippingAddress.name || shippingAddress.fullName}</p>
            <p>{shippingAddress.mobile || shippingAddress.phone}</p>
            <p>{shippingAddress.addressLine1}</p>
            {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
            <p>{shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode}</p>
            {shippingAddress.landmark && <p>Landmark: {shippingAddress.landmark}</p>}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., OD123456789012"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            📧 Copy from your order confirmation email
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tracking URL (Optional)
          </label>
          <input
            type="url"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://www.example.com/track/123456"
          />
          <p className="text-xs text-gray-500 mt-1">
            🔗 Tracking link from Flipkart/Amazon (helps with auto-detection)
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Important:</strong> Make sure you've placed the order with the exact address shown above before submitting!
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : '✅ Submit Order Details'}
        </button>
      </form>
    </div>
  );
};

export default OrderSubmissionForm;
