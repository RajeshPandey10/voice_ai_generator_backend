import User from "../models/User.js";

export const getSubscriptionInfo = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const user = await User.findById(req.user.id);

    res.json({
      subscription: {
        plan: user.subscription.plan,
        status: user.subscription.status,
        credits: user.subscription.credits,
        monthlyLimits: user.subscription.monthlyLimits,
        usageCount: user.subscription.usageCount,
        resetDate: user.subscription.resetDate,
        expiryDate: user.subscription.expiryDate,
      },
    });
  } catch (error) {
    console.error("Failed to get subscription info:", error);
    res.status(500).json({
      error: "Failed to get subscription info",
      message: error.message,
    });
  }
};

export const upgradePlan = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const { plan } = req.body;

    if (!["free", "pro", "pro_plus"].includes(plan)) {
      return res.status(400).json({
        error: "Invalid plan",
        message: "Plan must be 'free', 'pro', or 'pro_plus'",
      });
    }

    const user = await User.findById(req.user.id);
    await user.updateSubscription(plan);

    // In a real application, you would:
    // 1. Process payment with Stripe/PayPal
    // 2. Verify payment success
    // 3. Then update the subscription

    res.json({
      success: true,
      message: `Successfully upgraded to ${plan} plan`,
      subscription: {
        plan: user.subscription.plan,
        status: user.subscription.status,
        monthlyLimits: user.subscription.monthlyLimits,
        expiryDate: user.subscription.expiryDate,
      },
    });
  } catch (error) {
    console.error("Failed to upgrade plan:", error);
    res.status(500).json({
      error: "Failed to upgrade plan",
      message: error.message,
    });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const user = await User.findById(req.user.id);

    // Set subscription to expire at the end of current period
    user.subscription.status = "cancelled";

    await user.save();

    res.json({
      success: true,
      message: "Subscription cancelled successfully",
      subscription: {
        plan: user.subscription.plan,
        status: user.subscription.status,
        expiryDate: user.subscription.expiryDate,
      },
    });
  } catch (error) {
    console.error("Failed to cancel subscription:", error);
    res.status(500).json({
      error: "Failed to cancel subscription",
      message: error.message,
    });
  }
};

export const getPlans = async (req, res) => {
  try {
    const plans = {
      free: {
        name: "Free",
        price: 0,
        currency: "USD",
        interval: "month",
        features: {
          contentGenerations: 2,
          audioGenerations: 2,
          languages: ["en", "ne"],
          support: "email",
        },
        description: "Perfect for trying out our service",
      },
      pro: {
        name: "Pro",
        price: 5,
        currency: "USD",
        interval: "month",
        features: {
          contentGenerations: 50,
          audioGenerations: 50,
          languages: ["en", "ne"],
          support: "priority email",
          downloadFormats: ["mp3", "txt", "pdf"],
        },
        description: "Great for small businesses",
      },
      pro_plus: {
        name: "Pro Plus",
        price: 15,
        currency: "USD",
        interval: "month",
        features: {
          contentGenerations: "unlimited",
          audioGenerations: "unlimited",
          languages: ["en", "ne"],
          support: "priority email & phone",
          downloadFormats: ["mp3", "txt", "pdf"],
          customVoices: true,
          apiAccess: true,
        },
        description: "For growing businesses with high volume needs",
      },
    };

    res.json({ plans });
  } catch (error) {
    console.error("Failed to get plans:", error);
    res.status(500).json({
      error: "Failed to get plans",
      message: error.message,
    });
  }
};
