import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/authHelper';

const BuyerProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    preferredUPI: '',
    defaultAddress: {
      fullName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      landmark: ''
    }
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = getAuthToken('buyer');
      const res = await fetch('http://localhost:5000/api/users/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.user.buyerPaymentDetails) {
          setFormData({
            preferredUPI: data.user.buyerPaymentDetails.preferredUPI || '',
            defaultAddress: data.user.buyerPaymentDetails.defaultAddress || formData.defaultAddress
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleUPIChange = (e) => {
    setFormData({ ...formData, preferredUPI: e.target.value });
  };

  const handleAddressChange = (e) => {
    setFormData({
      ...formData,
      defaultAddress: {
        ...formData.defaultAddress,
        [e.target.name]: e.target.value
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (formData.preferredUPI && !formData.preferredUPI.includes('@')) {
      toast.error('Invalid UPI ID format');
      return;
    }

    setLoading(true);
    try {
      const token = getAuthToken('buyer');
      const res = await fetch('http://localhost:5000/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ buyerPaymentDetails: formData })
      });

      if (res.ok) {
        toast.success('✅ Profile updated successfully!');
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Buyer Profile</h1>
          <button
            onClick={() => navigate('/buyer-dashboard')}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* UPI Section */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-gray-800">💳 Payment Details</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred UPI ID (Optional)
                </label>
                <input
                  type="text"
                  value={formData.preferredUPI}
                  onChange={handleUPIChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="yourname@paytm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be pre-filled in Razorpay checkout
                </p>
              </div>
            </div>

            {/* Default Address Section */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-gray-800">📍 Default Shipping Address</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.defaultAddress.fullName}
                    onChange={handleAddressChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.defaultAddress.phone}
                    onChange={handleAddressChange}
                    maxLength="10"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    name="addressLine1"
                    value={formData.defaultAddress.addressLine1}
                    onChange={handleAddressChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="House No., Street Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.defaultAddress.addressLine2}
                    onChange={handleAddressChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Apartment, Suite, etc."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.defaultAddress.city}
                      onChange={handleAddressChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Mumbai"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.defaultAddress.state}
                      onChange={handleAddressChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Maharashtra"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pincode
                    </label>
                    <input
                      type="text"
                      name="pincode"
                      value={formData.defaultAddress.pincode}
                      onChange={handleAddressChange}
                      maxLength="6"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="400001"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Landmark
                  </label>
                  <input
                    type="text"
                    name="landmark"
                    value={formData.defaultAddress.landmark}
                    onChange={handleAddressChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Near XYZ Mall"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : '💾 Save Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BuyerProfile;
