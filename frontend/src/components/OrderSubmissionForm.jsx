import { useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../utils/api';

const OrderSubmissionForm = ({ dealId, shippingAddress, product, onClose }) => {
  const [orderId, setOrderId] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!orderId.trim()) {
      toast.error('Please enter order ID');
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

    // Validate file type
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
      
      const uploadRes = await fetch(`${API_BASE_URL}/api/deals/${dealId}/upload-invoice`, {
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
          dealId,
          orderId: orderId.trim(),
          trackingUrl: trackingUrl.trim(),
          invoiceUrl: invoiceUrl
        })
      });

      if (res.ok) {
        toast.success('📦 Order submitted! Buyer has been notified.');
        onClose && onClose();
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
          type="button"
        >
          ×
        </button>
        
        <h3 className="text-2xl font-bold mb-4 text-gray-800">📦 Submit Order Details</h3>
        
        {/* Debug info */}
        {console.log("🔍 OrderSubmissionForm - product:", product, "address:", shippingAddress)}
      
      {/* Show product details */}
      {product && product.title ? (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-purple-900 mb-3 text-lg">🛍️ Product to Order:</h4>
          <div className="flex items-start space-x-4">
            {product.image && (
              <img 
                src={product.image} 
                alt={product.title}
                className="w-24 h-24 object-cover rounded border-2 border-purple-200"
              />
            )}
            <div className="flex-1">
              <p className="text-base font-semibold text-purple-900 mb-2">{product.title}</p>
              <p className="text-base text-purple-700 font-semibold mb-3">Price: ₹{product.price}</p>
              {product.url && (
                <a 
                  href={product.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded text-sm transition"
                >
                  🔗 Open Product Page to Place Order →
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">⚠️ Product details not available</p>
        </div>
      )}
      
      {/* Show shipping address */}
      {shippingAddress && shippingAddress.name ? (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-900 mb-2 text-lg">📍 Shipping Address:</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-semibold text-base">{shippingAddress.name || shippingAddress.fullName}</p>
            <p className="font-medium">{shippingAddress.mobile || shippingAddress.phone}</p>
            <p>{shippingAddress.addressLine1}</p>
            {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
            <p>{shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode}</p>
            {shippingAddress.landmark && <p>Landmark: {shippingAddress.landmark}</p>}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">⚠️ Shipping address not available</p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-300 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-green-900 mb-2 text-lg">📋 Instructions:</h4>
        <ol className="text-sm text-green-800 space-y-2 ml-4 list-decimal">
          <li><strong>Click the "Open Product Page" button above</strong> to go to the product</li>
          <li>Place the order using the <strong>exact shipping address shown above</strong></li>
          <li>After placing the order, <strong>copy the Order ID, Tracking URL, and Invoice/Order Details URL</strong></li>
          <li>Come back here and <strong>paste all details below</strong></li>
          <li>Click "Submit Order Details" to complete the process</li>
        </ol>
      </div>

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
            Tracking URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://www.flipkart.com/track/123456 or https://www.amazon.in/track/123456"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            🔗 Tracking link from order confirmation (Required for shipping detection)
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

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Important:</strong> All fields are required! Make sure you've placed the order with the exact address shown above.
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
    </div>
  );
};

export default OrderSubmissionForm;
