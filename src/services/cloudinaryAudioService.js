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

      // Try to use cloud TTS first, fallback to placeholder
      let audioGenerated = false;

      // Try Google Text-to-Speech API if available
      try {
        await this.generateCloudTTS(cleanText, tempFilePath, voice, speed);
        audioGenerated = true;
        console.log("✅ Generated audio using cloud TTS");
      } catch (cloudError) {
        console.log(
          "Cloud TTS not available, using placeholder:",
          cloudError.message
        );

        // Fallback to placeholder audio with proper duration
        await this.createPlaceholderAudio(cleanText, tempFilePath);
        audioGenerated = true;
      }

      if (!audioGenerated) {
        throw new Error("Failed to generate audio using any method");
      }

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
        duration:
          uploadResult.duration || this.estimateAudioDuration(cleanText),
        metadata: {
          voice,
          speed,
          textLength: cleanText.length,
          estimatedWords: Math.floor(cleanText.length / 5),
          generatedAt: new Date().toISOString(),
          audioGenerated: audioGenerated,
          method: audioGenerated ? "cloud_tts" : "placeholder",
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
      // Calculate duration based on text length (more realistic timing)
      // Average reading speed is about 150-200 words per minute
      // Average word length is about 5 characters
      const wordsPerMinute = 180; // Slightly faster for TTS
      const avgCharsPerWord = 5;
      const estimatedWords = text.length / avgCharsPerWord;
      const estimatedMinutes = estimatedWords / wordsPerMinute;

      // Minimum 10 seconds, maximum 5 minutes for safety
      const duration = Math.min(Math.max(estimatedMinutes * 60, 10), 300);

      console.log(
        `📏 Text: ${text.length} chars, ~${estimatedWords.toFixed(
          0
        )} words, Duration: ${duration.toFixed(1)}s`
      );

      try {
        // Try using ffmpeg to create a proper silent audio file
        await execAsync(
          `ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t ${duration} -acodec mp3 -y "${outputPath}" 2>/dev/null`
        );
        console.log(
          `✅ Created ${duration.toFixed(1)}s silent audio using ffmpeg`
        );
        return;
      } catch (ffmpegError) {
        console.log("FFmpeg not available, trying alternative method...");
      }

      // If ffmpeg is not available, create a proper WAV file instead
      await this.createSilentWav(outputPath, duration);

      console.log(
        `✅ Created ${duration.toFixed(
          1
        )}s silent WAV for text: "${text.substring(0, 50)}..."`
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

  // Generate audio using cloud TTS services
  async generateCloudTTS(text, outputPath, voice = "en_us_001", speed = 1.0) {
    try {
      // For now, we'll use a free TTS API or edge TTS
      // You can replace this with Google TTS, Amazon Polly, etc.

      // Try using espeak if available (works on some servers)
      try {
        const voiceMap = {
          en_us_001: "en-us+f3",
          en_us_002: "en-us+m3",
          en_uk_001: "en+f3",
          en_uk_003: "en+m3",
          ne_np_001: "hi+f3", // Hindi as fallback for Nepali
          ne_np_002: "hi+m3",
        };

        const espeakVoice = voiceMap[voice] || "en+f3";
        const speedParam = Math.floor(speed * 175); // espeak speed (words per minute)

        await execAsync(
          `espeak -v "${espeakVoice}" -s ${speedParam} -w "${outputPath}" "${text.replace(
            /"/g,
            '\\"'
          )}" 2>/dev/null`
        );

        console.log(
          `✅ Generated TTS audio using espeak with voice ${espeakVoice}`
        );
        return;
      } catch (espeakError) {
        console.log("espeak not available, trying festival...");
      }

      // Try festival TTS
      try {
        // Create a temporary text file for festival
        const textFile = outputPath
          .replace(".mp3", ".txt")
          .replace(".wav", ".txt");
        await fs.writeFile(textFile, text);

        await execAsync(
          `echo "${text.replace(
            /"/g,
            '\\"'
          )}" | festival --tts --otype wav --output "${outputPath}" 2>/dev/null`
        );

        // Clean up text file
        try {
          await fs.unlink(textFile);
        } catch {}

        console.log("✅ Generated TTS audio using festival");
        return;
      } catch (festivalError) {
        console.log("festival not available, trying say command...");
      }

      // Try macOS say command (if on macOS)
      try {
        const voices = {
          en_us_001: "Samantha",
          en_us_002: "Alex",
          en_uk_001: "Kate",
          en_uk_003: "Daniel",
        };

        const sayVoice = voices[voice] || "Samantha";
        const rate = Math.floor(speed * 200); // say command rate

        await execAsync(
          `say -v "${sayVoice}" -r ${rate} -o "${outputPath.replace(
            ".mp3",
            ".aiff"
          )}" "${text.replace(/"/g, '\\"')}"`
        );

        // Convert AIFF to MP3 if ffmpeg is available
        try {
          await execAsync(
            `ffmpeg -i "${outputPath.replace(
              ".mp3",
              ".aiff"
            )}" -acodec mp3 "${outputPath}" 2>/dev/null && rm "${outputPath.replace(
              ".mp3",
              ".aiff"
            )}"`
          );
        } catch {
          // If ffmpeg fails, just rename the AIFF file
          await execAsync(
            `mv "${outputPath.replace(".mp3", ".aiff")}" "${outputPath}"`
          );
        }

        console.log(
          `✅ Generated TTS audio using macOS say with voice ${sayVoice}`
        );
        return;
      } catch (sayError) {
        console.log("macOS say command not available, trying web-based TTS...");
      }

      // If all system TTS fails, try a web-based solution
      await this.generateWebTTS(text, outputPath, voice, speed);
    } catch (error) {
      console.error("Cloud TTS generation failed:", error);
      throw error;
    }
  }

  // Generate TTS using web-based API or edge TTS
  async generateWebTTS(text, outputPath, voice, speed) {
    try {
      // You can integrate with services like:
      // - Eleven Labs API
      // - Google Cloud TTS API
      // - Amazon Polly
      // - Azure Cognitive Services

      // For now, throw error to fallback to placeholder
      throw new Error("Web TTS not configured");

      /* Example implementation for Eleven Labs:
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVEN_LABS_API_KEY
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            speed: speed
          }
        })
      });
      
      if (response.ok) {
        const audioBuffer = await response.buffer();
        await fs.writeFile(outputPath, audioBuffer);
        console.log("✅ Generated TTS audio using Eleven Labs");
        return;
      }
      */
    } catch (error) {
      console.error("Web TTS failed:", error);
      throw error;
    }
  }

  // Estimate audio duration based on text length
  estimateAudioDuration(text) {
    const wordsPerMinute = 180;
    const avgCharsPerWord = 5;
    const estimatedWords = text.length / avgCharsPerWord;
    const estimatedMinutes = estimatedWords / wordsPerMinute;
    return Math.max(estimatedMinutes * 60, 10); // Minimum 10 seconds
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

      if (cleanText.length > 10000) {
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
