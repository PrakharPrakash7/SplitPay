# SplitPay - Complete Core Flow & Payment Integration Guide

## ✅ What's Been Implemented

### Backend Infrastructure:
1. **Socket.io Configuration** - Real-time bidirectional communication setup
2. **Razorpay Integration** - Payment gateway with escrow simulation
3. **Updated Models**:
   - Deal model with complete payment flow fields
   - User model with payment profiles (buyer UPI, cardholder payout details)
4. **Payment Routes** (`/api/payment`):
   - `/create-order` - Create Razorpay order with escrow hold
   - `/verify-payment` - Verify payment signature
   - `/share-address` - Buyer shares shipping address
   - `/submit-order` - Cardholder submits order ID/invoice
   - `/capture-payment` - Capture funds from escrow (when shipped)
   - `/initiate-payout` - Disburse to cardholder
   - `/void-payment` - Refund buyer if deal fails
   - `/webhook` - Razorpay webhook handler

## 🔧 Configuration Required

### 1. Get Razorpay Test Keys
1. Sign up at https://dashboard.razorpay.com/signup
2. Go to Settings → API Keys → Generate Test Key
3. Copy Key ID and Key Secret
4. Update `.env` file:
   ```properties
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxx
   RAZORPAY_KEY_SECRET=your_secret_key
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   ```

5. **For Webhook Secret**:
   - Go to Settings → Webhooks → Add Webhook
   - URL: `https://your-domain.com/api/payment/webhook`
   - Events: payment.authorized, payment.captured, payment.failed, payout.processed
   - Copy the webhook secret

### 2. Frontend Socket.io Setup

Create `frontend/src/utils/socket.js`:
```javascript
import { io } from 'socket.io-client';

let socket = null;

export const initializeSocket = (token) => {
  if (socket) return socket;
  
  socket = io('http://localhost:5000', {
    auth: { token },
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
```

## 📊 Complete User Flow

### Step 1: Buyer Creates Deal
**BuyerDashboard.jsx**
```javascript
import { useEffect, useState } from 'react';
import { initializeSocket, getSocket } from '../utils/socket';

function BuyerDashboard() {
  const [deals, setDeals] = useState([]);
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = initializeSocket(token);
    
    // Listen for deal updates
    socket.on('orderCreated', (data) => {
      console.log('Order created:', data);
      // Show Razorpay checkout
      openRazorpayCheckout(data);
    });
    
    socket.on('dealAccepted', (data) => {
      toast.success('A cardholder accepted your deal!');
      fetchDeals(); // Refresh
    });
    
    return () => socket.off('orderCreated');
  }, []);
  
  const createDeal = async (productUrl) => {
    // Existing create deal logic
    const res = await fetch('http://localhost:5000/api/deals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ productUrl })
    });
    
    if (res.ok) {
      toast.success('Deal created! Notifying cardholders...');
    }
  };
  
  return (
    // Your existing JSX
  );
}
```

### Step 2: Cardholder Accepts (First-to-Win)
**CardholderDashboard.jsx**
```javascript
const acceptDeal = async (dealId) => {
  try {
    const res = await fetch(`http://localhost:5000/api/deals/${dealId}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (res.ok) {
      toast.success('Deal accepted! Waiting for buyer payment...');
      socket.emit('joinDeal', dealId); // Join deal-specific room
    } else {
      const error = await res.json();
      toast.error(error.message || 'Deal already taken!');
    }
  } catch (err) {
    toast.error('Failed to accept deal');
  }
};
```

### Step 3: Buyer Payment via Razorpay

**Add Razorpay script to `frontend/index.html`**:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

**BuyerDashboard.jsx - Razorpay Checkout**:
```javascript
const openRazorpayCheckout = async (dealId) => {
  try {
    // Create order
    const res = await fetch('http://localhost:5000/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ dealId })
    });
    
    const data = await res.json();
    
    const options = {
      key: data.razorpayKeyId,
      amount: data.order.amount,
      currency: data.order.currency,
      name: 'SplitPay',
      description: 'Deal Payment with Escrow',
      order_id: data.order.id,
      handler: async (response) => {
        // Verify payment
        await verifyPayment(response, dealId);
      },
      prefill: {
        email: user.email,
        contact: user.phone
      },
      notes: {
        dealId
      },
      theme: {
        color: '#3b82f6'
      },
      method: {
        upi: true, // Enable UPI
        card: true,
        netbanking: true,
        wallet: true
      }
    };
    
    const razorpay = new window.Razorpay(options);
    razorpay.open();
    
  } catch (error) {
    toast.error('Failed to open payment gateway');
  }
};

