import express from "express";
import { signup, login } from "../controllers/authController.js";

const router = express.Router();

// Cardholder signup
router.post("/signup", signup);

// Cardholder login
router.post("/login", login);

export default router;
