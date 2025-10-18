import Deal from "../models/Deal.js";
import User from "../models/User.js";
import { queueScrapeRequest } from "../utils/scrapeQueue.js";
import admin from "../utils/firebaseAdmin.js"; // we'll make this file next
import redisClient from "../utils/redisClient.js";
import { io } from "../server.js"; // Import Socket.io instance

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

    // Use queue system to prevent overwhelming servers
    // This is especially important when 400-500 users are creating deals
    const product = await queueScrapeRequest(productUrlToUse);
    
    console.log("Product fetched:", product);

    // Use provided totalPrice or fallback to scraped price
    const finalPrice = totalPrice || product.price;
    
    // Extract bank discount from bank offers (if available)
    let totalBankDiscount = 0;
    if (product.bankOffers && product.bankOffers.length > 0) {
      // Try to extract numerical discount from the first bank offer
      const firstOffer = product.bankOffers[0];
      // Look for patterns like "₹4000 discount", "4000 off", "Save ₹4000"
      const discountMatch = firstOffer.discount.match(/[₹\s]?([\d,]+)/);
      if (discountMatch) {
        totalBankDiscount = parseInt(discountMatch[1].replace(/,/g, ''));
      }
    }
    
    // Calculate dynamic discount split (80-15-5)
    const buyerDiscount = Math.round(totalBankDiscount * 0.80);        // 80% to buyer
    const cardholderCommission = Math.round(totalBankDiscount * 0.15); // 15% to cardholder
    const platformFee = Math.round(totalBankDiscount * 0.05);          // 5% to platform
    
    // Final price after buyer discount
    const discountedPrice = finalPrice - buyerDiscount;
    
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    const deal = await Deal.create({
      buyerId,
      product: {
        ...product,
        price: finalPrice,
      },
      discountPct: discountPct || 10,
      discountedPrice,
      totalBankDiscount,
      buyerDiscount,
      cardholderCommission,
      platformFee,
      expiresAt,
      description: description || `Deal for ${product.title}`,
    });


    // at the top

// after deal is created
    await redisClient.setEx(`deal_expiry_${deal._id}`, 300, "expire"); // 300 seconds = 5 minutes


    console.log("Deal created successfully:", deal._id);

    // Notify all cardholders
    console.log("📢 Notifying all cardholders about the new deal");
    
    const cardholders = await User.find({
      role: "cardholder",
    }).select("name email fcmToken creditCards");
    
    console.log(`✓ Found ${cardholders.length} cardholders to notify`);
    
    // Log bank offers if available
    if (product.bankOffers && product.bankOffers.length > 0) {
      const offerBanks = product.bankOffers.map(offer => offer.bank).join(", ");
      console.log(`🏦 Deal has bank offers for: ${offerBanks}`);
    }

    if (cardholders.length === 0) {
      console.log("⚠ No cardholders found in the system");
      return res.status(201).json({ 
        deal,
        message: "Deal created but no cardholders registered yet"
      });
    }

    // Send FCM notifications (optional - skip if Firebase not configured)
    const tokens = cardholders.map((c) => c.fcmToken).filter(Boolean);
    if (tokens.length) {
      try {
        // Include bank offer details in notification
        const offerText = product.bankOffers && product.bankOffers.length > 0
          ? ` | ${product.bankOffers[0].discount} off`
          : "";
        
        const message = {
          notification: {
            title: "New Deal Request 💸",
            body: `${product.title.substring(0, 50)} — ₹${finalPrice}${offerText}`,
          },
          data: { 
            dealId: deal._id.toString(),
            action: 'new_deal',
            price: finalPrice.toString(),
            bankOffers: JSON.stringify(product.bankOffers || [])
          },
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

    // Emit Socket.io event to cardholders room
    io.to('cardholders').emit('newDeal', {
      deal: {
        ...deal.toObject(),
        product: deal.product
      },
      message: 'New deal available!'
    });
    
    console.log("✓ Socket.io event emitted to cardholders room");

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
    deal.acceptedAt = new Date();
    
    // Set 15 minute timer for buyer to pay
    const paymentExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    deal.paymentExpiresAt = paymentExpiry;
    
    await deal.save();
    
    console.log(`⏰ Payment timer set: Deal must be paid by ${paymentExpiry.toLocaleTimeString()}`);

    //(Optional) notify buyer via FCM
    const buyer = await User.findById(deal.buyerId);
    if (buyer && buyer.fcmToken) {
      try {
        await admin.messaging().send({
          token: buyer.fcmToken,
          notification: {
            title: "Your Deal Was Accepted 🎉",
            body: `A cardholder agreed to buy ${deal.product.title.substring(0, 40)}...`,
          },
          data: {
            dealId: deal._id.toString(),
            action: 'deal_accepted',
            status: 'matched'
          }
        });
        console.log(`✓ Buyer notified of deal acceptance`);
      } catch (fcmError) {
        console.warn("⚠ Failed to notify buyer:", fcmError.message);
      }
    }

    // Emit Socket.io event to buyer
    io.to('buyers').emit('dealAcceptedByCardholder', {
      dealId: deal._id,
      cardholder: {
        id: cardholderId,
        name: req.user.name || 'Cardholder'
      },
      message: '🎉 A cardholder accepted your deal!'
    });
    
    console.log(`✓ Socket.io event emitted to buyers room for deal ${deal._id}`);

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
