import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import { cloudinary } from "../config/cloudinary.js";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AudioService {
  constructor() {
    this.tempDir = path.join(__dirname, "../../temp");
    this.ensureTempDirectory();
  }

  async ensureTempDirectory() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create temp directory:", error);
    }
  }

  // Clean and optimize text for storytelling TTS
  cleanTextForTTS(text, language = "en") {
    if (!text || typeof text !== "string") {
      return "";
    }

    // Remove technical formatting and metadata that shouldn't be spoken
    let cleanText = text
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Remove markdown headers and formatting
      .replace(/#{1,6}\s*/g, "")
      .replace(/[*_`~]/g, "")
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, "")
      // Remove email addresses
      .replace(/\S+@\S+\.\S+/g, "")
      // Remove word count indicators (e.g., "200-300 words", "150 words")
      .replace(/\b\d{1,4}[-–]\d{1,4}\s*words?\b/gi, "")
      .replace(/\b\d{1,4}\s*words?\b/gi, "")
      // Remove character count indicators
      .replace(/\b\d{1,4}[-–]\d{1,4}\s*characters?\b/gi, "")
      .replace(/\b\d{1,4}\s*characters?\b/gi, "")
      // Remove section numbering (1., 2., etc.)
      .replace(/^\d+\.\s*/gm, "")
      // Remove bullet points and list markers
      .replace(/^[•\-\*]\s*/gm, "")
      // Remove excessive whitespace
      .replace(/\s+/g, " ")
      .trim();

    // Language-specific optimizations
    if (language === "ne") {
      // Nepali-specific text cleaning
      cleanText = cleanText
        // Remove common Nepali formatting markers
        .replace(/।\s*।/g, "।")
        .replace(/\s*।\s*/g, "। ");
    }

    // Ensure proper sentence endings for natural speech flow
    cleanText = cleanText
      .replace(/([.!?])\s*([A-Z])/g, "$1 $2")
      .replace(/([.!?])\s*$/g, "$1");

    return cleanText;
  }

  // Generate TikTok-style storytelling voice
  async generateTikTokVoice(text, speed = 1.0, voice = "en_us_001") {
    try {
      const cleanText = this.cleanTextForTTS(text);
      if (!cleanText) {
        throw new Error("No valid text provided for TTS generation");
      }

      // Create temporary file for audio generation
      const tempFileName = `temp_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 15)}.mp3`;
      const tempFilePath = path.join(this.tempDir, tempFileName);

      // For now, create placeholder audio since TTS engines aren't available on Render
      // In production, integrate with cloud TTS services
      console.log("Generating placeholder audio for deployment environment");
      await this.createPlaceholderAudio(cleanText, tempFilePath);

      // Upload to Cloudinary with proper audio settings
      const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
        folder: "voice-ai-audio",
        resource_type: "auto", // Let Cloudinary auto-detect
        public_id: `audio_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 15)}`,
        format: "mp3", // Convert to MP3 if needed
        audio_codec: "mp3",
        quality: "auto:good",
      });

      // Clean up temporary file
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        console.warn("Failed to cleanup temp file:", cleanupError);
      }

      return {
        success: true,
        audioUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        duration: uploadResult.duration,
        metadata: {
          voice,
          speed,
          textLength: cleanText.length,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("TikTok voice generation failed:", error);
      throw new Error(`Audio generation failed: ${error.message}`);
    }
  }

  // Create proper audio file using ffmpeg or return a cloud TTS URL
  async createPlaceholderAudio(text, outputPath) {
    try {
      // Try to create a proper silent audio file using ffmpeg
      // This is more reliable than creating a fake MP3 header

      const duration = Math.min(Math.max(text.length * 0.05, 1), 30); // 1-30 seconds based on text length

      try {
        // Try using ffmpeg to create a proper silent audio file
        await execAsync(
          `ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t ${duration} -acodec mp3 -y "${outputPath}" 2>/dev/null`
        );
        console.log(`✅ Created ${duration}s silent audio using ffmpeg`);
        return;
      } catch (ffmpegError) {
        console.log("FFmpeg not available, trying alternative method...");
      }

      // If ffmpeg is not available, create a proper WAV file instead
      await this.createSilentWav(outputPath, duration);

      console.log(
        `✅ Created ${duration}s silent WAV for text: "${text.substring(
          0,
          50
        )}..."`
      );
    } catch (error) {
      console.error("Failed to create placeholder audio:", error);
      throw error;
    }
  }

  // Create a proper silent WAV file
  async createSilentWav(outputPath, durationSeconds = 2) {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const numChannels = 1; // Mono
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = numSamples * blockAlign;
    const chunkSize = 36 + dataSize;

    // Create WAV header
    const header = Buffer.alloc(44);

    // RIFF chunk descriptor
    header.write("RIFF", 0);
    header.writeUInt32LE(chunkSize, 4);
    header.write("WAVE", 8);

    // fmt sub-chunk
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // Sub-chunk size
    header.writeUInt16LE(1, 20); // Audio format (PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);

    // Create silent audio data (all zeros)
    const audioData = Buffer.alloc(dataSize, 0);

    // Combine header and data
    const wavFile = Buffer.concat([header, audioData]);

    // Write to file
    await fs.writeFile(outputPath, wavFile);
  }

  // Generate audio with different voice options
  async generateAudio(text, options = {}) {
    const {
      voice = "en_us_001",
      speed = 1.0,
      style = "storytelling",
      language = "en",
    } = options;

    try {
      // Clean text based on language
      const cleanText = this.cleanTextForTTS(text, language);

      if (!cleanText || cleanText.length < 10) {
        throw new Error("Text too short or invalid for audio generation");
      }

      if (cleanText.length > 5000) {
        throw new Error(
          "Text too long for audio generation (max 5000 characters)"
        );
      }

      // Generate audio using TikTok-style voice
      const result = await this.generateTikTokVoice(cleanText, speed, voice);

      return result;
    } catch (error) {
      console.error("Audio generation error:", error);
      throw error;
    }
  }

  // Get audio file from Cloudinary
  async getAudioFile(publicId) {
    try {
      const resource = await cloudinary.api.resource(publicId, {
        resource_type: "auto",
      });

      return {
        success: true,
        audioUrl: resource.secure_url,
        metadata: {
          publicId: resource.public_id,
          duration: resource.duration,
          format: resource.format,
          bytes: resource.bytes,
          createdAt: resource.created_at,
        },
      };
    } catch (error) {
      console.error("Failed to get audio file:", error);
      throw new Error("Audio file not found");
    }
  }

  // Delete audio file from Cloudinary
  async deleteAudioFile(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "auto",
      });

      return {
        success: result.result === "ok",
        message:
          result.result === "ok"
            ? "Audio deleted successfully"
            : "Audio not found",
      };
    } catch (error) {
      console.error("Failed to delete audio file:", error);
      throw new Error("Failed to delete audio file");
    }
  }

  // List all audio files (for admin/debugging)
  async listAudioFiles() {
    try {
      const result = await cloudinary.search
        .expression("folder:voice-ai-audio")
        .with_field("context")
        .with_field("tags")
        .max_results(100)
        .execute();

      return {
        success: true,
        files: result.resources.map((resource) => ({
          publicId: resource.public_id,
          url: resource.secure_url,
          format: resource.format,
          bytes: resource.bytes,
          duration: resource.duration,
          createdAt: resource.created_at,
        })),
      };
    } catch (error) {
      console.error("Failed to list audio files:", error);
      throw new Error("Failed to list audio files");
    }
  }

  // Get available voices
  getAvailableVoices() {
    return {
      english: [
        { id: "en_us_001", name: "US English Female", language: "en" },
        { id: "en_us_002", name: "US English Male", language: "en" },
        { id: "en_uk_001", name: "UK English Female", language: "en" },
        { id: "en_uk_003", name: "UK English Male", language: "en" },
        { id: "en_au_001", name: "Australian English Female", language: "en" },
        { id: "en_au_002", name: "Australian English Male", language: "en" },
      ],
      nepali: [
        { id: "ne_np_001", name: "Nepali Female", language: "ne" },
        { id: "ne_np_002", name: "Nepali Male", language: "ne" },
      ],
      multilingual: [
        {
          id: "multilingual_001",
          name: "Multilingual Female",
          language: "multi",
        },
        {
          id: "multilingual_002",
          name: "Multilingual Male",
          language: "multi",
        },
      ],
    };
  }

  // Get voice recommendations based on content type
  getVoiceRecommendation(contentType, language = "en") {
    const recommendations = {
      en: {
        story: "en_us_001", // Warm female voice for stories
        business: "en_us_002", // Professional male voice
        social: "en_uk_001", // Engaging UK female voice
        educational: "en_au_001", // Clear Australian voice
        entertainment: "en_uk_003", // Dynamic UK male voice
      },
      ne: {
        story: "ne_np_001", // Nepali female for stories
        business: "ne_np_002", // Nepali male for business
        social: "ne_np_001", // Nepali female for social
        educational: "ne_np_002", // Nepali male for education
        entertainment: "ne_np_001", // Nepali female for entertainment
      },
    };

    return (
      recommendations[language]?.[contentType] ||
      recommendations[language]?.story ||
      "en_us_001"
    );
  }
}

export default new AudioService();