const verifyPayment = async (paymentResponse, dealId) => {
  try {
    const res = await fetch('http://localhost:5000/api/payment/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        dealId
      })
    });
    
    if (res.ok) {
      toast.success('Payment successful! Funds held in escrow.');
      // Show address form
      setShowAddressForm(true);
      setSelectedDealId(dealId);
    }
  } catch (error) {
    toast.error('Payment verification failed');
  }
};
```

### Step 4: Share Shipping Address
```javascript
const shareAddress = async (dealId, addressData) => {
  try {
    const res = await fetch('http://localhost:5000/api/payment/share-address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        dealId,
        shippingDetails: addressData
      })
    });
    
    if (res.ok) {
      toast.success('Address shared with cardholder!');
    }
  } catch (error) {
    toast.error('Failed to share address');
  }
};
```

### Step 5: Cardholder Places Order
**CardholderDashboard.jsx**:
```javascript
useEffect(() => {
  socket.on('addressReceived', (data) => {
    toast.success('Buyer shared address! You can place order now.');
    setDealWithAddress(data);
  });
  
  return () => socket.off('addressReceived');
}, []);

const submitOrder = async (dealId, orderId, invoiceFile) => {
  try {
    // Upload invoice (optional - implement file upload if needed)
    let invoiceUrl = null;
    if (invoiceFile) {
      const formData = new FormData();
      formData.append('invoice', invoiceFile);
      // Upload to your server or cloud storage
    }
    
    const res = await fetch('http://localhost:5000/api/payment/submit-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        dealId,
        orderId,
        invoiceUrl
      })
    });
    
    if (res.ok) {
      toast.success('Order details submitted!');
    }
  } catch (error) {
    toast.error('Failed to submit order');
  }
};
```

### Step 6: Auto-Shipping Detection & Disbursement

**Create `backend/utils/shippingTracker.js`**:
```javascript
import cron from 'node-cron';
import Deal from '../models/Deal.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { capturePayment } from './razorpayConfig.js';
import { io } from '../server.js';

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('🔍 Checking shipping status for active deals...');
  
  try {
    // Find deals waiting for shipping
    const deals = await Deal.find({
      status: 'order_placed',
      orderIdFromCardholder: { $ne: null }
    }).populate('buyerId cardholderId');
    
    for (const deal of deals) {
      try {
        const shipped = await checkShippingStatus(deal);
        
        if (shipped) {
          // Update deal
          deal.status = 'shipped';
          deal.shippedAt = new Date();
          await deal.save();
          
          console.log(`✅ Deal ${deal._id} marked as shipped`);
          
          // Notify both parties
          io.to(`deal_${deal._id}`).emit('shippingStatusChanged', {
            dealId: deal._id,
            status: 'shipped',
            message: 'Order has been shipped!'
          });
          
          // Auto-capture payment after 1 hour (gives time for verification)
          setTimeout(async () => {
            try {
              await autoCaptureAndDisburse(deal._id);
            } catch (err) {
              console.error('Auto-capture failed:', err);
            }
          }, 60 * 60 * 1000); // 1 hour delay
        }
      } catch (err) {
        console.error(`Error checking deal ${deal._id}:`, err);
      }
    }
  } catch (error) {
    console.error('Shipping tracker error:', error);
  }
});

