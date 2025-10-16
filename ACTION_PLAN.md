# 🚀 YOUR ACTION PLAN - What To Do Next

## ✅ **What's Already Complete**

1. ✅ Backend 100% complete (Socket.io, Razorpay, Redis locks, auto-shipping, auto-disbursement)
2. ✅ React-hot-toast installed and configured
3. ✅ Razorpay script added to `index.html`
4. ✅ `AddressForm.jsx` component created
5. ✅ `OrderSubmissionForm.jsx` component created
6. ✅ `BuyerProfile.jsx` page created
7. ✅ `CardholderProfile.jsx` page created (with IFSC validation)
8. ✅ Socket.io client utility (`frontend/src/utils/socket.js`)

---

## 🎯 **YOUR NEXT 4 TASKS**

### **Task 1: Add Profile Routes to App.jsx** ⏰ 5 mins

**File:** `frontend/src/App.jsx`

**Add these imports:**
```javascript
import BuyerProfile from "./pages/BuyerProfile";
import CardholderProfile from "./pages/CardholderProfile";
```

**Add these routes inside `<Routes>` after existing routes:**
```javascript
<Route
  path="/buyer-profile"
  element={
    <ProtectedRoute allowedRole="buyer">
      <BuyerProfile />
    </ProtectedRoute>
  }
/>

<Route
  path="/cardholder-profile"
  element={
    <ProtectedRoute allowedRole="cardholder">
      <CardholderProfile />
    </ProtectedRoute>
  }
/>
```

---

### **Task 2: Add Profile Link to BuyerDashboard** ⏰ 2 mins

**File:** `frontend/src/pages/BuyerDashboard.jsx`

**Add this import:**
```javascript
import { useNavigate } from 'react-router-dom';
```

**Add at the top of the component:**
```javascript
const navigate = useNavigate();
```

**Update the header buttons section to include Profile:**
```javascript
<div className="flex space-x-3">
  <button
    onClick={() => navigate('/buyer-profile')}
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
```

---

### **Task 3: Add Profile Link to CardholderDashboard** ⏰ 2 mins

**File:** `frontend/src/pages/CardholderDashboard.jsx`

**Add this import (if not already there):**
```javascript
import { useNavigate } from 'react-router-dom';
```

**Add at the top of the component:**
```javascript
const navigate = useNavigate();
```

**Update the header buttons section:**
```javascript
<div className="flex space-x-3">
  <button
    onClick={() => navigate('/cardholder-profile')}
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
```

---

### **Task 4: Add User Profile API Endpoint** ⏰ 10 mins

**File:** `backend/routes/user.js`

**Add these two endpoints:**

```javascript
// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { buyerPaymentDetails, cardholderPayoutDetails } = req.body;
    
    const updateData = {};
    if (buyerPaymentDetails) updateData.buyerPaymentDetails = buyerPaymentDetails;
    if (cardholderPayoutDetails) updateData.cardholderPayoutDetails = cardholderPayoutDetails;
    
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateData },
      { new: true }
    ).select('-password');
    
    res.json({ user, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

---

## 🚀 **After Completing Above Tasks**

You'll have a fully functional frontend! Then you can:

### **Step 5: Start Testing** ⏰ 30-60 mins

1. **Start Backend:**
   ```bash
   cd backend
   node server.js
   ```

2. **Start Frontend** (in new terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test Flow:**
   - ✅ Buyer creates deal → See it in cardholder dashboard
   - ✅ Multiple cardholders race to accept → First one wins
   - ✅ Buyer pays via Razorpay test mode (use `success@razorpay` UPI)
   - ✅ Buyer shares address → Cardholder sees it
   - ✅ Cardholder submits order ID
   - ✅ Check backend logs for auto-shipping detection (simulated)

---

## 📋 **Quick Checklist**

- [ ] Task 1: Add profile routes to App.jsx
- [ ] Task 2: Add profile link to BuyerDashboard
- [ ] Task 3: Add profile link to CardholderDashboard
- [ ] Task 4: Add user profile API endpoints
- [ ] Test: Create a buyer account and add profile details
- [ ] Test: Create a cardholder account and add payout details
- [ ] Test: Complete flow from deal creation to payment
- [ ] Test: Open 3 browser tabs as different cardholders (race condition test)

---

## 🎉 **You're Almost Done!**

After completing these 4 small tasks, your **ENTIRE SplitPay application will be ready to test**!

**Estimated time to complete all tasks:** 20-30 minutes

---

## 💡 **Pro Tips for Testing**

1. **Use Incognito/Private browsing** for multiple accounts
2. **Open Developer Console** (F12) to see Socket.io events
3. **Use Razorpay Test Mode:**
   - Test UPI: `success@razorpay`
   - Test Card: `4111 1111 1111 1111`
4. **Check Backend Logs** for:
   - Socket.io connections
   - Redis lock acquisition
   - Payment events
   - Shipping detection logs

---

## 📞 **Need Help?**

If you get stuck:
1. Check browser console for errors
2. Check backend terminal for error messages
3. Verify `.env` file has all Razorpay keys
4. Make sure Redis is running: `redis-cli ping`
5. Make sure MongoDB is connected

**Let's do this! 🚀**
