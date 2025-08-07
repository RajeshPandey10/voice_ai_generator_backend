import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export class AIService {
  static async generateContent(businessDetails) {
    const {
      businessName,
      location,
      businessType,
      productsServices,
      targetCustomers,
      preferredLanguage = "en",
    } = businessDetails;

    const prompt = this.buildPrompt(businessDetails);

    try {
      const startTime = Date.now();

      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200, // Increased for longer content
        temperature: 0.7,
      });

      const endTime = Date.now();
      const generationTime = endTime - startTime;

      const content = completion.choices[0].message.content;
      const tokensUsed = completion.usage?.total_tokens || 0;

      return {
        content,
        tokensUsed,
        generationTime,
        model: "llama-3.1-8b-instant",
      };
    } catch (error) {
      console.error("Groq API Error:", error.message);
      throw this.handleGroqError(error);
    }
  }

  static buildPrompt(businessDetails) {
    const {
      businessName,
      location,
      businessType,
      productsServices,
      targetCustomers,
      preferredLanguage = "en",
    } = businessDetails;

    const isNepali = preferredLanguage === "ne";

    if (isNepali) {
      return `You are an expert content creator for Nepali businesses. Create engaging content in Nepali language for: ${businessName}, a ${businessType} in ${location}. Products/Services: ${productsServices}. Target: ${targetCustomers}. Write natural, storytelling content without technical formatting that sounds great when read aloud.`;
    }

    // English storytelling prompt
    return `You are an expert storytelling content creator. Create engaging, natural-sounding content for: ${businessName}, a ${businessType} located in ${location}, Nepal. Products/Services: ${productsServices}. Target customers: ${targetCustomers}.

Write a compelling business story that flows naturally when read aloud. Create content that tells the story of what makes this business special. Use conversational language that sounds smooth when spoken. Include local context for Nepal. Avoid technical jargon, word counts, or formatting instructions. Focus on benefits and emotional connection. Use smooth transitions and natural voice search phrases. Make it sound like a professional storyteller describing the business.

Then add 5 customer questions with storytelling answers that sound natural when spoken. Each answer should be 2-3 flowing sentences.

Finally, include 5 natural phrases locals might use when searching, using conversational language.

Write everything as flowing narrative without bullet points, technical specs, or formatting symbols. Make it perfect for audio narration.`;
  }

  static handleGroqError(error) {
    if (error.status === 429) {
      return new Error(
        "AI service is temporarily overloaded. Please try again in a moment."
      );
    } else if (error.status === 401) {
      return new Error(
        "AI service authentication failed. Please contact support."
      );
    } else if (error.status === 400) {
      return new Error(
        "Invalid request to AI service. Please check your input."
      );
    } else {
      return new Error(
        "AI service is currently unavailable. Please try again later."
      );
    }
  }

  static async validateApiKey() {
    try {
      await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "Test" }],
        max_tokens: 1,
      });
      return true;
    } catch (error) {
      console.error("API Key validation failed:", error.message);
      return false;
    }
  }

  static modifyContent(originalContent, modifications) {
    // Create a prompt for content modification
    const prompt = `
You are an expert content editor. Please modify the following business content based on these requested changes:

Original Content:
${originalContent}

Requested Modifications:
${modifications}

Please provide the improved content that maintains the storytelling style and flows naturally when read aloud. Keep it engaging and conversational.
`;

    return this.generateModifiedContent(prompt);
  }

  static async generateModifiedContent(prompt) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
        temperature: 0.7,
      });

      const content = completion.choices[0].message.content;
      const tokensUsed = completion.usage?.total_tokens || 0;

      return {
        content,
        tokensUsed,
        model: "llama-3.1-8b-instant",
      };
    } catch (error) {
      console.error("Content modification error:", error.message);
      throw this.handleGroqError(error);
    }
  }
}
