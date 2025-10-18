import express from 'express';
import {
  createOrder,
  verifyPaymentSignature,
  capturePayment,
  voidPayment,
  createPayout,
  createUPIPayout,
  verifyWebhookSignature
} from '../utils/razorpayConfig.js';
import Deal from '../models/Deal.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { io } from '../server.js';
import admin from '../utils/firebaseAdmin.js';

const router = express.Router();

/**
 * Create Razorpay order for buyer payment (with escrow hold)
 * POST /api/payment/create-order
 */
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { dealId } = req.body;
    const buyerId = req.user.id;

    // Fetch deal
    const deal = await Deal.findById(dealId);
    
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Convert both IDs to strings for comparison
    const dealBuyerId = deal.buyerId.toString();
    const requestBuyerId = buyerId.toString();
    
    console.log(`🔍 Checking deal ownership: Deal buyer=${dealBuyerId}, Request buyer=${requestBuyerId}`);

    if (dealBuyerId !== requestBuyerId) {
      console.error(`❌ Unauthorized: Deal belongs to ${dealBuyerId}, but request from ${requestBuyerId}`);
      return res.status(403).json({ 
        error: 'Unauthorized: Not your deal',
        dealBuyer: dealBuyerId,
        requestBuyer: requestBuyerId
      });
    }

    if (deal.status !== 'matched') {
      return res.status(400).json({ error: `Cannot create order for deal with status: ${deal.status}` });
    }

    // Calculate total amount (product price + 5% commission)
    const productPrice = deal.product.price;
    const commission = Math.round(productPrice * 0.05); // 5% commission
    const totalAmount = productPrice + commission;

    // Create Razorpay order with payment hold (escrow)
    const order = await createOrder(totalAmount, dealId, {
      buyerId: buyerId,
      cardholderId: deal.cardholderId.toString(),
      productPrice,
      commission
    });

    // Update deal with Razorpay order details
    deal.razorpayOrderId = order.id;
    deal.status = 'awaiting_payment';
    deal.paymentStatus = 'pending';
    deal.commissionAmount = commission;
    await deal.save();

    console.log(`✅ Order created for deal ${dealId}: ${order.id} (₹${totalAmount})`);

    // Notify buyer via Socket.io
    io.to(`user_${buyerId}`).emit('orderCreated', {
      dealId,
      orderId: order.id,
      amount: totalAmount,
      productPrice,
      commission
    });

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount, // In paise
        amountInRupees: totalAmount,
        currency: order.currency,
        productPrice,
        commission
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

/**
 * Verify payment after Razorpay success
 * POST /api/payment/verify-payment
 */
router.post('/verify-payment', verifyToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dealId } = req.body;
    const buyerId = req.user.id;

    // Verify signature
    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Find deal and update
    const deal = await Deal.findById(dealId);
    
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Convert both IDs to strings for comparison
    if (deal.buyerId.toString() !== buyerId.toString()) {
      console.error(`❌ Payment verification unauthorized: Deal buyer=${deal.buyerId}, Request buyer=${buyerId}`);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update deal with payment details
    deal.razorpayPaymentId = razorpay_payment_id;
    deal.status = 'payment_authorized';
    deal.paymentStatus = 'authorized';
    deal.escrowStatus = 'authorized';
    deal.paidAt = new Date();
    
    // Set 15 minute timer for buyer to share address
    const addressExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    deal.addressExpiresAt = addressExpiry;
    
    await deal.save();
    
    console.log(`✅ Payment verified for deal ${dealId}: ${razorpay_payment_id}`);
    console.log(`⏰ Address timer set: Address must be shared by ${addressExpiry.toLocaleTimeString()}`);

    // Notify both buyer and cardholder via Socket.io
    io.to(`deal_${dealId}`).emit('paymentAuthorized', {
      dealId,
      paymentId: razorpay_payment_id,
      message: 'Payment authorized successfully. Funds held in escrow.'
    });

    // Notify cardholder specifically
    io.to(`user_${deal.cardholderId}`).emit('buyerPaid', {
      dealId,
      message: 'Buyer has paid! Waiting for address to place order.'
    });

    // Send FCM push notification to cardholder
    try {
      const cardholder = await User.findById(deal.cardholderId);
      if (cardholder && cardholder.fcmToken) {
        await admin.messaging().send({
          token: cardholder.fcmToken,
          notification: {
            title: "💰 Buyer Has Paid!",
            body: `Payment received for ${deal.product.title.substring(0, 40)}. Waiting for shipping address...`,
          },
          data: {
            dealId: dealId,
            action: 'buyer_paid',
            status: deal.status
          }
        });
        console.log('✓ FCM notification sent to cardholder');
      }
    } catch (fcmError) {
      console.warn('⚠ FCM notification failed:', fcmError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and authorized',
      deal: {
        id: deal._id,
        status: deal.status,
        paymentStatus: deal.paymentStatus
      }
    });
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment', details: error.message });
  }
});

