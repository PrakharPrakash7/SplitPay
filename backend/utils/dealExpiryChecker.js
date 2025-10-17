import Deal from '../models/Deal.js';
import { io } from '../server.js';

/**
 * Check and expire deals that have exceeded their timers
 * Runs every minute
 */
export async function checkDealExpiry() {
  try {
    const now = new Date();

    // 1. Check initial deal expiry (5 minutes after creation)
    const expiredDeals = await Deal.find({
      status: 'pending',
      expiresAt: { $lte: now }
    });

    for (const deal of expiredDeals) {
      deal.status = 'expired';
      deal.cancelledBy = 'system';
      deal.cancelledAt = now;
      deal.cancelReason = 'No cardholder accepted within 5 minutes';
      await deal.save();
      
      console.log(`⏰ Deal ${deal._id} expired - no acceptance`);
      
      // Notify buyer
      io.to(`user_${deal.buyerId}`).emit('dealExpired', {
        dealId: deal._id,
        message: 'Deal expired - no cardholder accepted'
      });
    }

    // 2. Check payment expiry (15 minutes after acceptance)
    const paymentExpired = await Deal.find({
      status: 'matched',
      paymentExpiresAt: { $lte: now, $ne: null }
    });

    for (const deal of paymentExpired) {
      deal.status = 'expired';
      deal.cancelledBy = 'system';
      deal.cancelledAt = now;
      deal.cancelReason = 'Buyer did not pay within 15 minutes';
      await deal.save();
      
      console.log(`⏰ Deal ${deal._id} expired - no payment`);
      
      // Notify both parties
      io.to(`user_${deal.buyerId}`).emit('dealExpired', {
        dealId: deal._id,
        message: 'Deal expired - payment time exceeded'
      });
      
      if (deal.cardholderId) {
        io.to(`user_${deal.cardholderId}`).emit('dealExpired', {
          dealId: deal._id,
          message: 'Deal expired - buyer did not pay'
        });
      }
    }

    // 3. Check address sharing expiry (15 minutes after payment)
    const addressExpired = await Deal.find({
      status: 'payment_authorized',
      addressExpiresAt: { $lte: now, $ne: null }
    });

    for (const deal of addressExpired) {
      // Refund the payment
      deal.status = 'refunded';
      deal.escrowStatus = 'refunded';
      deal.paymentStatus = 'refunded';
      deal.cancelledBy = 'system';
      deal.cancelledAt = now;
      deal.cancelReason = 'Buyer did not share address within 15 minutes';
      await deal.save();
      
      console.log(`⏰ Deal ${deal._id} expired - no address shared (refunding)`);
      
      // Notify both parties
      io.to(`user_${deal.buyerId}`).emit('dealExpired', {
        dealId: deal._id,
        message: 'Deal expired - payment refunded (address not shared in time)'
      });
      
      if (deal.cardholderId) {
        io.to(`user_${deal.cardholderId}`).emit('dealExpired', {
          dealId: deal._id,
          message: 'Deal expired - buyer did not share address'
        });
      }
    }

    // 4. Check order submission expiry (15 minutes after address shared)
    const orderExpired = await Deal.find({
      status: 'address_shared',
      orderExpiresAt: { $lte: now, $ne: null }
    });

    for (const deal of orderExpired) {
      // Refund the payment
      deal.status = 'refunded';
      deal.escrowStatus = 'refunded';
      deal.paymentStatus = 'refunded';
      deal.cancelledBy = 'system';
      deal.cancelledAt = now;
      deal.cancelReason = 'Cardholder did not submit order within 15 minutes';
      await deal.save();
      
      console.log(`⏰ Deal ${deal._id} expired - no order submitted (refunding)`);
      
      // Notify both parties
      io.to(`user_${deal.buyerId}`).emit('dealExpired', {
        dealId: deal._id,
        message: 'Deal expired - payment refunded (order not placed in time)'
      });
      
      if (deal.cardholderId) {
        io.to(`user_${deal.cardholderId}`).emit('dealExpired', {
          dealId: deal._id,
          message: 'Deal expired - order not submitted in time'
        });
      }
    }

    const totalExpired = expiredDeals.length + paymentExpired.length + addressExpired.length + orderExpired.length;
    if (totalExpired > 0) {
      console.log(`⏰ Expired ${totalExpired} deals`);
    }

  } catch (error) {
    console.error('❌ Error checking deal expiry:', error);
  }
}

/**
 * Start the expiry checker (runs every minute)
 */
export function startExpiryChecker() {
  // Run immediately
  checkDealExpiry();
  
  // Then run every minute
  setInterval(checkDealExpiry, 60 * 1000); // 1 minute
  
  console.log('✅ Deal expiry checker started (runs every 1 minute)');
}
