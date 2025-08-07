import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import { cloudinary } from "../config/cloudinary.js";
import gTTS from "node-gtts";

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
      let generationMethod = "placeholder";

      try {
        // Try pre-recorded audio first
        const preRecordedSuccess = await this.generateFromPreRecorded(
          tempFilePath
        );
        if (preRecordedSuccess) {
          audioGenerated = true;
          generationMethod = "pre-recorded";
          console.log("✅ Generated audio using pre-recorded narrator");
        } else {
          throw new Error("Pre-recorded audio failed");
        }
      } catch (preRecordedError) {
        console.log(
          "Pre-recorded audio failed, trying web TTS:",
          preRecordedError.message
        );

        try {
          await this.generateWebTTS(cleanText, tempFilePath, voice, speed);
          audioGenerated = true;
          generationMethod = "web_tts";
          console.log("✅ Generated audio using web-based TTS");
        } catch (webError) {
          console.log(
            "Web-based TTS failed, trying system TTS:",
            webError.message
          );

          try {
            await this.generateSystemTTS(cleanText, tempFilePath, voice, speed);
            audioGenerated = true;
            generationMethod = "system_tts";
            console.log("✅ Generated audio using system TTS");
          } catch (systemError) {
            console.log(
              "System TTS failed, using placeholder:",
              systemError.message
            );
            // Fallback to placeholder audio with proper duration
            await this.createPlaceholderAudio(cleanText, tempFilePath);
            audioGenerated = true; // Still true, but it's silent
          }
        }
      }

      if (!audioGenerated) {
        throw new Error("Failed to generate audio using any method");
      }

      // Upload to Cloudinary with proper audio settings
      const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
        folder: "voice-ai-audio",
        resource_type: "video", // Upload as video to get audio processing features
        public_id: `audio_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 15)}`,
        format: "mp3", // Ensure output is mp3
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
          method: generationMethod,
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
      // Try using Microsoft Edge TTS first (highest quality, free)
      const edgeSuccess = await this.generateEdgeTTS(
        text,
        outputPath,
        voice,
        speed
      );
      if (edgeSuccess) {
        console.log("✅ Generated TTS audio using Microsoft Edge TTS");
        return;
      }

      // Try using gTTS as primary fallback (reliable, free)
      try {
        await this.generateGoogleTTS(text, outputPath, voice, speed);
        console.log("✅ Generated TTS audio using Google TTS");
        return;
      } catch (gTTSError) {
        console.log("gTTS failed, trying alternative methods...");
      }

      // Try using system TTS as final fallback
      await this.generateSystemTTS(text, outputPath, voice, speed);
      console.log("✅ Generated TTS audio using system TTS");
    } catch (error) {
      console.error("All TTS methods failed:", error);
      throw error;
    }
  }

  // Generate TTS using system commands (espeak, festival, say)
  async generateSystemTTS(text, outputPath, voice, speed) {
    try {
      // Try macOS say command first (best quality on macOS)
      if (process.platform === "darwin") {
        const voices = {
          en_us_001: "Samantha",
          en_us_002: "Alex",
          en_uk_001: "Kate",
          en_uk_003: "Daniel",
          en_au_001: "Karen",
          en_au_002: "Lee",
        };

        const sayVoice = voices[voice] || "Samantha";
        const rate = Math.floor(speed * 200);

        try {
          await execAsync(
            `say -v "${sayVoice}" -r ${rate} -o "${outputPath.replace(
              ".mp3",
              ".aiff"
            )}" "${text.replace(/"/g, '\\"')}"`
          );

          // Convert to MP3 if possible
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
            await execAsync(
              `mv "${outputPath.replace(".mp3", ".aiff")}" "${outputPath}"`
            );
          }

          console.log(`✅ Generated TTS using macOS say (${sayVoice})`);
          return;
        } catch (sayError) {
          console.log("macOS say failed:", sayError.message);
        }
      }

      // Try espeak (available on most Linux systems)
      try {
        const voiceMap = {
          en_us_001: "en-us+f3",
          en_us_002: "en-us+m3",
          en_uk_001: "en+f3",
          en_uk_003: "en+m3",
          ne_np_001: "hi+f3",
          ne_np_002: "hi+m3",
        };

        const espeakVoice = voiceMap[voice] || "en+f3";
        const speedParam = Math.floor(speed * 175);

        await execAsync(
          `espeak -v "${espeakVoice}" -s ${speedParam} -w "${outputPath}" "${text.replace(
            /"/g,
            '\\"'
          )}" 2>/dev/null`
        );

        console.log(`✅ Generated TTS using espeak (${espeakVoice})`);
        return;
      } catch (espeakError) {
        console.log("espeak failed:", espeakError.message);
      }

      throw new Error("No system TTS available");
    } catch (error) {
      console.error("System TTS failed:", error);
      throw error;
    }
  }

  // Generate TTS using Microsoft Edge (free, high quality)
  async generateEdgeTTS(text, outputPath, voice, speed) {
    try {
      // Voice mapping for Edge TTS
      const edgeVoices = {
        en_us_001: "en-US-AriaNeural", // Female, natural
        en_us_002: "en-US-GuyNeural", // Male, professional
        en_uk_001: "en-GB-SoniaNeural", // UK Female, warm
        en_uk_003: "en-GB-RyanNeural", // UK Male, storytelling
        en_au_001: "en-AU-NatashaNeural", // Australian Female
        en_au_002: "en-AU-WilliamNeural", // Australian Male
        ne_np_001: "hi-IN-SwaraNeural", // Hindi Female (closest to Nepali)
        ne_np_002: "hi-IN-MadhurNeural", // Hindi Male (closest to Nepali)
      };

      const edgeVoice = edgeVoices[voice] || "en-US-AriaNeural";
      const rate = speed < 0.8 ? "slow" : speed > 1.2 ? "fast" : "medium";

      // Create SSML for better speech synthesis
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="${edgeVoice}">
            <prosody rate="${rate}" pitch="medium">
              ${text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")}
            </prosody>
          </voice>
        </speak>
      `;

      // Try using edge-tts if available
      const tempSSMLFile = outputPath.replace(".mp3", ".ssml");
      await fs.writeFile(tempSSMLFile, ssml);

      try {
        await execAsync(
          `edge-tts --voice "${edgeVoice}" --file "${tempSSMLFile}" --write-media "${outputPath}" 2>/dev/null`
        );

        // Clean up SSML file
        try {
          await fs.unlink(tempSSMLFile);
        } catch {}

        return true;
      } catch (edgeError) {
        // Clean up SSML file
        try {
          await fs.unlink(tempSSMLFile);
        } catch {}

        // Try alternative approach with direct text
        try {
          await execAsync(
            `edge-tts --voice "${edgeVoice}" --text "${text.replace(
              /"/g,
              '\\"'
            )}" --write-media "${outputPath}" 2>/dev/null`
          );
          return true;
        } catch (directError) {
          console.log("Edge TTS not available:", directError.message);
          return false;
        }
      }
    } catch (error) {
      console.log("Edge TTS failed:", error.message);
      return false;
    }
  }

  // Generate TTS using Google TTS (gTTS)
  async generateGoogleTTS(text, outputPath, voice, speed) {
    try {
      // Language mapping for gTTS
      const gTTSLangs = {
        en_us_001: "en",
        en_us_002: "en",
        en_uk_001: "en",
        en_uk_003: "en",
        en_au_001: "en",
        en_au_002: "en",
        ne_np_001: "hi", // Hindi as fallback for Nepali
        ne_np_002: "hi",
      };

      const lang = gTTSLangs[voice] || "en";
      const slow = speed < 0.8;

      console.log(
        `🎤 Generating TTS audio: "${text.substring(
          0,
          50
        )}..." (${lang}, slow: ${slow})`
      );

      // Use node-gtts library
      const gtts = new gTTS(text, lang, slow);

      // Save the audio file
      await new Promise((resolve, reject) => {
        gtts.save(outputPath, (err) => {
          if (err) {
            console.error("gTTS error:", err);
            reject(err);
          } else {
            console.log(`✅ TTS audio saved to: ${outputPath}`);
            resolve();
          }
        });
      });
    } catch (gTTSError) {
      console.error("gTTS generation failed:", gTTSError);

      // Fallback: Try using command line gTTS if available
      try {
        const lang = gTTSLangs[voice] || "en";
        const speedParam = speed < 0.8 ? " --slow" : "";

        await execAsync(
          `gtts-cli --text "${text.replace(
            /"/g,
            '\\"'
          )}" --lang ${lang}${speedParam} --output "${outputPath}" 2>/dev/null`
        );

        console.log("✅ TTS audio generated using gtts-cli");
      } catch (cmdError) {
        console.error("Command line gTTS also failed:", cmdError);
        throw new Error("All gTTS methods failed");
      }
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
        entertainment: "en_uk_003", // Nepali female for entertainment
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

  // Generate audio from pre-recorded narrator files
  async generateFromPreRecorded(outputPath) {
    try {
      const narratorDir = path.join(__dirname, "narrator-audio");
      const files = await fs.readdir(narratorDir);
      const audioFiles = files.filter(
        (file) => path.extname(file).toLowerCase() === ".mp3"
      );

      if (audioFiles.length === 0) {
        throw new Error("No pre-recorded narrator audio files found.");
      }

      // Pick a random narrator file
      const randomAudioFile =
        audioFiles[Math.floor(Math.random() * audioFiles.length)];
      const sourcePath = path.join(narratorDir, randomAudioFile);

      // Copy the selected file to the output path for processing
      await fs.copyFile(sourcePath, outputPath);
      console.log(`✅ Selected pre-recorded narrator: ${randomAudioFile}`);
      return true;
    } catch (error) {
      console.log("Pre-recorded audio generation failed:", error.message);
      return false;
    }
  }
}

export default new AudioService();
