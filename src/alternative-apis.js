// Alternative Free AI APIs - Copy and replace in index.js as needed

// =============================================================================
// 1. TOGETHER AI (Free Credits + Good Models)
// =============================================================================
const Together = require("together-ai");
const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY, // Get from https://api.together.xyz
});

// Together AI implementation
async function generateWithTogether(prompt) {
  const completion = await together.chat.completions.create({
    model: "meta-llama/Llama-3-8b-chat-hf",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });
  return completion.choices[0].message.content;
}

// =============================================================================
// 2. HUGGING FACE (Free API)
// =============================================================================
const { HfInference } = require("@huggingface/inference");
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY); // Get from https://huggingface.co/settings/tokens

// Hugging Face implementation
async function generateWithHuggingFace(prompt) {
  const response = await hf.textGeneration({
    model: "microsoft/DialoGPT-large",
    inputs: prompt,
    parameters: {
      max_new_tokens: 500,
      temperature: 0.7,
    },
  });
  return response.generated_text;
}

// =============================================================================
// 3. COHERE (Free Tier)
// =============================================================================
const { CohereClient } = require("cohere-ai");
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY, // Get from https://dashboard.cohere.com/api-keys
});

// Cohere implementation
async function generateWithCohere(prompt) {
  const response = await cohere.generate({
    model: "command-light",
    prompt: prompt,
    max_tokens: 500,
    temperature: 0.7,
  });
  return response.generations[0].text;
}

// =============================================================================
// 4. REPLICATE (Free Credits)
// =============================================================================
const Replicate = require("replicate");
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN, // Get from https://replicate.com/account/api-tokens
});

// Replicate implementation
async function generateWithReplicate(prompt) {
  const output = await replicate.run(
    "meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3",
    {
      input: {
        prompt: prompt,
        max_new_tokens: 500,
        temperature: 0.7,
      },
    }
  );
  return output.join("");
}

module.exports = {
  generateWithTogether,
  generateWithHuggingFace,
  generateWithCohere,
  generateWithReplicate,
};
