import express from "express";
import { createDeal } from "../controllers/dealsController.js";
import { verifyToken } from "../middleware/authMiddleware.js"; // use your existing JWT/Firebase middleware

const router = express.Router();

// Buyer creates a new deal
router.post("/", verifyToken, createDeal);

export default router;
