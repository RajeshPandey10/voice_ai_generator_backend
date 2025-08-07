import mongoose from "mongoose";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const setupDeveloper = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/content-generator"
    );
    console.log("Connected to MongoDB");

    const developerEmail = "imrajesh2005@gmail.com";

    // Find the developer user
    let user = await User.findOne({ email: developerEmail });

    if (user) {
      console.log(
        "Found existing developer user, upgrading to Premium Plus..."
      );
      await user.setupDeveloperPrivileges();
      console.log("Developer privileges setup complete!");
      console.log("User details:", {
        name: user.name,
        email: user.email,
        plan: user.subscription.plan,
        status: user.subscription.status,
        role: user.role,
        contentLimit: user.subscription.monthlyLimits.content,
        audioLimit: user.subscription.monthlyLimits.audio,
        expiryDate: user.subscription.expiryDate,
      });
    } else {
      console.log(
        "Developer user not found. They will be automatically upgraded when they register/login."
      );
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error setting up developer:", error);
    process.exit(1);
  }
};

setupDeveloper();
