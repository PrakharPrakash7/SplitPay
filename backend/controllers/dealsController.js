import Deal from "../models/Deal.js";
import User from "../models/User.js";
import { fetchProduct } from "../utils/scrapeCache.js";
import admin from "../utils/firebaseAdmin.js"; // we'll make this file next

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

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

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

    console.log("Deal created successfully:", deal._id);

    // Notify all cardholders with FCM token
    const cardholders = await User.find({
      role: "cardholder",
      fcmToken: { $ne: null },
    }).select("fcmToken");

    const tokens = cardholders.map((c) => c.fcmToken).filter(Boolean);
    if (tokens.length) {
      const message = {
        notification: {
          title: "New Deal Request 💸",
          body: `${product.title} — ₹${finalPrice}`,
        },
        data: { dealId: deal._id.toString() },
      };

      await admin.messaging().sendMulticast({ tokens, ...message });
    }

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

