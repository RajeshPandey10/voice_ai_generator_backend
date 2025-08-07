import express from "express";
import { body } from "express-validator";
import {
  getSubscriptionInfo,
  upgradePlan,
  cancelSubscription,
  getPlans,
} from "../controllers/subscriptionController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Get available plans
router.get("/plans", getPlans);

// Get current subscription info
router.get("/", authenticate, getSubscriptionInfo);

// Upgrade plan
router.post(
  "/upgrade",
  authenticate,
  [body("plan").isIn(["free", "pro", "pro_plus"]).withMessage("Invalid plan")],
  upgradePlan
);

// Cancel subscription
router.post("/cancel", authenticate, cancelSubscription);

export default router;
