import mongoose from "mongoose";

const audioGenerationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      enum: ["en", "ne"], // English and Nepali
      required: true,
    },
    audioUrl: {
      type: String,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // Duration in seconds
      default: 0,
    },
    voice: {
      type: String,
      default: "default",
    },
    businessName: {
      type: String,
      trim: true,
    },
    contentType: {
      type: String,
      enum: [
        "business_description",
        "faq",
        "service_description",
        "product_description",
      ],
      required: true,
    },
    fileSize: {
      type: Number, // File size in bytes
      default: 0,
    },
    metadata: {
      sampleRate: Number,
      format: String,
      bitrate: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
audioGenerationSchema.index({ user: 1, createdAt: -1 });
audioGenerationSchema.index({ language: 1 });
audioGenerationSchema.index({ contentType: 1 });

export default mongoose.model("AudioGeneration", audioGenerationSchema);
