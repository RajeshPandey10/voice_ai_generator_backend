import audioService from "./src/services/cloudinaryAudioService.js";

async function testAudioGeneration() {
  console.log("🎵 Testing Audio Generation Service...");

  try {
    // Test with a simple text
    const testText =
      "Hello, this is a test of our enhanced audio generation system. We have multiple fallback methods to ensure audio is generated at any cost.";

    console.log("📝 Test text:", testText.substring(0, 50) + "...");
    console.log("🚀 Starting audio generation...");

    const result = await audioService.generateAudio(testText, {
      voice: "en_us_001",
      speed: 1.0,
      language: "en",
    });

    console.log("✅ Audio generation successful!");
    console.log("🔗 Audio URL:", result.audioUrl);
    console.log("⏱️ Duration:", result.duration, "seconds");
    console.log("📊 Method used:", result.metadata.method);
    console.log("📏 File size:", result.metadata.fileSize, "bytes");
  } catch (error) {
    console.error("❌ Audio generation failed:", error.message);
    console.error("🔍 Full error:", error);
  }
}

// Run the test
testAudioGeneration()
  .then(() => {
    console.log("🏁 Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Test failed:", error);
    process.exit(1);
  });
