import User from "../models/User.js";
import jwt from "jsonwebtoken";

// Buyer login/signup via Firebase Auth
export const firebaseLogin = async (req, res) => {
  try {
    const { name, email, firebaseUid } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email, role: "buyer" });

    if (!user) {
      // Create new Buyer
      user = new User({
        name,
        email,
        role: "buyer",
        firebaseUid
      });
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
