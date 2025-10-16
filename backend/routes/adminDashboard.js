import express from 'express';
import Deal from '../models/Deal.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Get all deals for admin dashboard
 * GET /api/admin/deals
 */
router.get('/deals', verifyToken, async (req, res) => {
  try {
    // Optional: Add admin role check
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Forbidden: Admin access required' });
    // }

    // Fetch all deals with populated buyer and cardholder details
    const deals = await Deal.find()
      .populate('buyerId', 'name email')
      .populate('cardholderId', 'name email')
      .sort({ createdAt: -1 }) // Latest first
      .limit(100); // Limit to last 100 deals

    console.log(`📊 Admin fetched ${deals.length} deals`);

    res.status(200).json({
      success: true,
      deals,
      count: deals.length
    });
  } catch (error) {
    console.error('❌ Error fetching deals for admin:', error);
    res.status(500).json({ error: 'Failed to fetch deals', details: error.message });
  }
});

/**
 * Get deal statistics
 * GET /api/admin/stats
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const totalDeals = await Deal.countDocuments();
    const pendingDeals = await Deal.countDocuments({ status: 'pending' });
    const matchedDeals = await Deal.countDocuments({ status: 'matched' });
    const orderPlaced = await Deal.countDocuments({ status: 'order_placed' });
    const shipped = await Deal.countDocuments({ status: 'shipped' });
    const completed = await Deal.countDocuments({ 
      status: { $in: ['completed', 'disbursed', 'payment_captured'] } 
    });
    const expired = await Deal.countDocuments({ status: 'expired' });
    
    const totalBuyers = await User.countDocuments({ role: 'buyer' });
    const totalCardholders = await User.countDocuments({ role: 'cardholder' });

    res.status(200).json({
      success: true,
      stats: {
        deals: {
          total: totalDeals,
          pending: pendingDeals,
          matched: matchedDeals,
          orderPlaced,
          shipped,
          completed,
          expired
        },
        users: {
          buyers: totalBuyers,
          cardholders: totalCardholders,
          total: totalBuyers + totalCardholders
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * Get specific deal details
 * GET /api/admin/deals/:id
 */
router.get('/deals/:id', verifyToken, async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('buyerId', 'name email phone')
      .populate('cardholderId', 'name email phone cardholderPayoutDetails');

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    res.status(200).json({
      success: true,
      deal
    });
  } catch (error) {
    console.error('❌ Error fetching deal details:', error);
    res.status(500).json({ error: 'Failed to fetch deal details' });
  }
});

export default router;
