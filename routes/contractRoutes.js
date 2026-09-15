import express from "express";
import {
    getMyContracts,
    getContractById,
    submitWork,
    updateDelivery,
    approveWork,
    requestRevision,
    cancelContract,
    confirmPayment
} from "../controllers/contractControllers.js";
import authorise from "../middleware/authorise.js";
import { uploadDocuments } from "../middleware/upload.js";

const router = express.Router();

// Get user's contracts (Freelancer / Client)
router.get("/my-contracts", authorise(['freelancer', 'client', 'admin']), getMyContracts);

// Get single contract details
router.get("/:id", authorise(['freelancer', 'client', 'admin']), getContractById);

// Freelancer submit work deliverables
router.post("/:id/submit-work", authorise(['freelancer']), uploadDocuments.array("files", 5), submitWork);

router.patch("/:id/delivery", authorise(['freelancer']), uploadDocuments.array("files", 5), updateDelivery);

// Client approve work deliverables
router.patch("/:id/approve", authorise(['client', 'admin']), approveWork);

// Freelancer confirm payment received
router.patch("/:id/confirm-payment", authorise(['freelancer', 'admin']), confirmPayment);

// Client request revisions
router.patch("/:id/revision", authorise(['client', 'admin']), requestRevision);

// Client / Admin cancel contract
router.patch("/:id/cancel", authorise(['client', 'admin']), cancelContract);

export default router;
