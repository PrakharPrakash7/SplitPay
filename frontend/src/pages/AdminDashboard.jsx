import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getAuthToken, clearAuth } from "../utils/authHelper";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    orderPlaced: 0,
    shipped: 0,
    completed: 0
  });

  const handleLogout = () => {
    clearAuth('admin');
    navigate("/admin");
  };

  // Fetch all deals
  const fetchDeals = async () => {
    try {
      const token = getAuthToken('admin');
      const response = await fetch("http://localhost:5000/api/admin/deals", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDeals(data.deals || []);
        
        // Calculate stats
        const total = data.deals.length;
        const pending = data.deals.filter(d => d.status === 'pending').length;
        const orderPlaced = data.deals.filter(d => d.status === 'order_placed').length;
        const shipped = data.deals.filter(d => d.status === 'shipped').length;
        const completed = data.deals.filter(d => d.status === 'completed' || d.status === 'disbursed').length;
        
        setStats({ total, pending, orderPlaced, shipped, completed });
      } else {
        toast.error("Failed to fetch deals");
      }
    } catch (error) {
      console.error("Error fetching deals:", error);
      toast.error("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  // Mark order as shipped
  const handleMarkShipped = async (dealId) => {
    if (!confirm("Mark this order as shipped? This will capture payment and initiate payout.")) {
      return;
    }

    setProcessing(dealId);
    try {
      const token = getAuthToken('admin');
      const response = await fetch("http://localhost:5000/api/payment/admin/mark-shipped", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ dealId })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "✅ Order marked as shipped!");
        fetchDeals(); // Refresh deals
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to mark as shipped");
      }
    } catch (error) {
      console.error("Error marking shipped:", error);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  useEffect(() => {
    fetchDeals();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDeals, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      matched: "bg-blue-100 text-blue-800",
      payment_authorized: "bg-green-100 text-green-800",
      address_shared: "bg-purple-100 text-purple-800",
      order_placed: "bg-orange-100 text-orange-800",
      shipped: "bg-teal-100 text-teal-800",
      payment_captured: "bg-green-100 text-green-800",
      disbursed: "bg-indigo-100 text-indigo-800",
      completed: "bg-green-200 text-green-900",
      expired: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800"
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">🔐 Admin Dashboard</h1>
              <p className="text-purple-100 mt-1">Manage orders and shipping approvals</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Total Deals</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Pending</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Order Placed</p>
            <p className="text-3xl font-bold text-orange-600">{stats.orderPlaced}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Shipped</p>
            <p className="text-3xl font-bold text-teal-600">{stats.shipped}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Completed</p>
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </div>

        {/* Deals Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">📦 Orders Awaiting Shipping Approval</h2>
            <button
              onClick={fetchDeals}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition"
            >
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading deals...</p>
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No deals found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buyer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cardholder</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deals.map((deal) => (
                    <tr key={deal._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {deal.product?.image && (
                            <img 
                              src={deal.product.image} 
                              alt={deal.product.title}
                              className="w-12 h-12 object-cover rounded mr-3"
                            />
                          )}
                          <div className="max-w-xs">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {deal.product?.title || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(deal.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {deal.buyerId?.name || 'N/A'}
                        <br/>
                        <span className="text-xs text-gray-500">{deal.buyerId?.email}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {deal.cardholderId?.name || 'N/A'}
                        <br/>
                        <span className="text-xs text-gray-500">{deal.cardholderId?.email}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ₹{deal.product?.price || 0}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(deal.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {deal.orderIdFromCardholder || 'Not placed'}
                      </td>
                      <td className="px-6 py-4">
                        {deal.status === 'order_placed' ? (
                          <button
                            onClick={() => handleMarkShipped(deal._id)}
                            disabled={processing === deal._id}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processing === deal._id ? '⏳ Processing...' : '🚚 Mark as Shipped'}
                          </button>
                        ) : deal.status === 'shipped' ? (
                          <span className="text-teal-600 text-sm font-medium">✅ Shipped</span>
                        ) : deal.status === 'completed' || deal.status === 'disbursed' ? (
                          <span className="text-green-600 text-sm font-medium">✅ Completed</span>
                        ) : (
                          <span className="text-gray-400 text-sm">⏳ Waiting</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">ℹ️ How to Use Admin Dashboard</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Mark as Shipped:</strong> Click button when order is shipped to capture payment and initiate payout</li>
            <li>• <strong>Status Colors:</strong> Orange = Order Placed (action required), Teal = Shipped, Green = Completed</li>
            <li>• <strong>Auto-Refresh:</strong> Dashboard refreshes every 30 seconds automatically</li>
            <li>• <strong>Payment Flow:</strong> Marking as shipped → Captures payment from escrow → Initiates payout to cardholder</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
