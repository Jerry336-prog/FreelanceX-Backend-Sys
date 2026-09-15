import express from "express";
import { 
    createUser, 
    login, 
    forgotpassword, 
    resetpassword, 
    checkuser 
} from "../controllers/userControllers.js";
import authorise from "../middleware/authorise.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Public auth endpoints
router.post("/signup", upload.single("profileImage"), createUser);
router.post("/login", login);
router.post("/forgot-password", forgotpassword);
router.post("/reset-password", resetpassword);

// Authenticated session check & logout
router.get("/check", authorise(['freelancer', 'client', 'admin']), checkuser);
router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production"
    });
    return res.status(200).json({ message: "Logged out successfully" });
});

export default router;