/**
 * Share shipping address with cardholder
 * POST /api/payment/share-address
 */
router.post('/share-address', verifyToken, async (req, res) => {
  try {
    const { dealId, shippingDetails } = req.body;
    const buyerId = req.user.id;

    const deal = await Deal.findById(dealId);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (deal.buyerId.toString() !== buyerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (deal.status !== 'payment_authorized') {
      return res.status(400).json({ error: 'Payment not authorized yet' });
    }

    // Validate shipping details
    if (!shippingDetails.name || !shippingDetails.mobile || !shippingDetails.addressLine1 || 
        !shippingDetails.city || !shippingDetails.state || !shippingDetails.pincode) {
      return res.status(400).json({ error: 'Incomplete shipping details' });
    }

    // Update deal with shipping details
    deal.shippingDetails = shippingDetails;
    deal.status = 'address_shared';
    deal.addressSharedAt = new Date();
    
    // Set 15 minute timer for cardholder to submit order
    const orderExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    deal.orderExpiresAt = orderExpiry;
    
    await deal.save();

    console.log(`✅ Address shared for deal ${dealId}`);
    console.log(`⏰ Order timer set: Order must be submitted by ${orderExpiry.toLocaleTimeString()}`);

    // Notify cardholder via Socket.io with address details
    io.to(`user_${deal.cardholderId}`).emit('addressReceived', {
      dealId,
      address: shippingDetails, // Frontend expects 'address' not 'shippingDetails'
      product: {
        title: deal.product.title,
        url: deal.product.url,
        price: deal.product.price,
        image: deal.product.image
      },
      message: 'Buyer shared address! You can now place the order.'
    });

    console.log(`📡 Socket.io event 'addressReceived' emitted to user_${deal.cardholderId}`);

    // Send FCM push notification to cardholder - THIS IS THE "NEW ORDER" NOTIFICATION
    try {
      const cardholder = await User.findById(deal.cardholderId);
      if (cardholder && cardholder.fcmToken) {
        await admin.messaging().send({
          token: cardholder.fcmToken,
          notification: {
            title: "📦 New Order Ready!",
            body: `Shipping address received for ${deal.product.title.substring(0, 35)}. Place order now!`,
          },
          data: {
            dealId: dealId,
            action: 'address_received',
            status: 'address_shared',
            productUrl: deal.product.url
          }
        });
        console.log('✓ FCM "New Order" notification sent to cardholder');
      }
    } catch (fcmError) {
      console.warn('⚠ FCM notification failed:', fcmError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Address shared with cardholder',
      deal: {
        id: deal._id,
        status: deal.status
      }
    });
  } catch (error) {
    console.error('❌ Error sharing address:', error);
    res.status(500).json({ error: 'Failed to share address', details: error.message });
  }
});

/**
 * Cardholder submits order ID and invoice
 * POST /api/payment/submit-order
 */
router.post('/submit-order', verifyToken, async (req, res) => {
  try {
    const { dealId, orderId, trackingUrl, invoiceUrl } = req.body;
    const cardholderId = req.user.id;

    const deal = await Deal.findById(dealId);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (deal.cardholderId.toString() !== cardholderId.toString()) {
      return res.status(403).json({ error: 'Unauthorized: Not your deal' });
    }

    if (deal.status !== 'address_shared') {
      return res.status(400).json({ error: 'Address not shared yet' });
    }

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!trackingUrl) {
      return res.status(400).json({ error: 'Tracking URL is required' });
    }

    if (!invoiceUrl) {
      return res.status(400).json({ error: 'Invoice URL is required' });
    }

    // Update deal with order details
    deal.orderIdFromCardholder = orderId;
    deal.trackingUrl = trackingUrl;
    deal.invoiceUrl = invoiceUrl;
    deal.status = 'order_placed';
    deal.orderPlacedAt = new Date();
    await deal.save();

    console.log(`✅ Order submitted for deal ${dealId}: ${orderId}`);
    console.log(`📦 Tracking URL: ${trackingUrl}`);
    console.log(`📄 Invoice URL: ${invoiceUrl}`);

    // Notify buyer via Socket.io
    io.to(`user_${deal.buyerId}`).emit('orderSubmitted', {
      dealId,
      orderId,
      trackingUrl,
      invoiceUrl,
      message: 'Cardholder placed your order! Waiting for shipping.'
    });

    console.log(`📡 Socket.io event 'orderSubmitted' emitted to user_${deal.buyerId}`);

    res.status(200).json({
      success: true,
      message: 'Order details submitted',
      deal: {
        id: deal._id,
        status: deal.status,
        orderId,
        trackingUrl,
        invoiceUrl
      }
    });
  } catch (error) {
    console.error('❌ Error submitting order:', error);
    res.status(500).json({ error: 'Failed to submit order', details: error.message });
  }
});

