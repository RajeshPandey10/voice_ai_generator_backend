import AudioGeneration from "../models/AudioGeneration.js";
import audioService from "../services/audioService.js";
import { validationResult } from "express-validator";
import path from "path";

export const generateAudio = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Audio validation errors:", errors.array());
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: errors.array(),
        message: errors
          .array()
          .map((err) => err.msg)
          .join(", "),
      });
    }

    const {
      content,
      language = "en",
      voice = "default",
      businessName,
      contentType,
    } = req.body;
    const userId = req.user?.id;

    console.log("Audio generation request:", {
      contentLength: content?.length,
      language,
      voice,
      businessName,
      contentType,
      userId,
      contentPreview: content?.substring(0, 100) + "...",
    });

    // Validate content exists and has meaningful text
    if (!content || typeof content !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid content",
        message: "Content must be a non-empty string",
      });
    }

    const cleanedContent = content.trim();
    if (cleanedContent.length < 5) {
      return res.status(400).json({
        success: false,
        error: "Content too short",
        message:
          "Content must contain at least 5 characters of meaningful text",
      });
    }

    // Check if user can generate audio
    if (req.user && !req.user.canGenerateAudio()) {
      return res.status(403).json({
        success: false,
        error: "Audio generation limit reached",
        message:
          "You have reached your monthly audio generation limit. Please upgrade your plan.",
        subscription: {
          plan: req.user.subscription.plan,
          usageCount: req.user.subscription.usageCount.audio,
          monthlyLimit: req.user.subscription.monthlyLimits.audio,
        },
      });
    }

    // Generate audio
    const audioResult = await audioService.generateAudio(
      content,
      language,
      voice
    );

    // Save audio generation record
    const audioGeneration = new AudioGeneration({
      user: userId,
      content,
      language,
      audioUrl: audioResult.url,
      duration: audioResult.duration,
      voice,
      businessName,
      contentType,
      fileSize: audioResult.fileSize,
      metadata: audioResult.metadata,
    });

    await audioGeneration.save();

    // Increment user's audio usage if authenticated
    if (req.user) {
      await req.user.incrementAudioUsage();
    }

    res.json({
      success: true,
      audio: {
        id: audioGeneration._id,
        url: audioResult.url,
        duration: audioResult.duration,
        language,
        voice,
        fileSize: audioResult.fileSize,
        metadata: audioResult.metadata,
      },
      usage: req.user
        ? {
            current: req.user.subscription.usageCount.audio + 1,
            limit: req.user.subscription.monthlyLimits.audio,
            plan: req.user.subscription.plan,
          }
        : null,
    });
  } catch (error) {
    console.error("Audio generation error:", error);
    res.status(500).json({
      error: "Audio generation failed",
      message: error.message,
    });
  }
};

export const getAudioHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please sign in to view your audio history.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: req.user.id };

    // Add filters
    if (req.query.language) {
      filter.language = req.query.language;
    }
    if (req.query.contentType) {
      filter.contentType = req.query.contentType;
    }

    const audioHistory = await AudioGeneration.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v");

    const total = await AudioGeneration.countDocuments(filter);

    res.json({
      history: audioHistory,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
      total,
    });
  } catch (error) {
    console.error("Failed to fetch audio history:", error);
    res.status(500).json({
      error: "Failed to fetch audio history",
      message: error.message,
    });
  }
};

export const deleteAudio = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const audioGeneration = await AudioGeneration.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!audioGeneration) {
      return res.status(404).json({
        error: "Audio not found",
      });
    }

    // Delete the audio file
    const filename = audioGeneration.audioUrl.split("/").pop();
    await audioService.deleteAudio(filename);

    // Delete the record
    await AudioGeneration.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Audio deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete audio:", error);
    res.status(500).json({
      error: "Failed to delete audio",
      message: error.message,
    });
  }
};

export const downloadAudio = async (req, res) => {
  try {
    const { id } = req.params;

    const audioGeneration = await AudioGeneration.findById(id);

    if (!audioGeneration) {
      return res.status(404).json({
        error: "Audio not found",
      });
    }

    // Check if user owns this audio or if it's public
    if (req.user && audioGeneration.user.toString() !== req.user.id) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const filename = audioGeneration.audioUrl.split("/").pop();
    const filepath = path.join(audioService.audioDir, filename);

    res.download(filepath, `${audioGeneration.businessName || "audio"}.mp3`);
  } catch (error) {
    console.error("Failed to download audio:", error);
    res.status(500).json({
      error: "Failed to download audio",
      message: error.message,
    });
  }
};
