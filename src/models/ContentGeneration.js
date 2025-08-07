import mongoose from "mongoose";

const contentGenerationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Allow anonymous content generation
    },
    businessDetails: {
      businessName: {
        type: String,
        required: true,
      },
      location: {
        type: String,
        required: true,
      },
      businessType: {
        type: String,
        required: true,
      },
      productsServices: String,
      targetCustomers: String,
    },
    generatedContent: {
      type: String,
      required: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      default: "llama-3.1-8b-instant",
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: String,
    isBookmarked: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["success", "failed", "processing"],
      default: "success",
    },
    metadata: {
      generationTime: Number, // Time taken in milliseconds
      wordCount: Number,
      characterCount: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
contentGenerationSchema.index({ user: 1, createdAt: -1 });
contentGenerationSchema.index({ "businessDetails.businessType": 1 });
contentGenerationSchema.index({ "businessDetails.location": 1 });
contentGenerationSchema.index({ isBookmarked: 1 });

// Calculate metadata before saving
contentGenerationSchema.pre("save", function (next) {
  if (this.generatedContent) {
    this.metadata.wordCount = this.generatedContent.split(" ").length;
    this.metadata.characterCount = this.generatedContent.length;
  }
  next();
});

export default mongoose.model("ContentGeneration", contentGenerationSchema);
