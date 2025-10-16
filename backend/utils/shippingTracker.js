import cron from 'node-cron';
import Deal from '../models/Deal.js';
import User from '../models/User.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { capturePayment, voidPayment, createPayout, createUPIPayout } from './razorpayConfig.js';
import { io } from '../server.js';

/**
 * Auto-check shipping status every 6 hours
 * Cron schedule: 0 star-slash-6 star star star (runs every 6 hours)
 */
export const startShippingTracker = () => {
  console.log('📦 Shipping tracker initialized');

  // Check for shipped orders every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('🔍 [Shipping Tracker] Checking shipping status...');
    await checkAllOrdersForShipping();
  });

  // Check for expired deals (not shipped in 7 days) - runs daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ [Expiry Checker] Checking for expired deals...');
    await autoRefundExpiredDeals();
  });

  console.log('✅ Shipping tracker cron jobs scheduled');
};

/**
 * Check all active orders for shipping status
 */
async function checkAllOrdersForShipping() {
  try {
    // Find deals waiting for shipping confirmation
    const deals = await Deal.find({
      status: 'order_placed',
      orderIdFromCardholder: { $ne: null }
    }).populate('buyerId cardholderId');

    console.log(`📊 Found ${deals.length} deals waiting for shipping`);

    for (const deal of deals) {
      try {
        const shipped = await checkShippingStatus(deal);

        if (shipped) {
          await markAsShipped(deal);
        }
      } catch (err) {
        console.error(`❌ Error checking deal ${deal._id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('❌ Shipping tracker error:', error);
  }
}

/**
 * Check if order has been shipped (scrape tracking page)
 * @param {Object} deal - Deal document
 * @returns {boolean} - True if shipped
 */
async function checkShippingStatus(deal) {
  try {
    const trackingUrl = deal.trackingUrl || deal.product.url;

    if (!trackingUrl) {
      console.log(`⚠️ No tracking URL for deal ${deal._id}`);
      return false;
    }

    console.log(`🔎 Checking shipping for deal ${deal._id}: ${trackingUrl}`);

    const response = await axios.get(trackingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // Common shipping status keywords
    const shippingKeywords = [
      'shipped',
      'dispatched',
      'in transit',
      'out for delivery',
      'order dispatched',
      'order shipped',
      'on the way',
      'tracking number'
    ];

    const pageText = $('body').text().toLowerCase();

    for (const keyword of shippingKeywords) {
      if (pageText.includes(keyword)) {
        console.log(`✅ Shipping detected for deal ${deal._id}: "${keyword}"`);
        return true;
      }
    }

    // Check for specific selectors (Flipkart/Amazon)
    const shippingSelectors = [
      '.shipped-text',
      '.delivery-status',
      '[data-status="shipped"]',
      '.tracking-info'
    ];

    for (const selector of shippingSelectors) {
      if ($(selector).length > 0) {
        console.log(`✅ Shipping element found for deal ${deal._id}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`❌ Shipping check error for deal ${deal._id}:`, error.message);
    return false;
  }
}

/**
 * Mark deal as shipped and start auto-capture process
 * @param {Object} deal - Deal document
 */
async function markAsShipped(deal) {
  try {
    deal.status = 'shipped';
    deal.shippedAt = new Date();
    await deal.save();

    console.log(`✅ Deal ${deal._id} marked as SHIPPED`);

    // Notify both parties via Socket.io
    io.to(`deal_${deal._id}`).emit('shippingStatusChanged', {
      dealId: deal._id,
      status: 'shipped',
      message: '🚚 Order has been shipped!'
    });

    // Notify buyer specifically
    io.to(`user_${deal.buyerId}`).emit('orderShipped', {
      dealId: deal._id,
      productTitle: deal.product.title,
      message: '🎉 Your order has been shipped!'
    });

    // Wait 1 hour before auto-capturing (gives time for any disputes)
    setTimeout(async () => {
      try {
        await autoCaptureAndDisburse(deal._id);
      } catch (err) {
        console.error(`❌ Auto-capture failed for deal ${deal._id}:`, err.message);
      }
    }, 60 * 60 * 1000); // 1 hour = 3600000ms

    console.log(`⏳ Auto-capture scheduled for deal ${deal._id} in 1 hour`);
  } catch (error) {
    console.error(`❌ Failed to mark deal ${deal._id} as shipped:`, error);
  }
}

/**
 * Auto-capture payment and disburse to cardholder
 * @param {string} dealId - Deal ID
 */
async function autoCaptureAndDisburse(dealId) {
  try {
    const deal = await Deal.findById(dealId).populate('buyerId cardholderId');

    if (!deal) {
      console.error(`❌ Deal ${dealId} not found`);
      return;
    }

    if (deal.status !== 'shipped') {
      console.log(`⚠️ Deal ${dealId} not in shipped status, skipping capture`);
      return;
    }

    if (deal.escrowStatus === 'captured') {
      console.log(`⚠️ Deal ${dealId} payment already captured`);
      return;
    }

    // Calculate amounts
    const productPrice = deal.product.price;
    const commission = deal.commissionAmount || Math.round(productPrice * 0.05);
    const totalAmount = productPrice + commission;

    console.log(`💰 Capturing payment for deal ${dealId}: ₹${totalAmount}`);

    // Capture payment from Razorpay
    await capturePayment(deal.razorpayPaymentId, totalAmount);

    // Update deal
    deal.escrowStatus = 'captured';
    deal.paymentStatus = 'captured';
    deal.status = 'payment_captured';
    await deal.save();

    console.log(`✅ Payment captured for deal ${dealId}`);

    // Notify both parties
    io.to(`deal_${dealId}`).emit('paymentCaptured', {
      dealId,
      amount: totalAmount,
      message: '💰 Payment captured! Processing disbursement...'
    });

    // Initiate payout to cardholder
    await initiateAutoPayou(deal);
  } catch (error) {
    console.error(`❌ Auto-capture/disburse error for deal ${dealId}:`, error);
    
    // Mark as failed
    try {
      const deal = await Deal.findById(dealId);
      if (deal) {
        deal.disbursementStatus = 'failed';
        await deal.save();
      }
    } catch (updateErr) {
      console.error('Failed to update disbursement status:', updateErr);
    }
  }
}

/**
 * Initiate payout to cardholder automatically
 * @param {Object} deal - Deal document (populated)
 */
async function initiateAutoPayout(deal) {
  try {
    const cardholder = deal.cardholderId;
    const productPrice = deal.product.price;
    const payoutAmount = productPrice;

    console.log(`💸 Initiating payout for deal ${deal._id}: ₹${payoutAmount} to ${cardholder.name}`);

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
        deal._id,
        cardholder.name
      );
      console.log(`✅ UPI payout created: ${payout.id}`);
    } else if (payoutDetails.accountType === 'bank_account' && payoutDetails.bankAccount) {
      // Bank Transfer Payout
      payout = await createPayout(
        payoutDetails.bankAccount.accountNumber,
        payoutDetails.bankAccount.ifsc,
        payoutAmount,
        deal._id,
        cardholder.name
      );
      console.log(`✅ Bank payout created: ${payout.id}`);
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
    cardholder.stats.completedDeals = (cardholder.stats.completedDeals || 0) + 1;
    cardholder.stats.totalEarnings = (cardholder.stats.totalEarnings || 0) + payoutAmount;
    await cardholder.save();

    // Update buyer stats
    const buyer = await User.findById(deal.buyerId);
    if (buyer) {
      buyer.stats.completedDeals = (buyer.stats.completedDeals || 0) + 1;
      buyer.stats.totalSavings = (buyer.stats.totalSavings || 0) + (deal.product.price * deal.discountPct / 100);
      await buyer.save();
    }

    console.log(`✅ Payout initiated for deal ${deal._id}`);

    // Notify cardholder
    io.to(`user_${cardholder._id}`).emit('payoutInitiated', {
      dealId: deal._id,
      amount: payoutAmount,
      payoutId: payout.id,
      accountType: payoutDetails.accountType,
      message: `💸 Payout of ₹${payoutAmount} initiated! Money will be credited to your ${payoutDetails.accountType === 'upi' ? 'UPI account' : 'bank account'} soon.`
    });

    // Notify buyer that deal is complete
    io.to(`user_${deal.buyerId}`).emit('dealCompleted', {
      dealId: deal._id,
      productTitle: deal.product.title,
      message: '🎉 Deal completed successfully! Enjoy your purchase.'
    });

    // Mark as completed after 5 minutes (simulating payout processing time)
    setTimeout(async () => {
      try {
        deal.disbursementStatus = 'completed';
        deal.status = 'completed';
        await deal.save();

        io.to(`user_${cardholder._id}`).emit('payoutCompleted', {
          dealId: deal._id,
          amount: payoutAmount,
          message: '✅ Payout completed! Money credited to your account.'
        });

        console.log(`✅ Deal ${deal._id} marked as COMPLETED`);
      } catch (err) {
        console.error('Failed to mark payout as completed:', err);
      }
    }, 5 * 60 * 1000); // 5 minutes
  } catch (error) {
    console.error(`❌ Auto-payout error for deal ${deal._id}:`, error);
    throw error;
  }
}

/**
 * Auto-refund deals not shipped within 7 days
 */
async function autoRefundExpiredDeals() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const expiredDeals = await Deal.find({
      status: 'order_placed',
      orderPlacedAt: { $lt: sevenDaysAgo },
      paymentStatus: 'authorized'
    }).populate('buyerId cardholderId');

    console.log(`📊 Found ${expiredDeals.length} expired deals to refund`);

    for (const deal of expiredDeals) {
      try {
        console.log(`🔄 Refunding deal ${deal._id} (not shipped in 7 days)`);

        // Void/Refund payment
        await voidPayment(deal.razorpayPaymentId);

        // Update deal
        deal.status = 'refunded';
        deal.paymentStatus = 'refunded';
        deal.escrowStatus = 'refunded';
        await deal.save();

        console.log(`✅ Deal ${deal._id} refunded`);

        // Notify both parties
        io.to(`deal_${deal._id}`).emit('dealRefunded', {
          dealId: deal._id,
          reason: 'Order not shipped within 7 days',
          message: '🔄 Deal cancelled. Payment refunded to buyer.'
        });

        // Notify buyer
        io.to(`user_${deal.buyerId}`).emit('paymentRefunded', {
          dealId: deal._id,
          productTitle: deal.product.title,
          message: '💰 Payment refunded! Deal not fulfilled within 7 days.'
        });

        // Notify cardholder
        io.to(`user_${deal.cardholderId}`).emit('dealCancelled', {
          dealId: deal._id,
          reason: 'Not shipped in time',
          message: '❌ Deal cancelled due to non-shipment.'
        });
      } catch (refundErr) {
        console.error(`❌ Failed to refund deal ${deal._id}:`, refundErr.message);
      }
    }
  } catch (error) {
    console.error('❌ Auto-refund error:', error);
  }
}

// Export for manual testing/triggering
export { checkShippingStatus, autoCaptureAndDisburse, autoRefundExpiredDeals };
