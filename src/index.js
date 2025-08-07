import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectDatabase from "./config/database.js";
import passport from "./config/passport.js";
import { generalLimiter } from "./middleware/rateLimiter.js";

// Import routes
import authRoutes from "./routes/auth.js";
import contentRoutes from "./routes/content.js";
import audioRoutes from "./routes/audio.js";
import subscriptionRoutes from "./routes/subscription.js";
import { generateContent } from "./controllers/contentController.js";
import { optionalAuth, checkUsageLimit } from "./middleware/auth.js";
import { contentGenerationLimiter } from "./middleware/rateLimiter.js";

const app = express();
dotenv.config({});
// Connect to database
connectDatabase();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static audio files
app.use("/audio", express.static("uploads/audio"));

// Session configuration (for OAuth)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use(generalLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use("/auth", authRoutes);
app.use("/api", contentRoutes);
app.use("/api/audio", audioRoutes);
app.use("/api/subscription", subscriptionRoutes);

// Backward compatibility - keep your original endpoint
app.post(
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation error",
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      error: "Invalid ID format",
    });
  }

  res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`
  );
  console.log(`🔑 Environment: ${process.env.NODE_ENV || "development"}`);

  if (!process.env.GROQ_API_KEY) {
    console.warn(
      "⚠️  Warning: GROQ_API_KEY not found in environment variables"
    );
  }

  if (!process.env.MONGODB_URI) {
    console.warn("⚠️  Warning: MONGODB_URI not found in environment variables");
  }
});
