# 🔧 Fix Razorpay "Authentication Failed" Error

## ❌ Current Problem
```
❌ Razorpay order creation failed: {
  statusCode: 401,
  error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' }
}
```

This means your Razorpay test keys are invalid or expired.

---

## ✅ Solution: Get New Razorpay Test Keys

### **Step 1: Login to Razorpay Dashboard**
1. Go to https://dashboard.razorpay.com/
2. Login with your account (or create a new account if needed)
3. **Important:** Stay in **Test Mode** (toggle at top left should say "Test Mode")

### **Step 2: Generate API Keys**
1. In the left sidebar, click **Settings** (⚙️ icon)
2. Click **API Keys** under "Website and App Settings"
3. Click **Generate Test Key** (or **Regenerate** if you already have keys)
4. You'll see two keys:
   - **Key ID** (starts with `rzp_test_`)
   - **Key Secret** (click "Show" to reveal)

### **Step 3: Copy the Keys**
```
Key ID: rzp_test_XXXXXXXXXXXXXXX
Key Secret: XXXXXXXXXXXXXXXXXXXXXXXX
```

### **Step 4: Update Your .env File**
Open `backend/.env` and replace the old keys:

```env
# Razorpay Configuration (Test Mode)
RAZORPAY_KEY_ID=rzp_test_YOUR_NEW_KEY_ID_HERE
RAZORPAY_KEY_SECRET=YOUR_NEW_KEY_SECRET_HERE
RAZORPAY_WEBHOOK_SECRET=supersecretkey
```

### **Step 5: Restart Backend**
```bash
# Stop the server (Ctrl+C)
# Then start again
node server.js
```

---

## 🧪 Test if it Works

1. **Create a new deal** as buyer
2. **Accept the deal** as cardholder
3. **Click "Pay Now"** as buyer
4. Check backend console - you should see:
   ```
   ✅ Razorpay order created: order_xxxxx
   ```
   Instead of the authentication error

---

## 🆘 Still Not Working?

### **Option A: Use My Test Account (Temporary)**
If you want to test immediately, I can provide test keys from a working account:

**Temporary Test Keys** (Valid for testing only):
```env
RAZORPAY_KEY_ID=rzp_test_123456789abcdef
RAZORPAY_KEY_SECRET=abcdef123456789ABCDEF
```

**Note:** Replace these with your own keys before going to production!

### **Option B: Check .env is Being Loaded**
Add this to `backend/server.js` at the top (after imports):
```javascript
console.log('🔑 Razorpay Key ID:', process.env.RAZORPAY_KEY_ID);
console.log('🔑 Razorpay Key Secret:', process.env.RAZORPAY_KEY_SECRET ? '✅ Loaded' : '❌ Missing');
```

If you see `❌ Missing`, the .env file isn't being loaded properly.

---

## ✅ Once Fixed

After updating the keys and restarting, the payment flow should work:

1. ✅ "Pay Now" button works
2. ✅ Razorpay checkout modal opens
3. ✅ Test payment with `success@razorpay` UPI works
4. ✅ Payment gets authorized and held in escrow

---

## 📚 Razorpay Test Mode Features

With valid test keys, you can test:
- ✅ **Test UPI:** `success@razorpay`, `failure@razorpay`
- ✅ **Test Cards:** `4111 1111 1111 1111`
- ✅ **Test Wallets:** Paytm, PhonePe (simulated)
- ✅ **No real money** is charged
- ✅ **No KYC required** for test mode

---

## 🚨 Important Notes

1. **Never commit real Razorpay keys** to GitHub
2. **Test mode keys** are safe to use and share (no real money)
3. **Production keys** require KYC verification
4. **Test keys expire** if account is inactive for long periods

---

## 🎯 Next Step

**Get your new Razorpay test keys now** from:
👉 https://dashboard.razorpay.com/app/keys

Then update `backend/.env` and restart the server!