/**
 * Capture payment from escrow (when order is shipped)
 * POST /api/payment/capture-payment
 * Called automatically by shipping tracker or manually
 */
router.post('/capture-payment', verifyToken, async (req, res) => {
  try {
    const { dealId } = req.body;

    const deal = await Deal.findById(dealId).populate('buyerId cardholderId');

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (deal.status !== 'shipped') {
      return res.status(400).json({ error: 'Order not shipped yet' });
    }

    if (!deal.razorpayPaymentId) {
      return res.status(400).json({ error: 'No payment to capture' });
    }

    if (deal.escrowStatus === 'captured') {
      return res.status(400).json({ error: 'Payment already captured' });
    }

    // Calculate amounts
    const productPrice = deal.product.price;
    const commission = deal.commissionAmount || Math.round(productPrice * 0.05);
    const totalAmount = productPrice + commission;

    // Capture payment from Razorpay
    const payment = await capturePayment(deal.razorpayPaymentId, totalAmount);

    // Update deal
    deal.escrowStatus = 'captured';
    deal.paymentStatus = 'captured';
    deal.status = 'payment_captured';
    await deal.save();

    console.log(`✅ Payment captured for deal ${dealId}: ₹${totalAmount}`);

    // Notify both parties
    io.to(`deal_${dealId}`).emit('paymentCaptured', {
      dealId,
      amount: totalAmount,
      message: 'Payment captured! Initiating disbursement to cardholder.'
    });

    // Automatically initiate payout to cardholder
    try {
      await initiatePayoutTrigger(deal);
    } catch (payoutError) {
      console.warn('⚠️ Auto-payout failed, will retry:', payoutError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Payment captured successfully',
      deal: {
        id: deal._id,
        status: deal.status,
        escrowStatus: deal.escrowStatus
      }
    });
  } catch (error) {
    console.error('❌ Error capturing payment:', error);
    res.status(500).json({ error: 'Failed to capture payment', details: error.message });
  }
});

/**
 * Initiate payout to cardholder (called after payment capture)
 * POST /api/payment/initiate-payout
 */
