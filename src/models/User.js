import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false, // Don't include password by default in queries
    },
    avatar: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allow null values
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      language: {
        type: String,
        default: "en",
      },
    },
    subscription: {
      plan: {
        type: String,
        enum: ["free", "pro", "pro_plus"],
        default: "free",
      },
      status: {
        type: String,
        enum: ["active", "expired", "cancelled"],
        default: "active",
      },
      credits: {
        content: {
          type: Number,
          default: 2, // Free tier gets 2 content generations
        },
        audio: {
          type: Number,
          default: 2, // Free tier gets 2 audio generations
        },
      },
      monthlyLimits: {
        content: {
          type: Number,
          default: 2, // Free: 2, Pro: 50, Pro+: unlimited
        },
        audio: {
          type: Number,
          default: 2, // Free: 2, Pro: 50, Pro+: unlimited
        },
      },
      usageCount: {
        content: {
          type: Number,
          default: 0,
        },
        audio: {
          type: Number,
          default: 0,
        },
      },
      resetDate: {
        type: Date,
        default: () => {
          const date = new Date();
          date.setMonth(date.getMonth() + 1);
          return date;
        },
      },
      expiryDate: {
        type: Date,
        default: null,
      },
      paymentDetails: {
        stripeCustomerId: String,
        subscriptionId: String,
        lastPayment: Date,
        nextBilling: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user can generate content
userSchema.methods.canGenerateContent = function () {
  // Developer always has unlimited access
  if (this.isDeveloper()) return true;

  // Check if subscription is active
  if (this.subscription.status !== "active") return false;

  // Check if subscription has expired
  if (
    this.subscription.expiryDate &&
    new Date() > this.subscription.expiryDate
  ) {
    return false;
  }

  // Pro Plus has unlimited generations
  if (this.subscription.plan === "pro_plus") return true;

  // Check monthly limits
  return (
    this.subscription.usageCount.content <
    this.subscription.monthlyLimits.content
  );
};

// Check if user can generate audio
userSchema.methods.canGenerateAudio = function () {
  // Developer always has unlimited access
  if (this.isDeveloper()) return true;

  // Check if subscription is active
  if (this.subscription.status !== "active") return false;

  // Check if subscription has expired
  if (
    this.subscription.expiryDate &&
    new Date() > this.subscription.expiryDate
  ) {
    return false;
  }

  // Pro Plus has unlimited generations
  if (this.subscription.plan === "pro_plus") return true;

  // Check monthly limits
  return (
    this.subscription.usageCount.audio < this.subscription.monthlyLimits.audio
  );
};

// Increment content usage count
userSchema.methods.incrementContentUsage = async function () {
  this.subscription.usageCount.content += 1;
  return await this.save();
};

// Increment audio usage count
userSchema.methods.incrementAudioUsage = async function () {
  this.subscription.usageCount.audio += 1;
  return await this.save();
};

// Reset monthly usage
userSchema.methods.resetMonthlyUsage = async function () {
  this.subscription.usageCount.content = 0;
  this.subscription.usageCount.audio = 0;
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1);
  this.subscription.resetDate = resetDate;
  return await this.save();
};

// Check if user is a developer
userSchema.methods.isDeveloper = function () {
  return this.email === "imrajesh2005@gmail.com";
};

// Setup developer privileges
userSchema.methods.setupDeveloperPrivileges = async function () {
  if (this.isDeveloper()) {
    this.subscription.plan = "pro_plus";
    this.subscription.status = "active";
    this.subscription.monthlyLimits.content = 999999; // Unlimited
    this.subscription.monthlyLimits.audio = 999999; // Unlimited
    this.subscription.expiryDate = new Date(2099, 11, 31); // Never expires (set to year 2099)
    this.subscription.usageCount.content = 0;
    this.subscription.usageCount.audio = 0;
    this.role = "admin"; // Also give admin role
    return await this.save();
  }
  return this;
};

// Update subscription plan
userSchema.methods.updateSubscription = async function (plan) {
  // Always keep developer on pro_plus
  if (this.isDeveloper()) {
    return await this.setupDeveloperPrivileges();
  }

  this.subscription.plan = plan;
  this.subscription.status = "active";

  // Set limits based on plan
  if (plan === "free") {
    this.subscription.monthlyLimits.content = 2;
    this.subscription.monthlyLimits.audio = 2;
    this.subscription.expiryDate = null;
  } else if (plan === "pro") {
    this.subscription.monthlyLimits.content = 50;
    this.subscription.monthlyLimits.audio = 50;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    this.subscription.expiryDate = expiryDate;
  } else if (plan === "pro_plus") {
    this.subscription.monthlyLimits.content = 999999; // Unlimited
    this.subscription.monthlyLimits.audio = 999999; // Unlimited
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    this.subscription.expiryDate = expiryDate;
  }

  return await this.save();
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

export default mongoose.model("User", userSchema);
