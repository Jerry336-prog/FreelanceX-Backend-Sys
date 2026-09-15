import express from "express";
import {
  listBanks,
  savePayoutAccount,
  getPayoutAccount,
  requestPayout,
  getPayoutHistory,
  getBalance,
  handleTransferWebhook
} from "../controllers/payoutControllers.js";
import authorise from "../middleware/authorise.js";

const router = express.Router();

// List Nigerian banks (for account setup dropdown)
router.get("/banks", authorise(["freelancer"]), listBanks);

// Get / Save freelancer payout account
router.get("/account", authorise(["freelancer"]), getPayoutAccount);
router.put("/account", authorise(["freelancer"]), savePayoutAccount);

// Get available balance
router.get("/balance", authorise(["freelancer"]), getBalance);

// Request a payout withdrawal
router.post("/request", authorise(["freelancer"]), requestPayout);

// Get payout withdrawal history
router.get("/history", authorise(["freelancer"]), getPayoutHistory);

// Paystack transfer webhook (no auth — Paystack-signed)
router.post("/webhook", handleTransferWebhook);

export default router;
