import ContentGeneration from "../models/ContentGeneration.js";
import User from "../models/User.js";
import { AIService } from "../services/aiService.js";
import { contentGenerationSchema, ratingSchema } from "../utils/validation.js";

export const generateContent = async (req, res) => {
  try {
    const { error } = contentGenerationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const {
      business_name,
      location,
      business_type,
      products_services,
      target_customers,
      preferredLanguage = "en", // Default to English
    } = req.body;

    const businessDetails = {
      businessName: business_name,
      location,
      businessType: business_type,
      productsServices: products_services || "",
      targetCustomers: target_customers || "",
      preferredLanguage,
    };

    // Generate content using AI service
    const aiResult = await AIService.generateContent(businessDetails);

    // Create content generation record
    const contentRecord = new ContentGeneration({
      user: req.user ? req.user._id : null,
      businessDetails,
      generatedContent: aiResult.content,
      prompt: AIService.buildPrompt(businessDetails),
      model: aiResult.model,
      tokensUsed: aiResult.tokensUsed,
      metadata: {
        generationTime: aiResult.generationTime,
      },
    });

    await contentRecord.save();

    // Increment user usage count if authenticated
    if (req.user) {
      await req.user.incrementContentUsage();
    }

    res.json({
      success: true,
      content: aiResult.content,
      result: aiResult.content, // Keep both for backward compatibility
      id: contentRecord._id,
      tokensUsed: aiResult.tokensUsed,
      generationTime: aiResult.generationTime,
    });
  } catch (error) {
    console.error("Content generation error:", error);

    // Return user-friendly error messages
    if (error.message.includes("AI service")) {
      return res.status(503).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to generate content. Please try again.",
    });
  }
};

export const getHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };

    // Add filters
    if (req.query.businessType) {
      filter["businessDetails.businessType"] = req.query.businessType;
    }

    if (req.query.location) {
      filter["businessDetails.location"] = new RegExp(req.query.location, "i");
    }

    if (req.query.bookmarked === "true") {
      filter.isBookmarked = true;
    }

    const [history, total] = await Promise.all([
      ContentGeneration.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-prompt"), // Exclude prompt for performance
      ContentGeneration.countDocuments(filter),
    ]);

    res.json({
      history,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: history.length,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({
      error: "Error fetching content history",
    });
  }
};

export const getContentById = async (req, res) => {
  try {
    const content = await ContentGeneration.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!content) {
      return res.status(404).json({
        error: "Content not found",
      });
    }

    res.json({ content });
  } catch (error) {
    console.error("Get content error:", error);
    res.status(500).json({
      error: "Error fetching content",
    });
  }
};

export const bookmarkContent = async (req, res) => {
  try {
    const content = await ContentGeneration.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!content) {
      return res.status(404).json({
        error: "Content not found",
      });
    }

    content.isBookmarked = !content.isBookmarked;
    await content.save();

    res.json({
      message: content.isBookmarked ? "Content bookmarked" : "Bookmark removed",
      isBookmarked: content.isBookmarked,
    });
  } catch (error) {
    console.error("Bookmark error:", error);
    res.status(500).json({
      error: "Error updating bookmark",
    });
  }
};

export const rateContent = async (req, res) => {
  try {
    const { error } = ratingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: error.details[0].message,
      });
    }

    const { rating, feedback } = req.body;

    const content = await ContentGeneration.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!content) {
      return res.status(404).json({
        error: "Content not found",
      });
    }

    content.rating = rating;
    if (feedback) content.feedback = feedback;

    await content.save();

    res.json({
      message: "Rating submitted successfully",
      rating: content.rating,
    });
  } catch (error) {
    console.error("Rating error:", error);
    res.status(500).json({
      error: "Error submitting rating",
    });
  }
};

export const deleteContent = async (req, res) => {
  try {
    const content = await ContentGeneration.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!content) {
      return res.status(404).json({
        error: "Content not found",
      });
    }

    res.json({
      message: "Content deleted successfully",
    });
  } catch (error) {
    console.error("Delete content error:", error);
    res.status(500).json({
      error: "Error deleting content",
    });
  }
};

export const getStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const [totalGenerated, bookmarkedCount, businessTypes, recentActivity] =
      await Promise.all([
        ContentGeneration.countDocuments({ user: userId }),
        ContentGeneration.countDocuments({ user: userId, isBookmarked: true }),
        ContentGeneration.aggregate([
          { $match: { user: userId } },
          {
            $group: {
              _id: "$businessDetails.businessType",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),
        ContentGeneration.find({ user: userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select(
            "businessDetails.businessName businessDetails.businessType createdAt"
          ),
      ]);

    res.json({
      stats: {
        totalGenerated,
        bookmarkedCount,
        monthlyUsage: req.user.subscription.usageCount,
        monthlyLimit: req.user.subscription.monthlyLimit,
      },
      businessTypes,
      recentActivity,
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      error: "Error fetching statistics",
    });
  }
};

export const modifyContent = async (req, res) => {
  try {
    const { originalContent, businessName, userRequest, conversationHistory } =
      req.body;

    if (!originalContent || !userRequest) {
      return res.status(400).json({
        error: "Original content and user request are required",
      });
    }

    // Build modification prompt
    const modificationPrompt = `
You are an expert content writer specializing in business content for Nepali SMEs. 
Your task is to modify the existing content based on the user's request.

Original Content:
"""
${originalContent}
"""

Business Name: ${businessName || "N/A"}

User Request: ${userRequest}

Previous Conversation Context:
${
  conversationHistory?.map((msg) => `${msg.type}: ${msg.content}`).join("\n") ||
  "No previous context"
}

Instructions:
1. Carefully analyze the user's request and modify the content accordingly
2. Maintain the professional tone suitable for Nepali businesses
3. Keep the essential business information intact
4. Ensure the modified content is SEO-friendly and voice search optimized
5. If adding keywords, make them natural and contextual
6. Return only the modified content, no explanations

Modified Content:`;

    // Generate modified content using AI service
    const aiResult = await AIService.generateModifiedContent(
      modificationPrompt
    );

    // Increment user usage count if authenticated
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { "subscription.usageCount.content": 1 },
        $set: { lastActivity: new Date() },
      });
    }

    res.json({
      success: true,
      modifiedContent: aiResult.content,
      tokensUsed: aiResult.tokensUsed,
      model: aiResult.model,
      modifications: aiResult.modifications || [],
    });
  } catch (error) {
    console.error("Content modification error:", error);
    res.status(500).json({
      error: "Failed to modify content. Please try again.",
    });
  }
};
