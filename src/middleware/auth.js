import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Access denied. No token provided.",
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: "Invalid token. User not found.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired. Please login again.",
      });
    }

    return res.status(401).json({
      error: "Invalid token.",
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // If token is invalid, continue without user
    next();
  }
};

export const checkUsageLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required to check usage limits.",
      });
    }

    if (!req.user.canGenerateContent()) {
      return res.status(429).json({
        error: "Monthly usage limit exceeded. Please upgrade your plan.",
        currentUsage: req.user.subscription.usageCount,
        limit: req.user.subscription.monthlyLimit,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      error: "Error checking usage limits.",
    });
  }
};
