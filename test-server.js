import express from "express";
import audioService from "./src/services/cloudinaryAudioService.js";

const app = express();
app.use(express.json());

// Test endpoint for audio generation
app.post("/api/test-audio", async (req, res) => {
  try {
    const {
      text,
      voice = "en_us_001",
      speed = 1.0,
      language = "en",
    } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    console.log(`🎯 Audio generation request: "${text.substring(0, 50)}..."`);

    const result = await audioService.generateAudio(text, {
      voice,
      speed,
      language,
    });

    console.log(
      `✅ Audio generated successfully using method: ${result.metadata.method}`
    );

    res.json({
      success: true,
      message: "Audio generated successfully",
      data: {
        audioUrl: result.audioUrl,
        duration: result.duration,
        method: result.metadata.method,
        textLength: result.metadata.textLength,
        estimatedWords: result.metadata.estimatedWords,
      },
    });
  } catch (error) {
    console.error("❌ Audio generation endpoint error:", error);
    res.status(500).json({
      success: false,
      error: "Audio generation failed",
      message: error.message,
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Enhanced Audio Generation API",
  });
});

// Get available voices
app.get("/api/voices", (req, res) => {
  try {
    const voices = audioService.getAvailableVoices();
    res.json({
      success: true,
      data: voices,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get voices",
      message: error.message,
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(
    `🚀 Enhanced Audio Generation Test Server running on port ${PORT}`
  );
  console.log(`🔗 Test endpoint: http://localhost:${PORT}/api/test-audio`);
  console.log(`🎤 Available voices: http://localhost:${PORT}/api/voices`);
  console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
});