router.post('/initiate-payout', verifyToken, async (req, res) => {
  try {
    const { dealId } = req.body;

    const deal = await Deal.findById(dealId).populate('cardholderId');

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (deal.escrowStatus !== 'captured') {
      return res.status(400).json({ error: 'Payment not captured yet' });
    }

    if (deal.disbursementStatus === 'completed') {
      return res.status(400).json({ error: 'Payout already completed' });
    }

    const cardholder = deal.cardholderId;
    const productPrice = deal.product.price;
    const payoutAmount = productPrice; // Cardholder gets product price back

    // Check cardholder payout details
    const payoutDetails = cardholder.cardholderPayoutDetails;

    if (!payoutDetails || !payoutDetails.accountType) {
      throw new Error('Cardholder payout details not configured');
    }

    let payout;

    if (payoutDetails.accountType === 'upi' && payoutDetails.upiVPA) {
      // UPI Payout
      payout = await createUPIPayout(
        payoutDetails.upiVPA,
        payoutAmount,
        dealId,
        cardholder.name
      );
    } else if (payoutDetails.accountType === 'bank_account' && payoutDetails.bankAccount) {
      // Bank Transfer Payout
      payout = await createPayout(
        payoutDetails.bankAccount.accountNumber,
        payoutDetails.bankAccount.ifsc,
        payoutAmount,
        dealId,
        cardholder.name
      );
    } else {
      throw new Error('Invalid payout configuration');
    }

    // Update deal with payout details
    deal.payoutId = payout.id;
    deal.payoutAmount = payoutAmount;
    deal.disbursementStatus = 'processing';
    deal.status = 'disbursed';
    deal.disbursedAt = new Date();
    deal.settled = true;
    await deal.save();

    // Update cardholder stats
    cardholder.stats.completedDeals += 1;
    cardholder.stats.totalEarnings += payoutAmount;
    await cardholder.save();

    console.log(`✅ Payout initiated for deal ${dealId}: ₹${payoutAmount} to ${cardholder.name}`);

    // Notify cardholder
    io.to(`user_${cardholder._id}`).emit('payoutInitiated', {
      dealId,
      amount: payoutAmount,
      payoutId: payout.id,
      message: `Payout of ₹${payoutAmount} initiated! Check your ${payoutDetails.accountType === 'upi' ? 'UPI' : 'bank account'}.`
    });

    // Notify buyer that deal is complete
    io.to(`user_${deal.buyerId}`).emit('dealCompleted', {
      dealId,
      message: 'Deal completed successfully! Enjoy your purchase.'
    });

    res.status(200).json({
      success: true,
      message: 'Payout initiated successfully',
      payout: {
        id: payout.id,
        amount: payoutAmount,
        status: payout.status
      }
    });
  } catch (error) {
    console.error('❌ Error initiating payout:', error);
    
    // Mark disbursement as failed
    try {
      const deal = await Deal.findById(req.body.dealId);
      if (deal) {
        deal.disbursementStatus = 'failed';
        await deal.save();
      }
    } catch (updateError) {
      console.error('Failed to update disbursement status:', updateError);
    }

    res.status(500).json({ error: 'Failed to initiate payout', details: error.message });
  }
});

/**
 * Void payment (refund if deal fails)
 * POST /api/payment/void-payment
 */
router.post('/void-payment', verifyToken, async (req, res) => {
  try {
    const { dealId, reason } = req.body;

    const deal = await Deal.findById(dealId);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (!deal.razorpayPaymentId) {
      return res.status(400).json({ error: 'No payment to void' });
    }

    if (deal.escrowStatus === 'captured') {
      return res.status(400).json({ error: 'Payment already captured, cannot void. Use refund instead.' });
    }

    // Void/Refund payment
    const refund = await voidPayment(deal.razorpayPaymentId);

    // Update deal
    deal.escrowStatus = 'refunded';
    deal.paymentStatus = 'refunded';
    deal.status = 'refunded';
    await deal.save();

    console.log(`✅ Payment voided for deal ${dealId}: ${reason}`);

    // Notify both parties
    io.to(`deal_${dealId}`).emit('paymentRefunded', {
      dealId,
      reason,
      message: 'Payment refunded to buyer.'
    });

    res.status(200).json({
      success: true,
      message: 'Payment voided/refunded successfully',
      refund
    });
  } catch (error) {
    console.error('❌ Error voiding payment:', error);
    res.status(500).json({ error: 'Failed to void payment', details: error.message });
  }
});

