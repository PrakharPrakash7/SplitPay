import Deal from "../models/Deal.js";
import User from "../models/User.js";
import { fetchProduct } from "../utils/scrapeCache.js";
import admin from "../utils/firebaseAdmin.js"; // we'll make this file next
import redisClient from "../utils/redisClient.js";
import { sendDealNotificationEmail } from "../utils/emailService.js"; 
export const createDeal = async (req, res) => {
  try {
    const buyerId = req.user.id; // coming from JWT or Firebase auth middleware
    const { productUrl, url, totalPrice, myContribution, description, discountPct } = req.body;

    // Support both 'url' and 'productUrl' field names
    const productUrlToUse = productUrl || url;

    if (!productUrlToUse) {
      return res.status(400).json({ error: "Product URL is required" });
    }

    console.log("Fetching product from URL:", productUrlToUse);

    // fetch metadata from product URL (scraping or Redis cache)
    const product = await fetchProduct(productUrlToUse);
    
    console.log("Product fetched:", product);

    // Use provided totalPrice or fallback to scraped price
    const finalPrice = totalPrice || product.price;
    
    const discountedPrice = Math.round(
      finalPrice * (1 - (discountPct || 10) / 100)
    );

    const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 min expiry for testing

    const deal = await Deal.create({
      buyerId,
      product: {
        ...product,
        price: finalPrice,
      },
      discountPct: discountPct || 10,
      discountedPrice,
      expiresAt,
      description: description || `Deal for ${product.title}`,
    });


    // at the top

// after deal is created
    await redisClient.setEx(`deal_expiry_${deal._id}`, 900, "expire"); // 60 seconds


    console.log("Deal created successfully:", deal._id);

    // Notify all cardholders with FCM token and email
    const cardholders = await User.find({
      role: "cardholder",
    }).select("name email fcmToken");

    // Send FCM notifications (optional - skip if Firebase not configured)
    const tokens = cardholders.map((c) => c.fcmToken).filter(Boolean);
    if (tokens.length) {
      try {
        const message = {
          notification: {
            title: "New Deal Request 💸",
            body: `${product.title} — ₹${finalPrice}`,
          },
          data: { dealId: deal._id.toString() },
        };

        if (admin.messaging && typeof admin.messaging === 'function') {
          await admin.messaging().sendEachForMulticast({ tokens, ...message });
          console.log(`✓ FCM notifications sent to ${tokens.length} cardholders`);
        } else {
          console.log("⚠ FCM not configured, skipping push notifications");
        }
      } catch (fcmError) {
        console.warn("⚠ FCM notification failed:", fcmError.message);
      }
    }

    // Send Email notifications
    await sendDealNotificationEmail(cardholders, deal);

    return res.status(201).json({ deal });
  } catch (err) {
    console.error("Error creating deal:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// Cardholder accepts a deal
export const acceptDeal = async (req, res) => {
  try {
    const cardholderId = req.user.id;
    const { id } = req.params;

    const deal = await Deal.findById(id);
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    // Check expiry
    if (new Date() > deal.expiresAt) {
      return res.status(400).json({ message: "Deal expired" });
    }

    // Check if already accepted
    if (deal.cardholderId) {
      return res.status(400).json({ message: "Deal already accepted" });
    }

    // Mark as matched (cardholder paired with buyer)
    deal.cardholderId = cardholderId;
    deal.status = "matched";
    await deal.save();

    //(Optional) notify buyer via FCM
    const buyer = await User.findById(deal.buyerId);
    if (buyer.fcmToken) {
      await admin.messaging().send({
        token: buyer.fcmToken,
        notification: {
          title: "Your Deal Was Accepted 🎉",
          body: "A cardholder agreed to complete your order!",
        },
      });
    }

    res.status(200).json({ message: "Deal accepted successfully", deal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all deals (for monitoring/testing)
export const getAllDeals = async (req, res) => {
  try {
    const deals = await Deal.find()
      .populate("buyerId", "name email")
      .populate("cardholderId", "name email")
      .sort({ createdAt: -1 });

    // Add time remaining for each deal
    const dealsWithTimeInfo = deals.map(deal => {
      const now = new Date();
      const expiresAt = new Date(deal.expiresAt);
      const timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000)); // seconds
      const isExpired = now > expiresAt;

      return {
        ...deal.toObject(),
        timeRemaining: `${Math.floor(timeRemaining / 60)}m ${timeRemaining % 60}s`,
        isExpired,
        expiresAtReadable: expiresAt.toLocaleString()
      };
    });

    res.json({ deals: dealsWithTimeInfo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
