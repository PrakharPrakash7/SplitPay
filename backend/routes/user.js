import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * Save or update FCM token for the logged-in user
 */
router.post("/fcm", verifyToken, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ message: "Missing FCM token" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      { fcmToken }, 
      { new: true }
    );
    
    console.log(`✓ FCM token saved for user: ${updatedUser.name} (${updatedUser.email})`);
    res.json({ message: "✅ FCM token saved successfully" });
  } catch (err) {
    console.error("Error saving FCM token:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Add or update credit card information
 */
router.post("/credit-cards", verifyToken, async (req, res) => {
  try {
    const { creditCards } = req.body;
    
    if (!creditCards || !Array.isArray(creditCards)) {
      return res.status(400).json({ message: "Invalid credit cards data" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { creditCards },
      { new: true }
    ).select("-password");

    console.log(`✓ Credit cards updated for user: ${updatedUser.name}`);
    res.json({ 
      message: "Credit cards updated successfully", 
      creditCards: updatedUser.creditCards 
    });
  } catch (err) {
    console.error("Error updating credit cards:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
