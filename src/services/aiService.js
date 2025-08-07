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
    } = businessDetails;

    const prompt = this.buildPrompt(businessDetails);

    try {
      const startTime = Date.now();

      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
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
    } = businessDetails;

    return `
You are an expert Nepali SEO content creator specializing in voice search optimization for local businesses.

Create comprehensive voice-search optimized content for:
- Business: ${businessName}
- Type: ${businessType}
- Location: ${location}, Nepal
${productsServices ? `- Products/Services: ${productsServices}` : ""}
${targetCustomers ? `- Target Customers: ${targetCustomers}` : ""}

Generate the following content:

1. **BUSINESS DESCRIPTION** (150-200 words):
   - Voice-search friendly description
   - Include natural language phrases locals would use
   - Incorporate location-specific keywords
   - Make it conversational for voice assistants
   - Include phrases like "best ${businessType} in ${location}" and "near me" variations

2. **5 FREQUENTLY ASKED QUESTIONS**:
   - Questions locals commonly ask about this business type
   - Include voice search patterns (What, Where, When, How, Why)
   - Provide concise, helpful answers
   - Use natural, conversational language

3. **VOICE SEARCH KEYWORDS**:
   - List 10 key phrases for voice search optimization
   - Include local variations and colloquial terms

Format the response with clear headings and make it ready for website implementation.
Focus on Nepali market context and local search behavior.
`;
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
        max_tokens: 10,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  static async generateModifiedContent(prompt) {
    try {
      const startTime = Date.now();

      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
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
      console.error("Groq API Error (Modify Content):", error.message);
      throw this.handleGroqError(error);
    }
  }
}
