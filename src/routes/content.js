import express from "express";
import {
  generateContent,
  getHistory,
  getContentById,
  bookmarkContent,
  rateContent,
  deleteContent,
  getStats,
  modifyContent,
} from "../controllers/contentController.js";
import {
  authenticate,
  optionalAuth,
  checkUsageLimit,
} from "../middleware/auth.js";
import { contentGenerationLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public route for content generation (with optional auth)
router.post(
  "/generate-content",
  contentGenerationLimiter,
  optionalAuth,
  async (req, res, next) => {
    // Check usage limit only for authenticated users
    if (req.user) {
      return checkUsageLimit(req, res, next);
    }
    next();
  },
  generateContent
);

// Protected routes for authenticated users
router.get("/history", authenticate, getHistory);
router.get("/stats", authenticate, getStats);
router.get("/:id", authenticate, getContentById);
router.patch("/:id/bookmark", authenticate, bookmarkContent);
router.patch("/:id/rate", authenticate, rateContent);
router.delete("/:id", authenticate, deleteContent);
router.post("/modify", authenticate, modifyContent);

export default router;
