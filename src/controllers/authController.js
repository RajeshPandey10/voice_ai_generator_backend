import User from "../models/User.js";
import { generateTokens } from "../utils/jwt.js";
import { registerSchema, loginSchema } from "../utils/validation.js";

export const register = async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: error.details[0].message,
      });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: "User already exists with this email.",
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      authProvider: "local",
    });

    await user.save();

    // Setup developer privileges if this is the developer email
    if (user.isDeveloper()) {
      await user.setupDeveloperPrivileges();
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Remove password from response
    const userResponse = user.toJSON();

    res.status(201).json({
      message: "User registered successfully",
      user: userResponse,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Internal server error during registration",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: error.details[0].message,
      });
    }

    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Check if user registered with Google
    if (user.authProvider === "google" && !user.password) {
      return res.status(401).json({
        error: "Please login with Google account",
      });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Setup developer privileges if this is the developer email
    if (user.isDeveloper()) {
      await user.setupDeveloperPrivileges();
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Remove password from response
    const userResponse = user.toJSON();

    res.json({
      message: "Login successful",
      user: userResponse,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Internal server error during login",
    });
  }
};

export const googleAuth = async (req, res) => {
  try {
    // User is already authenticated via Passport
    const user = req.user;

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Redirect to frontend with tokens
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(
      `${frontendUrl}/auth/success?token=${accessToken}&refresh=${refreshToken}`
    );
  } catch (error) {
    console.error("Google auth error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/auth/error`);
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "Error fetching user profile",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, preferences } = req.body;

    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      error: "Error updating profile",
    });
  }
};

export const logout = async (req, res) => {
  res.json({
    message: "Logout successful",
  });
};
