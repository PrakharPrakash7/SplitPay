import Deal from "../models/Deal.js";
import User from "../models/User.js";
import { fetchProduct } from "../utils/scrapeCache.js";
import admin from "../utils/firebaseAdmin.js"; // we'll make this file next

export const createDeal = async (req, res) => {
  try {
    const buyerId = req.user.id; // coming from JWT or Firebase auth middleware
    const { url, discountPct } = req.body;

    // fetch metadata from product URL (scraping or Redis cache)
    const product = await fetchProduct(url);
    const discountedPrice = Math.round(
      product.price * (1 - (discountPct || 10) / 100)
    );

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    const deal = await Deal.create({
      buyerId,
      product,
      discountPct: discountPct || 10,
      discountedPrice,
      expiresAt,
    });

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
          body: `${product.title} — ₹${product.price}`,
        },
        data: { dealId: deal._id.toString() },
      };

      await admin.messaging().sendMulticast({ tokens, ...message });
    }

    return res.status(201).json({ deal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
