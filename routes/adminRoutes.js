import express from "express";
import {
    getOverviewStats,
    getAllAdminUsers,
    toggleUserStatus,
    getAllAdminJobs,
    getAllAdminContracts,
    getAllAdminPayments
} from "../controllers/adminControllers.js";
import authorise from "../middleware/authorise.js";

const router = express.Router();

// Enforce admin role for all admin routes
router.use(authorise(['admin']));

router.get("/overview", getOverviewStats);
router.get("/users", getAllAdminUsers);
router.patch("/users/:id/status", toggleUserStatus);
router.get("/jobs", getAllAdminJobs);
router.get("/contracts", getAllAdminContracts);
router.get("/payments", getAllAdminPayments);

export default router;
