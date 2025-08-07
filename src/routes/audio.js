import express from "express";
import { body } from "express-validator";
import {
  generateAudio,
  getAudioHistory,
  deleteAudio,
  downloadAudio,
} from "../controllers/audioController.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import { audioGenerationLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Audio generation validation
const audioValidation = [
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ min: 10, max: 5000 })
    .withMessage("Content must be between 10 and 5000 characters"),
  body("language")
    .optional()
    .isIn(["en", "ne"])
    .withMessage("Language must be 'en' (English) or 'ne' (Nepali)"),
  body("voice").optional().isString().withMessage("Voice must be a string"),
  body("businessName")
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage("Business name must be less than 100 characters"),
  body("contentType")
    .optional()
    .isIn([
      "business_description",
      "faq",
      "service_description",
      "product_description",
    ])
    .withMessage("Invalid content type"),
];

// Generate audio from text
router.post(
  "/generate",
  audioGenerationLimiter,
  optionalAuth,
  audioValidation,
  generateAudio
);

// Get user's audio history
router.get("/history", authenticate, getAudioHistory);

// Delete audio
router.delete("/:id", authenticate, deleteAudio);

// Download audio
router.get("/download/:id", optionalAuth, downloadAudio);

export default router;
