import audioService from "./src/services/cloudinaryAudioService.js";

async function testRealTTS() {
  console.log("🎤 Testing REAL TTS Generation...");
  console.log("=================================");

  try {
    // Test with realistic content
    const testTexts = [
      "Hello! This is a test of our voice generation system. Can you hear me speaking clearly?",
      "Welcome to Voice AI Content Generator. We create amazing content for your business.",
      "नमस्ते! यो हाम्रो आवाज उत्पादन प्रणालीको परीक्षण हो।", // Nepali text
    ];

    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i];
      const voice = i === 2 ? "ne_np_001" : "en_us_001"; // Use Nepali voice for Nepali text

      console.log(`\n📝 Test ${i + 1}: "${text.substring(0, 50)}..."`);
      console.log(`🎯 Voice: ${voice}`);
      console.log("🚀 Generating audio...");

      const startTime = Date.now();

      try {
        const result = await audioService.generateAudio(text, {
          voice: voice,
          speed: 1.0,
          language: i === 2 ? "ne" : "en",
        });

        const duration = Date.now() - startTime;

        console.log("✅ SUCCESS!");
        console.log(`🔗 Audio URL: ${result.audioUrl}`);
        console.log(`⏱️ Duration: ${result.duration} seconds`);
        console.log(`📊 Method: ${result.metadata.method}`);
        console.log(
          `📏 File size: ${result.metadata.fileSize || "Unknown"} bytes`
        );
        console.log(`⚡ Generation time: ${duration}ms`);

        // Check if it's real TTS (not placeholder)
        if (
          result.metadata.method.includes("google") ||
          result.metadata.method.includes("web") ||
          result.metadata.method.includes("system")
        ) {
          console.log("🎉 REAL TTS WORKING! 🎉");
        } else {
          console.log("⚠️  Using placeholder/fallback audio");
        }
      } catch (error) {
        console.error(`❌ Test ${i + 1} failed:`, error.message);
      }
    }

    console.log("\n🏁 TTS Testing Complete!");
  } catch (error) {
    console.error("💥 Test setup failed:", error);
  }
}

// Run the test
testRealTTS()
  .then(() => {
    console.log("🎯 Test finished - check logs above for results");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Test crashed:", error);
    process.exit(1);
  });
