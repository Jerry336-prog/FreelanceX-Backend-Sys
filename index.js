import { config } from "dotenv";
config(); 
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";

// Route Imports
import authRoutes from "./routes/authRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import proposalRoutes from "./routes/proposalRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import messagingRoutes from "./routes/messagingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import disputesRoutes from "./routes/disputesRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();
const PORT = process.env.PORT || 9999;
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173,http://localhost:3000").split(",").map((value) => value.trim()).filter(Boolean);
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

// Middleware
app.use(cors({ origin: (origin, callback) => (!origin || allowedOrigins.includes(origin)) ? callback(null, true) : callback(new Error("CORS origin is not allowed")), credentials: true }));
app.use(express.static("files"));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({
  limit: "1mb",
  verify: (req, res, buffer) => {
    const webhookRoutes = ["/api/payments/webhook", "/api/payouts/webhook"];
    if (webhookRoutes.includes(req.originalUrl)) req.rawBody = buffer;
  }
}));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/messages", messagingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/disputes", disputesRoutes);
app.use("/api/admin", adminRoutes);

// Root / Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "freelancex-api" });
});
app.get("/api/ready", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" });
});
app.use((error, req, res, next) => {
  if (error?.name === "MulterError") return res.status(400).json({ message: error.message });
  if (error?.message === "CORS origin is not allowed") return res.status(403).json({ message: error.message });
  console.error("Unhandled request error:", error);
  return res.status(500).json({ message: "Internal server error" });
});

// Database Connection & Server Start
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  })
  .catch((error) => { console.error("Error connecting to MongoDB:", error); process.exitCode = 1; });

export default app;