async function checkShippingStatus(deal) {
  // Try to scrape tracking status from product URL
  try {
    const trackingUrl = deal.trackingUrl || deal.product.url;
    
    if (!trackingUrl) return false;
    
    const response = await axios.get(trackingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Check for common "shipped" indicators
    const shippingTexts = [
      'shipped', 'dispatched', 'in transit', 'out for delivery',
      'Order Dispatched', 'Order Shipped'
    ];
    
    const pageText = $('body').text().toLowerCase();
    
    for (const text of shippingTexts) {
      if (pageText.includes(text.toLowerCase())) {
        console.log(`✅ Shipping detected for deal ${deal._id}: "${text}"`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Shipping check error:', error.message);
    return false;
  }
}

async function autoCaptureAndDisburse(dealId) {
  try {
    const deal = await Deal.findById(dealId).populate('cardholderId');
    
    if (!deal || deal.status !== 'shipped') {
      return;
    }
    
    // Capture payment from escrow
    const productPrice = deal.product.price;
    const commission = deal.commissionAmount;
    const totalAmount = productPrice + commission;
    
    await capturePayment(deal.razorpayPaymentId, totalAmount);
    
    deal.escrowStatus = 'captured';
    deal.paymentStatus = 'captured';
    deal.status = 'payment_captured';
    await deal.save();
    
    console.log(`✅ Payment auto-captured for deal ${dealId}`);
    
    // Trigger payout API
    const token = process.env.INTERNAL_API_TOKEN; // Create an internal token
    await fetch('http://localhost:5000/api/payment/initiate-payout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ dealId })
    });
    
  } catch (error) {
    console.error('Auto-capture/disburse error:', error);
  }
}

export { checkShippingStatus };
```

**Add to server.js**:
```javascript
import './utils/shippingTracker.js'; // Add this line
```

## 🔒 Security Considerations

1. **Redis Locks for First-to-Accept**:
   Update `dealsController.js` acceptDeal:
   ```javascript
   import redisClient from '../utils/redisClient.js';
   
   export const acceptDeal = async (req, res) => {
     const { id } = req.params;
     const cardholderId = req.user.id;
     
     // Try to acquire lock
     const lockKey = `deal_lock_${id}`;
     const locked = await redisClient.set(lockKey, cardholderId, {
       NX: true,
       EX: 10 // 10 seconds
     });
     
     if (!locked) {
       return res.status(400).json({ message: 'Deal already being accepted by another cardholder' });
     }
     
     try {
       const deal = await Deal.findById(id);
       
       if (!deal || deal.status !== 'pending') {
         await redisClient.del(lockKey);
         return res.status(400).json({ message: 'Deal not available' });
       }
       
       // Assign cardholder
       deal.cardholderId = cardholderId;
       deal.status = 'matched';
       deal.acceptedAt = new Date();
       await deal.save();
       
       // Notify via Socket.io
       io.to('cardholders').emit('dealTaken', { dealId: id });
       io.to(`user_${deal.buyerId}`).emit('dealAccepted', {
         dealId: id,
         cardholder: cardholderId
       });
       
       await redisClient.del(lockKey);
       
       res.status(200).json({ success: true, deal });
     } catch (error) {
       await redisClient.del(lockKey);
       throw error;
     }
   };
   ```

2. **Auto-Refund if Not Shipped in 7 Days**:
   Add to shippingTracker.js:
   ```javascript
   cron.schedule('0 0 * * *', async () => {
     const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
     
     const expiredDeals = await Deal.find({
       status: 'order_placed',
       orderPlacedAt: { $lt: sevenDaysAgo }
     });
     
     for (const deal of expiredDeals) {
       try {
         await voidPayment(deal.razorpayPaymentId);
         deal.status = 'refunded';
         deal.paymentStatus = 'refunded';
         await deal.save();
         
         io.to(`deal_${deal._id}`).emit('dealRefunded', {
           dealId: deal._id,
           reason: 'Not shipped within 7 days'
         });
       } catch (err) {
         console.error('Auto-refund failed:', err);
       }
     }
   });
   ```

## 🧪 Testing Guide

### Test Mode Setup:
1. Use Razorpay test keys (rzp_test_...)
2. **Test UPI VPAs**:
   - `success@razorpay` - Payment succeeds
   - `failure@razorpay` - Payment fails
3. **Test Cards**:
   - Card: 4111 1111 1111 1111
   - CVV: Any 3 digits
   - Expiry: Any future date

### Complete Flow Test:
1. **Buyer creates deal** → Check Socket.io logs for "newDeal" broadcast
2. **Cardholder accepts** → First one wins, others get "deal taken"
3. **Buyer pays via Razorpay** → Use test UPI `success@razorpay`
4. **Verify payment** → Check deal status = "payment_authorized"
5. **Share address** → Cardholder receives via Socket.io
6. **Cardholder submits order** → Deal status = "order_placed"
7. **Manual shipping update** (for testing):
   ```javascript
   // In backend, create test endpoint
   router.post('/test/mark-shipped', async (req, res) => {
     const deal = await Deal.findById(req.body.dealId);
     deal.status = 'shipped';
     deal.shippedAt = new Date();
     await deal.save();
     res.json({ success: true });
   });
   ```
8. **Auto-capture & disburse** → Check console logs

## 📝 Next Steps

1. ✅ Update frontend dashboards with Razorpay integration
2. ✅ Add address form components
3. ✅ Add order ID submission form
4. ✅ Implement file upload for invoices (use multer)
5. ✅ Add profile management pages for payment details
6. ✅ Test complete flow with Razorpay test mode
7. ✅ Add error boundaries and loading states
8. ✅ Implement shipping tracker cron job
9. ✅ Add notification toasts for all socket events

## 🔗 Useful Resources

- Razorpay Test Mode: https://razorpay.com/docs/payments/payments/test-card-upi-details/
- Socket.io Docs: https://socket.io/docs/v4/
- UPI Integration: https://razorpay.com/docs/payments/payment-methods/upi/

---

**Need help with specific implementation?** Let me know which part you want detailed next!
