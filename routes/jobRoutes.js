import express from "express";
import {
    createJob,
    getJobs,
    getPublicMarketplaceOverview,
    getJobById,
    getMyClientJobs,
    updateJob,
    deleteJob
} from "../controllers/jobControllers.js";
import authorise from "../middleware/authorise.js";
import { uploadDocuments } from "../middleware/upload.js";

const router = express.Router();

// Public / Freelancer job browsing
router.get("/", getJobs);

router.get("/public/overview", getPublicMarketplaceOverview);

// Client get own posted jobs
router.get("/my-jobs", authorise(['client', 'admin']), getMyClientJobs);

// Viewing a full job is a signed-in dashboard action. The public landing page
// uses its deliberately limited overview endpoint instead.
router.get("/:id", authorise(['freelancer', 'client', 'admin']), getJobById);

// Client create new job
router.post("/", authorise(['client', 'admin']), uploadDocuments.array("attachments", 5), createJob);

// Client / Admin update job
router.put("/:id", authorise(['client', 'admin']), uploadDocuments.array("attachments", 5), updateJob);

// Client / Admin delete job
router.delete("/:id", authorise(['client', 'admin']), deleteJob);

export default router;
