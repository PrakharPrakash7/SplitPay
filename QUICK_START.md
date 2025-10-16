# 🚀 Quick Start Guide - Running SplitPay

## Backend Setup

### 1. Start Backend Server

Open a terminal in VS Code and run:

```bash
cd backend
npm start
```

**OR** if you want auto-reload on file changes:
```bash
cd backend
npm run dev
```

Expected output:
```
🚀 Server running on port 5000
🔌 Socket.io enabled on http://localhost:5000
✅ MongoDB Connected
📦 Shipping tracker initialized
✅ Shipping tracker cron jobs scheduled
```

### 2. Verify Razorpay Configuration

Before testing payments, add your Razorpay test keys to `backend/.env`:

```env
# Get from: https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_SECRET_KEY
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

### 3. Test Backend is Running

Open browser: http://localhost:5000

You should see: **"SplitPay Backend Running ✅"**

---

## Frontend Setup

### 1. Start Frontend Dev Server

Open **another terminal** (keep backend running):

```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v7.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 2. Open in Browser

Visit: http://localhost:5173

---

## Testing the Complete Flow

### Step 1: Create Test Users

**Buyer:**
- Email: buyer@test.com
- Password: test123

**Cardholder:**
- Email: cardholder@test.com
- Password: test123

Add cardholder payout details:
- UPI VPA: test@upi (for test mode)
- OR Bank Account (any test details)

### Step 2: Test Deal Creation & Acceptance

1. **As Buyer**: Create a deal with Flipkart/Amazon URL
2. **As Cardholder**: Accept the deal (first-to-win!)
3. **Check Console**: Should see Socket.io events

### Step 3: Test Razorpay Payment

1. **As Buyer**: Click "Pay Now" button
2. **Razorpay Checkout Opens**: Select UPI
3. **Enter Test UPI**: `success@razorpay`
4. **Payment Succeeds**: Should see "Payment authorized" message

### Step 4: Share Address

1. **As Buyer**: Fill and submit shipping address form
2. **As Cardholder**: Should receive address via Socket.io

### Step 5: Submit Order

1. **As Cardholder**: Place order on e-commerce site
2. **Submit Order ID**: Enter order ID in form
3. **Upload Invoice** (optional)

### Step 6: Simulate Shipping

For testing, create a test endpoint to mark as shipped:

```bash
# Using curl or Postman
POST http://localhost:5000/api/payment/test/mark-shipped
Body: { "dealId": "your-deal-id" }
```

Or wait for the cron job to detect shipping (runs every 6 hours).

### Step 7: Verify Auto-Disbursement

Check console logs for:
```
✅ Payment captured for deal XXX
💸 Payout initiated for deal XXX
✅ Payout created: pout_test_XXX
```

---

## Troubleshooting

### Backend Won't Start

**Error**: `Cannot find module`
**Fix**: Make sure you're in the `backend` directory:
```bash
cd c:\Users\prakh\Desktop\SplitPay\backend
npm start
```

**Error**: `Redis connection failed`
**Fix**: Start Redis service:
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start it
# Windows: Start Redis from Services or run redis-server.exe
```

**Error**: `MongoDB connection failed`
**Fix**: Check MONGO_URI in `.env` file

### Socket.io Not Connecting

1. Check JWT token is valid
2. Check CORS settings in `server.js`
3. Open browser console → Network tab → Check WebSocket connection

### Razorpay Payment Fails

1. Verify keys in `.env` are test mode keys (start with `rzp_test_`)
2. Use test UPI VPA: `success@razorpay`
3. Check browser console for errors

### Cron Jobs Not Running

**Note**: Cron jobs won't trigger immediately. For testing:

**Check Shipping Immediately**:
```javascript
// In backend, add test route
router.post('/test/check-shipping', async (req, res) => {
  const { dealId } = req.body;
  const deal = await Deal.findById(dealId);
  const shipped = await checkShippingStatus(deal);
  res.json({ shipped });
});
```

---

## Monitoring

### Check Socket.io Connections

Backend console shows:
```
✅ User connected: abc123 | Role: buyer | UserId: 507f1f77bcf86cd799439011
💳 Cardholder 507f... joined cardholders room
```

### Check Deal Status

```bash
# Get all deals
GET http://localhost:5000/api/deals
```

### Check Payment Status

Look for these status transitions in MongoDB:
```
pending → matched → awaiting_payment → payment_authorized → 
address_shared → order_placed → shipped → payment_captured → 
disbursed → completed
```

---

## Quick Commands

```bash
# Start backend
cd backend && npm start

# Start frontend
cd frontend && npm run dev

# Check Redis
redis-cli ping

# Check MongoDB connection
mongosh "YOUR_MONGO_URI"

# View logs
# Backend: Check terminal running npm start
# Frontend: Check browser console (F12)
```

---

## API Endpoints Reference

### Deals
- `POST /api/deals` - Create deal
- `GET /api/deals` - List all deals
- `POST /api/deals/:id/accept` - Accept deal

### Payment
- `POST /api/payment/create-order` - Create Razorpay order
- `POST /api/payment/verify-payment` - Verify payment
- `POST /api/payment/share-address` - Share address
- `POST /api/payment/submit-order` - Submit order ID
- `POST /api/payment/capture-payment` - Capture from escrow
- `POST /api/payment/initiate-payout` - Disburse to cardholder
- `POST /api/payment/void-payment` - Refund buyer

### Auth
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user

---

## What's Working Now

✅ Real-time Socket.io communication
✅ First-to-win cardholder matching with Redis locks
✅ Razorpay payment gateway integration (test mode)
✅ UPI payment support
✅ Escrow simulation (hold/capture)
✅ Auto-shipping detection (every 6 hours)
✅ Auto-payment capture on shipping
✅ Auto-disbursement to cardholder
✅ Auto-refund if not shipped in 7 days
✅ FCM push notifications
✅ Complete payment flow backend

## What Needs Frontend Work

⏳ Razorpay checkout modal UI
⏳ Address form component
⏳ Order submission form
⏳ Socket.io listeners in dashboards
⏳ Profile management pages
⏳ Payment status indicators

---

**Your backend is 100% complete and ready to handle the entire payment flow!** 🎉

Just need to add the frontend UI components to interact with these APIs.