/**
 * TESTING ONLY: Admin endpoint to manually mark order as shipped
 * POST /api/payment/admin/mark-shipped
 * This bypasses the automatic shipping detection for testing purposes
 */
router.post('/admin/mark-shipped', verifyToken, async (req, res) => {
  try {
    const { dealId } = req.body;

    if (!dealId) {
      return res.status(400).json({ error: 'Deal ID is required' });
    }

    const deal = await Deal.findById(dealId).populate('buyerId cardholderId');

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Check if order has been placed
    if (deal.status !== 'order_placed') {
      return res.status(400).json({ 
        error: `Cannot mark as shipped. Current status: ${deal.status}. Order must be placed first.` 
      });
    }

    // Mark as shipped
    deal.status = 'shipped';
    deal.shippedAt = new Date();
    await deal.save();

    console.log(`🚚 [ADMIN TEST] Order marked as shipped for deal ${dealId}`);

    // Notify buyer
    io.to(`user_${deal.buyerId}`).emit('orderShipped', {
      dealId,
      message: 'Order has been shipped!'
    });

    // Notify cardholder
    io.to(`user_${deal.cardholderId}`).emit('orderShipped', {
      dealId,
      message: 'Order shipped! Payment will be captured soon.'
    });

    // Send FCM to buyer
    try {
      const buyer = await User.findById(deal.buyerId);
      if (buyer && buyer.fcmToken) {
        await admin.messaging().send({
          token: buyer.fcmToken,
          notification: {
            title: "🚚 Order Shipped!",
            body: `Your order has been shipped! Payment will be released to cardholder.`,
          },
          data: {
            dealId: dealId,
            action: 'order_shipped',
            status: 'shipped'
          }
        });
      }
    } catch (fcmError) {
      console.warn('⚠ FCM notification failed:', fcmError.message);
    }

    // Automatically capture payment (in production, this would happen after verification delay)
    // For testing, we do it immediately
    try {
      console.log('💰 [ADMIN TEST] Capturing payment immediately for testing...');
      
      const productPrice = deal.product.price;
      const commission = deal.commissionAmount || Math.round(productPrice * 0.05);
      const totalAmount = productPrice + commission;

      // Capture payment from Razorpay
      const payment = await capturePayment(deal.razorpayPaymentId, totalAmount);

      // Update deal
      deal.escrowStatus = 'captured';
      deal.paymentStatus = 'captured';
      deal.status = 'payment_captured';
      await deal.save();

      console.log(`✅ [ADMIN TEST] Payment captured: ₹${totalAmount}`);

      // Notify both parties
      io.to(`deal_${dealId}`).emit('paymentCaptured', {
        dealId,
        amount: totalAmount,
        message: 'Payment captured! Initiating payout...'
      });

      // Initiate payout
      await initiatePayoutTrigger(deal);

      res.status(200).json({
        success: true,
        message: '✅ Order marked as shipped and payment captured successfully!',
        deal: {
          id: deal._id,
          status: deal.status,
          escrowStatus: deal.escrowStatus,
          shippedAt: deal.shippedAt
        }
      });

    } catch (captureError) {
      console.error('❌ [ADMIN TEST] Payment capture failed:', captureError);
      res.status(200).json({
        success: true,
        message: '✅ Order marked as shipped (payment capture will be retried)',
        deal: {
          id: deal._id,
          status: 'shipped',
          shippedAt: deal.shippedAt
        },
        warning: 'Payment capture failed, will retry later'
      });
    }

  } catch (error) {
    console.error('❌ [ADMIN TEST] Error marking order as shipped:', error);
    res.status(500).json({ error: 'Failed to mark order as shipped', details: error.message });
  }
});

