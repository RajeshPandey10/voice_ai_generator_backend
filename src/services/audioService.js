import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AudioService {
  constructor() {
    this.audioDir = path.join(__dirname, "../../uploads/audio");
    this.ensureAudioDirectory();
  }

  async ensureAudioDirectory() {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create audio directory:", error);
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
      .replace(/^[-•*]\s*/gm, "")
      // Remove brackets with numbers [1], [2], etc.
      .replace(/\[\d+\]/g, "")
      // Remove parenthetical instructions like (approx. 200 words)
      .replace(/\([^)]*\d+[^)]*words?[^)]*\)/gi, "")
      .replace(/\([^)]*words?[^)]*\d+[^)]*\)/gi, "")
      // Remove hashtags and social media formatting
      .replace(/#\w+/g, "")
      // Convert multiple dots to single period
      .replace(/\.{2,}/g, ".")
      // Fix spacing around punctuation
      .replace(/\s+([.,!?;:])/g, "$1")
      .replace(/([.,!?;:])\s+/g, "$1 ")
      // Add natural pauses for better flow
      .replace(/\.\s*/g, ". ")
      .replace(/,\s*/g, ", ")
      .replace(/!\s*/g, "! ")
      .replace(/\?\s*/g, "? ")
      // Remove extra whitespace and normalize
      .replace(/\s+/g, " ")
      .trim();

    // Language-specific cleaning
    if (language === "ne") {
      // Keep Nepali characters and devanagari script
      cleanText = cleanText.replace(/[^\u0900-\u097F\w\s.,!?;:()\-'"]/g, "");
    } else {
      // For English, remove non-latin characters except punctuation
      cleanText = cleanText.replace(/[^\x00-\x7F]/g, "");
    }

    // Don't truncate - let the full content be narrated
    // Instead of limiting to 200-300 chars, allow up to 2000 chars for storytelling
    const maxLength = language === "ne" ? 1500 : 2000;
    if (cleanText.length > maxLength) {
      // Try to cut at sentence boundary
      const sentences = cleanText.split(/[.!?]+/);
      let result = "";
      for (const sentence of sentences) {
        const newLength = (result + sentence + ". ").length;
        if (newLength <= maxLength) {
          result += sentence.trim() + ". ";
        } else {
          break;
        }
      }
      cleanText = result.trim() || cleanText.substring(0, maxLength);
    }

    // Add storytelling improvements
    cleanText = this.enhanceForStorytelling(cleanText, language);

    return cleanText.trim();
  }

  // Enhance text for storytelling narration
  enhanceForStorytelling(text, language = "en") {
    // Add natural pauses and emphasis for better storytelling flow
    let enhanced = text
      // Add emphasis for business names (assuming they're often capitalized)
      .replace(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g, (match) => {
        // Don't emphasize common words
        const commonWords = [
          "The",
          "And",
          "Or",
          "But",
          "For",
          "With",
          "At",
          "In",
          "On",
        ];
        if (!commonWords.includes(match)) {
          return match; // TTS engines often handle capitalization well
        }
        return match;
      })
      // Add slight pauses after introductory phrases
      .replace(
        /\b(Welcome to|Introducing|About|Our|We are|We offer|Located in|Established in)\b/gi,
        "$1,"
      )
      // Add pauses before concluding statements
      .replace(/\b(Therefore|Thus|In conclusion|Finally|Overall)\b/gi, ", $1,")
      // Improve flow for lists
      .replace(/\b(including|such as|like|for example)\s*/gi, "$1, ")
      // Add natural breaks for better pacing
      .replace(/([.!?])\s*([A-Z])/g, "$1 $2");

    return enhanced;
  }

  async generateAudio(text, language = "en", voice = "default") {
    try {
      // Clean and optimize text for TTS
      const cleanedText = this.cleanTextForTTS(text, language);

      if (!cleanedText) {
        throw new Error("No valid text to convert to speech");
      }

      console.log(
        "Generating audio for cleaned text:",
        cleanedText.substring(0, 100) + "..."
      );
      console.log(
        "Original length:",
        text.length,
        "Cleaned length:",
        cleanedText.length
      );

      // Try different TTS methods in order of preference
      let audioData;

      try {
        // Try free TikTok TTS API first
        audioData = await this.generateWithTikTokTTS(cleanedText, language);
        console.log("TikTok TTS generation successful");
      } catch (tikTokError) {
        console.log(
          "TikTok TTS failed, trying system TTS:",
          tikTokError.message
        );
        try {
          // Try system TTS
          audioData = await this.generateWithSystemTTS(cleanedText, language);
          console.log("System TTS generation successful");
        } catch (systemError) {
          console.log(
            "System TTS failed, creating valid MP3:",
            systemError.message
          );
          // Fallback to a valid MP3 with silence
          audioData = await this.createValidMP3(cleanedText, language);
        }
      }

      const filename = this.generateFilename(language, voice);
      const filepath = path.join(this.audioDir, filename);

      await fs.writeFile(filepath, audioData);

      // Get file stats for accurate file size
      const stats = await fs.stat(filepath);

      console.log("Audio generated successfully:", {
        filename,
        size: stats.size,
        language,
      });

      return {
        filename,
        filepath,
        url: `/uploads/audio/${filename}`,
        duration: Math.ceil(text.length / 15), // Rough estimate: 15 chars per second
        fileSize: stats.size,
        metadata: {
          sampleRate: 22050,
          format: "mp3",
          bitrate: 128,
          language,
        },
      };
    } catch (error) {
      console.error("Audio generation failed:", error);
      throw new Error("Failed to generate audio: " + error.message);
    }
  }

  async generateWithTikTokTTS(text, language) {
    // Use TikTok TTS API with better voices for storytelling
    try {
      const voiceId = this.getStorytellingVoiceId(language);

      // Split long text into chunks for better processing
      const chunks = this.splitTextIntoChunks(text, 280); // Slightly smaller chunks for better quality
      const audioBuffers = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(
          `Processing chunk ${i + 1}/${chunks.length}: ${chunk.substring(
            0,
            50
          )}...`
        );

        const response = await fetch(
          "https://api16-normal-c-useast1a.tiktokv.com/media/api/text/speech/invoke/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent":
                "com.zhiliaoapp.musically/2022600030 (Linux; U; Android 7.1.2; es_ES; SM-G988N; Build/NRD90M;tt-ok/3.12.13.1)",
            },
            body: new URLSearchParams({
              text_speaker: voiceId,
              req_text: chunk,
              speaker_map_type: "0",
              aid: "1233",
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`TikTok TTS API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status_code !== 0) {
          throw new Error(
            `TikTok TTS error: ${data.message || "Unknown error"}`
          );
        }

        if (!data.data || !data.data.v_str) {
          throw new Error("No audio data received from TikTok TTS");
        }

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(data.data.v_str, "base64");
        audioBuffers.push(audioBuffer);

        // Add small delay between requests to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // If we have multiple chunks, combine them
      if (audioBuffers.length > 1) {
        return await this.combineAudioBuffers(audioBuffers);
      } else {
        return audioBuffers[0];
      }

      if (audioBuffer.length < 100) {
        throw new Error("Invalid audio data received");
      }

      return audioBuffer;
    } catch (error) {
      console.error("TikTok TTS failed:", error);
      throw error;
    }
  }

  async generateWithSystemTTS(text, language) {
    // Only works on macOS with built-in 'say' command
    if (process.platform !== "darwin") {
      throw new Error("System TTS only available on macOS");
    }

    const filename = this.generateFilename(language, "temp");
    const tempFilepath = path.join(this.audioDir, filename);

    // Use macOS built-in say command with better voices and slower speed
    const voiceOptions = {
      en: ["Alex", "Victoria", "Allison"], // Professional English voices
      ne: ["Alex", "Victoria"], // Use English voices for Nepali
      hi: ["Alex", "Victoria"],
    };

    const availableVoices = voiceOptions[language] || voiceOptions.en;
    const selectedVoice =
      availableVoices[Math.floor(Math.random() * availableVoices.length)];

    const outputFile = tempFilepath.replace(".mp3", ".aiff");

    // Escape quotes and special characters in text
    const escapedText = text.replace(/"/g, '\\"').replace(/'/g, "\\'");

    // Add speech rate control for marketing content (slower, more engaging)
    const speechRate = 160; // Words per minute (default is ~200, we want slower)
    const command = `say -v ${selectedVoice} -r ${speechRate} "${escapedText}" -o "${outputFile}"`;

    try {
      await execAsync(command, { timeout: 30000 }); // 30 second timeout

      // Convert AIFF to MP3 if ffmpeg is available
      if (await this.checkFFmpeg()) {
        const mp3Path = tempFilepath;
        await execAsync(
          `ffmpeg -i "${outputFile}" -codec:a libmp3lame -b:a 128k "${mp3Path}" -y`,
          { timeout: 30000 }
        );
        await fs.unlink(outputFile);
        const audioData = await fs.readFile(mp3Path);
        await fs.unlink(mp3Path);
        return audioData;
      } else {
        // Return AIFF file (still valid audio)
        const audioData = await fs.readFile(outputFile);
        await fs.unlink(outputFile);
        return audioData;
      }
    } catch (error) {
      // Clean up any temporary files
      try {
        await fs.unlink(outputFile);
      } catch {}
      throw error;
    }
  }

  async createValidMP3(text, language) {
    // Create a valid MP3 file with silence as fallback
    try {
      const duration = Math.max(5, Math.ceil(text.length / 15)); // At least 5 seconds
      const filename = this.generateFilename(language, "temp");
      const filepath = path.join(this.audioDir, filename);

      if (await this.checkFFmpeg()) {
        // Generate silent MP3 with ffmpeg
        await execAsync(
          `ffmpeg -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=22050 -t ${duration} -codec:a libmp3lame -b:a 128k "${filepath}" -y`,
          { timeout: 10000 }
        );
        const audioData = await fs.readFile(filepath);
        await fs.unlink(filepath);
        return audioData;
      } else {
        // Return minimal valid MP3 header (silent audio)
        return this.createMinimalMP3(duration);
      }
    } catch (error) {
      console.error("Failed to create valid MP3:", error);
      // Return minimal MP3 header as last resort
      return this.createMinimalMP3(5);
    }
  }

  createMinimalMP3(duration) {
    // Create a minimal valid MP3 file with silence
    const mp3Header = Buffer.from([
      0xff,
      0xfb,
      0x90,
      0x00, // MP3 sync header
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);

    // Repeat the silent frame for the desired duration
    const frameSize = 144;
    const frames = Math.ceil(duration * 38.28); // Approximate frames per second
    const buffer = Buffer.alloc(frameSize * frames);

    for (let i = 0; i < frames; i++) {
      mp3Header.copy(
        buffer,
        i * frameSize,
        0,
        Math.min(mp3Header.length, frameSize)
      );
    }

    return buffer;
  }

  // Split text into chunks for better TTS processing
  splitTextIntoChunks(text, maxLength = 280) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const chunks = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      const proposedChunk = currentChunk
        ? `${currentChunk}. ${trimmedSentence}`
        : trimmedSentence;

      if (proposedChunk.length <= maxLength) {
        currentChunk = proposedChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + ".");
          currentChunk = trimmedSentence;
        } else {
          // If a single sentence is too long, split it by words
          const words = trimmedSentence.split(" ");
          let wordChunk = "";
          for (const word of words) {
            const proposedWordChunk = wordChunk ? `${wordChunk} ${word}` : word;
            if (proposedWordChunk.length <= maxLength) {
              wordChunk = proposedWordChunk;
            } else {
              if (wordChunk) {
                chunks.push(wordChunk + ".");
                wordChunk = word;
              } else {
                // Single word too long, just add it
                chunks.push(word + ".");
                wordChunk = "";
              }
            }
          }
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + ".");
    }

    return chunks.length > 0 ? chunks : [text];
  }

  // Combine multiple audio buffers into one
  async combineAudioBuffers(audioBuffers) {
    if (audioBuffers.length === 1) {
      return audioBuffers[0];
    }

    try {
      // If ffmpeg is available, use it to concatenate properly
      if (await this.checkFFmpeg()) {
        const tempFiles = [];
        const tempDir = path.join(this.audioDir, "temp");
        await fs.mkdir(tempDir, { recursive: true });

        // Save each buffer as a temporary file
        for (let i = 0; i < audioBuffers.length; i++) {
          const tempFile = path.join(tempDir, `chunk_${i}.mp3`);
          await fs.writeFile(tempFile, audioBuffers[i]);
          tempFiles.push(tempFile);
        }

        // Create concat file list
        const concatList = tempFiles.map((f) => `file '${f}'`).join("\n");
        const concatFile = path.join(tempDir, "concat.txt");
        await fs.writeFile(concatFile, concatList);

        // Combine using ffmpeg
        const outputFile = path.join(tempDir, "combined.mp3");
        await execAsync(
          `ffmpeg -f concat -safe 0 -i "${concatFile}" -c copy "${outputFile}" -y`,
          { timeout: 30000 }
        );

        const combinedBuffer = await fs.readFile(outputFile);

        // Cleanup
        for (const tempFile of tempFiles) {
          try {
            await fs.unlink(tempFile);
          } catch {}
        }
        try {
          await fs.unlink(concatFile);
        } catch {}
        try {
          await fs.unlink(outputFile);
        } catch {}
        try {
          await fs.rmdir(tempDir);
        } catch {}

        return combinedBuffer;
      } else {
        // Simple concatenation (not ideal but works)
        return Buffer.concat(audioBuffers);
      }
    } catch (error) {
      console.error("Failed to combine audio buffers:", error);
      // Fallback to simple concatenation
      return Buffer.concat(audioBuffers);
    }
  }

  // Get better storytelling voices
  getStorytellingVoiceId(language) {
    // Better TikTok TTS voice IDs for storytelling and business content
    const storytellingVoices = {
      en: [
        "en_us_001", // Professional narrator voice
        "en_us_006", // Clear business voice
        "en_us_007", // Engaging storyteller
        "en_us_009", // Warm professional
        "en_us_010", // Clear and articulate
        "en_female_f08_salut_damour", // Expressive female
        "en_male_narration", // Natural narrator
        "en_male_funny", // Engaging male voice
      ],
      ne: [
        "en_us_001", // Professional for Nepali content
        "en_us_006", // Clear pronunciation
        "en_us_007", // Good for mixed content
      ],
      hi: [
        "en_us_001", // Professional
        "en_us_006", // Clear
        "en_us_007", // Engaging
      ],
    };

    const availableVoices =
      storytellingVoices[language] || storytellingVoices.en;
    return availableVoices[Math.floor(Math.random() * availableVoices.length)];
  }

  getVoiceId(language) {
    // TikTok TTS voice IDs - Better quality voices for marketing content
    const voices = {
      en: "en_us_006", // English (Professional female voice - clearer)
      ne: "en_us_007", // Use clear English voice for Nepali text (better pronunciation)
      hi: "en_us_006", // Use professional English voice for Hindi
    };

    // Alternative voices for variety
    const alternativeVoices = {
      en: ["en_us_006", "en_us_007", "en_us_009", "en_us_010"], // Professional voices
      ne: ["en_us_006", "en_us_007"], // Clear voices that can handle mixed content
      hi: ["en_us_006", "en_us_007"],
    };

    // Randomly select from good voices for variety
    const availableVoices = alternativeVoices[language] || alternativeVoices.en;
    return availableVoices[Math.floor(Math.random() * availableVoices.length)];
  }

  async checkFFmpeg() {
    try {
      await execAsync("ffmpeg -version", { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  generateFilename(language, voice) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    return `audio_${language}_${voice}_${timestamp}_${randomString}.mp3`;
  }

  async deleteAudio(filename) {
    try {
      const filepath = path.join(this.audioDir, filename);
      await fs.unlink(filepath);
      console.log("Audio file deleted:", filename);
    } catch (error) {
      console.error("Failed to delete audio file:", error);
    }
  }

  // Get audio file info
  getAudioInfo(filename) {
    const filepath = path.join(this.audioDir, filename);
    return {
      filename,
      filepath,
      url: `/uploads/audio/${filename}`,
    };
  }
}

export default new AudioService();
