import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/authHelper';

const CardholderProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState('upi'); // 'upi' or 'bank_account'
  const [formData, setFormData] = useState({
    upiVPA: '',
    bankAccount: {
      accountNumber: '',
      accountHolderName: '',
      ifsc: ''
    }
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = getAuthToken('cardholder');
      const res = await fetch('http://localhost:5000/api/users/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.user.cardholderPayoutDetails) {
          const details = data.user.cardholderPayoutDetails;
          setAccountType(details.accountType || 'upi');
          setFormData({
            upiVPA: details.upiVPA || '',
            bankAccount: details.bankAccount || formData.bankAccount
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const validateIFSC = (ifsc) => {
    // IFSC format: 4 letters + 0 + 6 alphanumeric characters
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc.toUpperCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (accountType === 'upi') {
      if (!formData.upiVPA || !formData.upiVPA.includes('@')) {
        toast.error('Invalid UPI ID format');
        return;
      }
    } else {
      if (!formData.bankAccount.accountNumber || 
          !formData.bankAccount.accountHolderName || 
          !formData.bankAccount.ifsc) {
        toast.error('Please fill all bank details');
        return;
      }
      
      if (!validateIFSC(formData.bankAccount.ifsc)) {
        toast.error('Invalid IFSC code format (e.g., SBIN0001234)');
        return;
      }
    }

    setLoading(true);
    try {
      const token = getAuthToken('cardholder');
      const payoutData = {
        accountType,
        ...(accountType === 'upi' 
          ? { upiVPA: formData.upiVPA }
          : { bankAccount: {
              ...formData.bankAccount,
              ifsc: formData.bankAccount.ifsc.toUpperCase()
            }}
        ),
        verified: false // Will be verified by admin/system
      };

      const res = await fetch('http://localhost:5000/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cardholderPayoutDetails: payoutData })
      });

      if (res.ok) {
        toast.success('✅ Payout details saved successfully!');
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
          <h1 className="text-3xl font-bold text-gray-900">Cardholder Profile</h1>
          <button
            onClick={() => navigate('/cardholder-dashboard')}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">💰 Payout Details</h2>
          <p className="text-sm text-gray-600 mb-6">
            Choose how you want to receive your earnings from completed deals
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Payout Method
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setAccountType('upi')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition ${
                    accountType === 'upi'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  💳 UPI (Instant)
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('bank_account')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition ${
                    accountType === 'bank_account'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  🏦 Bank Account
                </button>
              </div>
            </div>

            {/* UPI Form */}
            {accountType === 'upi' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  UPI ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.upiVPA}
                  onChange={(e) => setFormData({ ...formData, upiVPA: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="yourname@paytm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your UPI ID (e.g., 9876543210@paytm, name@oksbi)
                </p>
              </div>
            )}

            {/* Bank Account Form */}
            {accountType === 'bank_account' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Holder Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccount.accountHolderName}
                    onChange={(e) => setFormData({
                      ...formData,
                      bankAccount: { ...formData.bankAccount, accountHolderName: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccount.accountNumber}
                    onChange={(e) => setFormData({
                      ...formData,
                      bankAccount: { ...formData.bankAccount, accountNumber: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1234567890"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IFSC Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccount.ifsc}
                    onChange={(e) => setFormData({
                      ...formData,
                      bankAccount: { ...formData.bankAccount, ifsc: e.target.value.toUpperCase() }
                    })}
                    maxLength="11"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    placeholder="SBIN0001234"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    11-character IFSC code (e.g., SBIN0001234)
                  </p>
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Important:</strong> Double-check your details! Payouts will be sent to this {accountType === 'upi' ? 'UPI ID' : 'bank account'}.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : '💾 Save Payout Details'}
            </button>
          </form>
        </div>

        {/* Stats Section */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">📊 Your Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Deals</p>
              <p className="text-2xl font-bold text-blue-600">-</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">-</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Earnings</p>
              <p className="text-2xl font-bold text-purple-600">₹0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardholderProfile;
