import { useState, useEffect, useCallback } from 'react';
import { useFCMForeground } from '../utils/useFCMForeground';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const BuyerDashboard = () => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productUrl, setProductUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

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
      const response = await fetch('http://localhost:5000/api/deals', {
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

  // Handle FCM foreground messages - auto-refresh when deal is accepted
  useFCMForeground((data) => {
    console.log('🔔 Notification received, refreshing deals...');
    fetchDeals();
    
    // Show success toast for deal acceptance
    if (data?.dealId) {
      toast.success('A cardholder accepted your deal! 🎉');
    }
  });

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
      const response = await fetch('http://localhost:5000/api/deals', {
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
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <ToastContainer />
      
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Buyer Dashboard</h1>
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
                        <p className="text-sm">
                          Status: <span className={`font-semibold ${
                            deal.status === 'matched' ? 'text-green-600' :
                            deal.status === 'expired' ? 'text-red-600' :
                            deal.status === 'pending' ? 'text-yellow-600' :
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

export default BuyerDashboard;
