import express from "express";

import { createDeal, acceptDeal } from "../controllers/dealsController.js";
import { verifyToken } from "../middleware/authMiddleware.js";


const router = express.Router();

// Buyer creates a new deal
router.post("/", verifyToken, createDeal);
router.post("/:id/accept", verifyToken, acceptDeal); 

export default router;
