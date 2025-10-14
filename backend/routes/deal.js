import express from "express";

import { createDeal, acceptDeal, getAllDeals } from "../controllers/dealsController.js";
import { verifyToken } from "../middleware/authMiddleware.js";


const router = express.Router();

// Buyer creates a new deal
router.post("/", verifyToken, createDeal);
router.post("/:id/accept", verifyToken, acceptDeal); 

// Get all deals (for testing/monitoring)
router.get("/", verifyToken, getAllDeals);

export default router;
