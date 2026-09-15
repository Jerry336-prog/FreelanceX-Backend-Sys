import express from "express";
import {
    submitProposal,
    getJobProposals,
    getMyProposals,
    acceptProposal,
    rejectProposal,
    withdrawProposal
} from "../controllers/proposalControllers.js";
import authorise from "../middleware/authorise.js";
import { uploadDocuments } from "../middleware/upload.js";

const router = express.Router();

// Freelancer submit proposal
router.post("/", authorise(['freelancer']), uploadDocuments.array("attachments", 5), submitProposal);

// Freelancer view own proposals
router.get("/my-proposals", authorise(['freelancer']), getMyProposals);

// Client view all proposals for a job
router.get("/job/:jobId", authorise(['client', 'admin']), getJobProposals);

// Client accept proposal (triggers contract creation)
router.patch("/:id/accept", authorise(['client', 'admin']), acceptProposal);

// Client reject proposal
router.patch("/:id/reject", authorise(['client', 'admin']), rejectProposal);

// Freelancer withdraw proposal
router.patch("/:id/withdraw", authorise(['freelancer']), withdrawProposal);

export default router;
