import express from "express";
import { 
    getAllUsers, 
    getOneUser, 
    getPublicFreelancerProfile,
    updateOneUser, 
    deleteOneUser 
} from "../controllers/userControllers.js";
import authorise from "../middleware/authorise.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Admin get all users
router.get("/", authorise(['admin']), getAllUsers);

router.get("/:id/public", authorise(['freelancer', 'client', 'admin']), getPublicFreelancerProfile);

// Get specific user profile (e.g. freelancer profile view by client)
router.get("/:id", authorise(['freelancer', 'client', 'admin']), getOneUser);

// Update user profile (supporting image upload)
router.put("/:id", authorise(['freelancer', 'client', 'admin']), upload.single("profileImage"), updateOneUser);

// Delete user account (Admin only)
router.delete("/:id", authorise(['admin']), deleteOneUser);

export default router;
