import express from "express";
import { signup, login } from "../controllers/authController.js";
import jwt from 'jsonwebtoken';

const router = express.Router();

// Cardholder signup
router.post("/signup", signup);

// Cardholder login
router.post("/login", login);

/**
 * Admin Login
 * POST /api/auth/admin/login
 */
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Hardcoded admin credentials for testing
    // In production, use proper admin user in database with hashed password
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@splitpay.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Generate JWT token
      const token = jwt.sign(
        { id: 'admin', email: ADMIN_EMAIL, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(200).json({
        success: true,
        token,
        user: {
          id: 'admin',
          email: ADMIN_EMAIL,
          name: 'Admin',
          role: 'admin'
        }
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid admin credentials' 
      });
    }
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({ error: 'Admin login failed' });
  }
});

export default router;
