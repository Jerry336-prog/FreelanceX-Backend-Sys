import express from "express";
import {
  initializePaystackPayment,
  verifyPaystackPayment,
  getPaymentHistory,
  getEarningsStats,
  handlePaystackWebhook
} from "../controllers/paymentControllers.js";
import authorise from "../middleware/authorise.js";

const router = express.Router();

// Initialize a direct payment for an approved contract
router.post("/initialize", authorise(["client"]), initializePaystackPayment);

// Verify payment after Paystack redirect (Client)
router.get("/verify/:reference", authorise(["client"]), verifyPaystackPayment);

// Payment/transaction history (Freelancer sees received; Client sees sent)
router.get("/history", authorise(["freelancer", "client", "admin"]), getPaymentHistory);

// Freelancer earnings summary
router.get("/earnings-stats", authorise(["freelancer"]), getEarningsStats);

// Paystack webhook (no auth — verified by signature)
router.post("/webhook", handlePaystackWebhook);

export default router;