/**
 * Webhook handler for Razorpay events
 * POST /api/payment/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookBody = req.body.toString();

    // Verify webhook signature
    const isValid = verifyWebhookSignature(webhookBody, signature);

    if (!isValid) {
      console.warn('⚠️ Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(webhookBody);
    console.log(`📨 Razorpay webhook received: ${event.event}`);

    // Handle different webhook events
    switch (event.event) {
      case 'payment.authorized':
        await handlePaymentAuthorized(event.payload.payment.entity);
        break;
      
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      
      case 'payout.processed':
        await handlePayoutProcessed(event.payload.payout.entity);
        break;
      
      default:
        console.log(`ℹ️ Unhandled webhook event: ${event.event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Helper function to trigger payout
async function initiatePayoutTrigger(deal) {
  const cardholder = await User.findById(deal.cardholderId);
  const productPrice = deal.product.price;
  const payoutAmount = productPrice;

  const payoutDetails = cardholder.cardholderPayoutDetails;

  if (!payoutDetails || !payoutDetails.accountType) {
    throw new Error('Cardholder payout details not configured');
  }

  let payout;

  if (payoutDetails.accountType === 'upi' && payoutDetails.upiVPA) {
    payout = await createUPIPayout(payoutDetails.upiVPA, payoutAmount, deal._id, cardholder.name);
  } else if (payoutDetails.accountType === 'bank_account' && payoutDetails.bankAccount) {
    payout = await createPayout(
      payoutDetails.bankAccount.accountNumber,
      payoutDetails.bankAccount.ifsc,
      payoutAmount,
      deal._id,
      cardholder.name
    );
  }

  deal.payoutId = payout.id;
  deal.payoutAmount = payoutAmount;
  deal.disbursementStatus = 'processing';
  deal.status = 'disbursed';
  deal.disbursedAt = new Date();
  deal.settled = true;
  await deal.save();

  cardholder.stats.completedDeals += 1;
  cardholder.stats.totalEarnings += payoutAmount;
  await cardholder.save();

  io.to(`user_${cardholder._id}`).emit('payoutInitiated', {
    dealId: deal._id,
    amount: payoutAmount,
    payoutId: payout.id
  });
}

// Webhook event handlers
async function handlePaymentAuthorized(payment) {
  console.log(`✅ Payment authorized: ${payment.id}`);
  // Update deal if needed
}

async function handlePaymentCaptured(payment) {
  console.log(`✅ Payment captured: ${payment.id}`);
  // Update deal if needed
}

async function handlePaymentFailed(payment) {
  console.log(`❌ Payment failed: ${payment.id}`);
  const deal = await Deal.findOne({ razorpayPaymentId: payment.id });
  if (deal) {
    deal.paymentStatus = 'failed';
    deal.status = 'failed';
    await deal.save();
    
    io.to(`deal_${deal._id}`).emit('paymentFailed', {
      dealId: deal._id,
      message: 'Payment failed. Please try again.'
    });
  }
}

async function handlePayoutProcessed(payout) {
  console.log(`✅ Payout processed: ${payout.id}`);
  const deal = await Deal.findOne({ payoutId: payout.id });
  if (deal) {
    deal.disbursementStatus = 'completed';
    deal.status = 'completed';
    await deal.save();
    
    io.to(`user_${deal.cardholderId}`).emit('payoutCompleted', {
      dealId: deal._id,
      amount: payout.amount / 100,
      message: 'Payout completed! Money credited to your account.'
    });
  }
}

/**
 * Cancel deal (buyer or cardholder)
 * POST /api/payment/cancel-deal
 */
