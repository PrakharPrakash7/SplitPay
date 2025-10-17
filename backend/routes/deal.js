import express from "express";

import { createDeal, acceptDeal, getAllDeals } from "../controllers/dealsController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import Deal from "../models/Deal.js";

const router = express.Router();

// Buyer creates a new deal
router.post("/", verifyToken, createDeal);
router.post("/:id/accept", verifyToken, acceptDeal); 

// Get all deals (for testing/monitoring)
router.get("/", verifyToken, getAllDeals);

// Mark order as received (buyer only)
router.post("/:id/mark-received", verifyToken, async (req, res) => {
  try {
    const dealId = req.params.id;
    const buyerId = req.user.id; // Changed from req.user.userId to req.user.id

    console.log(`🔍 Mark as received request - DealID: ${dealId}, BuyerID: ${buyerId}`);

    // Find the deal
    const deal = await Deal.findById(dealId);
    
    if (!deal) {
      console.log("❌ Deal not found");
      return res.status(404).json({ error: "Deal not found" });
    }

    console.log(`📦 Deal found - BuyerID in deal: ${deal.buyerId}, Requesting user: ${buyerId}`);

    // Verify the user is the buyer
    if (deal.buyerId.toString() !== buyerId.toString()) {
      console.log("❌ User is not the buyer of this deal");
      return res.status(403).json({ error: "Only the buyer can mark the order as received" });
    }

    // Check if deal is in disbursed status
    if (deal.status !== 'disbursed') {
      console.log(`❌ Deal status is ${deal.status}, not disbursed`);
      return res.status(400).json({ 
        error: "Order can only be marked as received after payment has been disbursed",
        currentStatus: deal.status 
      });
    }

    // Update status to completed
    deal.status = 'completed';
    deal.completedAt = new Date();
    await deal.save();

    console.log(`✅ Deal ${dealId} marked as completed by buyer`);

    // Emit Socket.io event to notify cardholder
    const io = req.app.get('io');
    if (io) {
      io.emit('dealCompleted', {
        dealId: deal._id,
        message: '✅ Buyer has received the order! Deal completed.',
        completedAt: deal.completedAt
      });
    }

    res.json({ 
      success: true, 
      message: "Order marked as received successfully",
      deal: {
        _id: deal._id,
        status: deal.status,
        completedAt: deal.completedAt
      }
    });

  } catch (error) {
    console.error("❌ Error marking order as received:", error);
    res.status(500).json({ error: "Failed to mark order as received" });
  }
});

export default router;
