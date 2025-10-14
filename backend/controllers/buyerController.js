import User from "../models/User.js";
import jwt from "jsonwebtoken";

// Buyer login/signup via Firebase Auth
export const firebaseLogin = async (req, res) => {
  try {
    const { name, email, firebaseUid } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user already exists
    let user = await User.findOne({ email, role: "buyer" });

    if (!user) {
      // Create new Buyer - use email prefix as name if name not provided
      const userName = name || email.split('@')[0];
      
      user = new User({
        name: userName,
        email,
        role: "buyer",
        firebaseUid: firebaseUid || null // Optional for testing
      });
      await user.save();
      //console.log(`✓ New buyer created: ${userName} (${email})`);
    } else {
      // Update firebaseUid if provided (for existing users)
      if (firebaseUid && user.firebaseUid !== firebaseUid) {
        user.firebaseUid = firebaseUid;
        await user.save();
      }
      console.log(`✓ Existing buyer logged in: ${user.name} (${email})`);
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
    
    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Error in firebaseLogin:", err);
    res.status(500).json({ message: "Server error", details: err.message });
  }
};