router.post('/cancel-deal', verifyToken, async (req, res) => {
  try {
    const { dealId, reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const deal = await Deal.findById(dealId);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Check authorization
    const isBuyer = deal.buyerId.toString() === userId.toString();
    const isCardholder = deal.cardholderId && deal.cardholderId.toString() === userId.toString();

    if (!isBuyer && !isCardholder) {
      return res.status(403).json({ error: 'Unauthorized to cancel this deal' });
    }

    // Check if deal can be cancelled
  if (['shipped', 'payment_captured', 'disbursed', 'completed', 'expired', 'refunded', 'cancelled'].includes(deal.status)) {
      return res.status(400).json({ error: 'Deal cannot be cancelled at this stage' });
    }

    // Handle refund if payment was made
    if (deal.razorpayPaymentId && deal.escrowStatus === 'authorized') {
      try {
        console.log(`💸 Initiating refund for payment ${deal.razorpayPaymentId}`);
        
        // In test mode, simulate refund
        console.log(`🧪 TEST MODE: Simulating refund for ${deal.razorpayPaymentId}`);
        
        deal.escrowStatus = 'refunded';
        deal.paymentStatus = 'refunded';
        
      } catch (refundError) {
        console.error('❌ Refund failed:', refundError);
        return res.status(500).json({ error: 'Failed to process refund' });
      }
    }

    // Update deal status
  deal.status = 'cancelled';
    deal.cancelledBy = isBuyer ? 'buyer' : 'cardholder';
    deal.cancelledAt = new Date();
    deal.cancelReason = reason || `Cancelled by ${isBuyer ? 'buyer' : 'cardholder'}`;
    await deal.save();

    console.log(`❌ Deal ${dealId} cancelled by ${deal.cancelledBy}`);

    // Notify the other party
    const notifyUserId = isBuyer ? deal.cardholderId : deal.buyerId;
    const cancellingParty = isBuyer ? 'buyer' : 'cardholder';
    
    if (notifyUserId) {
      io.to(`user_${notifyUserId}`).emit('dealCancelled', {
        dealId,
        cancelledBy: deal.cancelledBy,
        reason: deal.cancelReason,
        message: `Deal cancelled by ${deal.cancelledBy}`
      });
    }

    // Broadcast to both rooms
    const broadcastPayload = {
      dealId,
      cancelledBy: deal.cancelledBy,
      reason: deal.cancelReason,
      message: `Deal cancelled by ${deal.cancelledBy}`
    };
    io.to('buyers').emit('dealCancelled', broadcastPayload);
    io.to('cardholders').emit('dealCancelled', broadcastPayload);

    // Send FCM push notifications if available
    try {
      await deal.populate([
        { path: 'buyerId', select: 'fcmToken name' },
        { path: 'cardholderId', select: 'fcmToken name' }
      ]);

      const notifications = [];

      const title = 'Deal Cancelled';
      const body = `Deal ${deal._id} was cancelled by ${deal.cancelledBy}.`;

      if (deal.buyerId?.fcmToken) {
        notifications.push({ token: deal.buyerId.fcmToken });
      }

      if (deal.cardholderId?.fcmToken) {
        notifications.push({ token: deal.cardholderId.fcmToken });
      }

      for (const notify of notifications) {
        if (!notify.token || typeof admin?.messaging !== 'function') continue;
        await admin.messaging().send({
          token: notify.token,
          notification: { title, body },
          data: {
            dealId: deal._id.toString(),
            action: 'deal_cancelled',
            cancelledBy: deal.cancelledBy,
            reason: deal.cancelReason || ''
          }
        });
      }
    } catch (fcmError) {
      console.warn('⚠️ Failed to send deal cancellation FCM:', fcmError.message || fcmError);
    }

    res.status(200).json({
      success: true,
      message: 'Deal cancelled successfully',
      refunded: deal.escrowStatus === 'refunded'
    });
  } catch (error) {
    console.error('❌ Error cancelling deal:', error);
    res.status(500).json({ error: 'Failed to cancel deal', details: error.message });
  }
});

export default router;

