# 🔔 FCM Push Notifications Setup for Cardholders

## ✅ What's Been Configured

1. ✅ `CardholderDashboard.jsx` - Auto-registers FCM token on login
2. ✅ `firebase-messaging-sw.js` - Service worker for background notifications
3. ✅ Firebase config in `.env` file
4. ❌ **VAPID Key needed** - Follow steps below

## 🔑 Get Your VAPID Key from Firebase Console

### Step 1: Go to Firebase Console

1. Visit: https://console.firebase.google.com/
2. Select your project: **splitpay-62727**

### Step 2: Navigate to Cloud Messaging Settings

1. Click the ⚙️ (Settings) icon next to "Project Overview"
2. Select **"Project settings"**
3. Go to the **"Cloud Messaging"** tab

### Step 3: Find Web Push Certificates

Scroll down to the **"Web Push certificates"** section

### Step 4: Generate VAPID Key (if not already generated)

If you see "No certificates" or need to generate one:

1. Click **"Generate key pair"** button
2. A public key will be generated (starts with `B...`)
3. Copy this key

### Step 5: Add VAPID Key to .env

Update your `frontend/.env` file:

```properties
VITE_FIREBASE_API_KEY=AIzaSyD6dAPz5tSbLpeV9D5u3DoucPMQB5FX4Ok
VITE_FIREBASE_AUTH_DOMAIN=splitpay-62727.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=splitpay-62727
VITE_FIREBASE_STORAGE_BUCKET=splitpay-62727.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1023181181307
VITE_FIREBASE_APP_ID=1:1023181181307:web:5dd8b90d2c40b026f7adde
VITE_FIREBASE_VAPID_KEY=BNhH9yKjY0G0h9yKjY0G0h9yKjY0G0h9yKjY0G0h9yKjY0G0h9yKjY0G0h9yKjY0G0
```

**Replace the VAPID key with your actual key from Firebase Console!**

## 🚀 How It Works

### For Cardholders:

1. **Login** → Goes to Cardholder Dashboard
2. **Browser asks** → "Allow notifications?"
3. **User clicks "Allow"** → FCM token is generated
4. **Token sent to backend** → Saved in MongoDB
5. **Done!** → Cardholder will receive push notifications

### When a Deal is Created:

1. Buyer creates deal
2. Backend sends:
   - 📧 **Email** → ALL cardholders
   - 🔔 **Push notification** → Cardholders with FCM tokens
3. Cardholder sees notification instantly!

## 🧪 Testing

### Step 1: Start Frontend

```bash
cd frontend
npm run dev
```

### Step 2: Login as Cardholder

1. Go to `http://localhost:3000/cardholder`
2. Login or signup
3. Browser will ask: **"Allow notifications?"**
4. Click **"Allow"**

### Step 3: Check Console

You should see:
```
Notification permission granted
FCM Token: eA1B2C3D4E5F6G7H8I9J0K...
✓ FCM token registered successfully
```

### Step 4: Check Backend Logs

Backend should show:
```
✓ FCM token saved for user: John Doe (john@example.com)
```

### Step 5: Create a Deal

1. Login as buyer
2. Create a deal
3. Cardholder receives:
   - 🔔 **Push notification** (if allowed notifications)
   - 📧 **Email** (always sent)

## 📱 Testing Push Notifications

### Option 1: Create Real Deal
- Login as buyer
- Create deal via Postman or frontend
- Cardholder receives notification

### Option 2: Test via Firebase Console

1. Go to Firebase Console → Cloud Messaging
2. Click "Send test message"
3. Add your FCM token
4. Send test notification

## 🔧 Troubleshooting

### "Notification permission denied"
- User clicked "Block" when asked
- **Solution:** User must manually enable in browser settings

### "No registration token available"
- VAPID key not configured or invalid
- **Solution:** Follow Step 5 above to add correct VAPID key

### "Failed to register FCM token"
- Backend not running
- Invalid JWT token
- **Solution:** Check backend is running and user is logged in

### Notifications not appearing
1. Check browser notification settings
2. Verify service worker is registered (DevTools → Application → Service Workers)
3. Check Firebase Console for any errors
4. Verify VAPID key matches Firebase Console

## 📊 Verification Checklist

✅ Firebase project created  
✅ VAPID key generated in Firebase Console  
✅ VAPID key added to `frontend/.env`  
✅ Service worker file exists in `public/firebase-messaging-sw.js`  
✅ Frontend restarted after .env changes  
✅ Browser notifications allowed  
✅ Backend running on port 5000  
✅ User logged in with valid JWT token  

## 🎯 Expected User Experience

### First Time Login:
1. User logs in to Cardholder Dashboard
2. **Browser popup:** "SplitPay wants to show notifications"
3. User clicks **"Allow"**
4. Toast notification: "🔔 Push notifications enabled!"

### When Deal is Created:
1. **Push notification appears** with:
   - Title: "New Deal Request 💸"
   - Body: "Mock Product — ₹999"
2. User clicks notification → Opens dashboard
3. **Email also sent** with full deal details

## 🔐 Security Notes

- FCM tokens are user-specific and secure
- Tokens expire after 60 days of inactivity
- Tokens are refreshed automatically
- Backend verifies JWT before registering tokens

## 📝 Key Files Modified

```
frontend/
├── src/
│   ├── pages/
│   │   └── CardholderDashboard.jsx    # FCM registration logic
│   └── firebase.js                     # Firebase config
├── public/
│   └── firebase-messaging-sw.js        # Service worker
└── .env                                # VAPID key config
```

## 🚨 Important Notes

1. **HTTPS Required in Production**
   - Push notifications only work on HTTPS (or localhost)
   - Deploy to Vercel, Netlify, or similar

2. **Service Worker Scope**
   - Must be in `public/` folder
   - Accessible at root URL

3. **Browser Support**
   - Chrome, Firefox, Edge: ✅ Full support
   - Safari: ⚠️ Limited support (iOS 16.4+)

4. **Token Refresh**
   - FCM tokens can change
   - App handles this automatically on next login

## 🎉 Summary

Once you add the VAPID key to `.env`:

✅ Cardholders will auto-register for push notifications on login  
✅ They'll receive instant notifications when deals are created  
✅ Email notifications work as backup (always sent)  
✅ Both notification channels work together seamlessly

**Next step:** Get your VAPID key from Firebase Console and add it to `.env`!
