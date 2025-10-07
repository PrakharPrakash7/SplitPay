import express from "express";
import { firebaseLogin } from "../controllers/buyerController.js";

const router = express.Router();

// Buyer login via Firebase
router.post("/login", firebaseLogin);

export default router;
