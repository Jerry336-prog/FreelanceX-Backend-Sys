import express from "express";
import {
    openDispute,
    getDisputes,
    getDisputeById,
    resolveDispute
} from "../controllers/disputeControllers.js";
import authorise from "../middleware/authorise.js";

const router = express.Router();

// Open dispute (Freelancer / Client)
router.post("/", authorise(['freelancer', 'client']), openDispute);

// Get disputes (Admin sees all, users see their own)
router.get("/", authorise(['freelancer', 'client', 'admin']), getDisputes);

// Get single dispute details
router.get("/:id", authorise(['freelancer', 'client', 'admin']), getDisputeById);

// Admin resolve dispute
router.patch("/:id/resolve", authorise(['admin']), resolveDispute);

export default router;
