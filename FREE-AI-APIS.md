# Free AI API Alternatives Setup Guide

## 🚀 Current Setup: Groq (RECOMMENDED)

Your app is now configured to use **Groq** - the fastest free AI API.

### Steps to get Groq working:

1. Go to https://console.groq.com/
2. Sign up for free account
3. Get your API key
4. Replace `your_groq_api_key_here` in `.env` file

**Free Limits:** 6,000 requests/day ✅

---

## 🔄 Alternative Free APIs (If Groq runs out)

### 1. **Together AI**

- **Free Credits:** $25 free credits monthly
- **Best Models:** Llama 3, CodeLlama, Mixtral
- **Setup:** https://api.together.xyz
- **Install:** `npm install together-ai`

### 2. **Hugging Face**

- **Free Tier:** 30,000 requests/month
- **Models:** Open source models
- **Setup:** https://huggingface.co/settings/tokens
- **Install:** `npm install @huggingface/inference`

### 3. **Cohere**

- **Free Tier:** 100 requests/month
- **Quality:** Very good for text generation
- **Setup:** https://dashboard.cohere.com/api-keys
- **Install:** `npm install cohere-ai`

### 4. **Replicate**

- **Free Credits:** $10/month free
- **Models:** Llama 2, Code models
- **Setup:** https://replicate.com/account/api-tokens
- **Install:** `npm install replicate`

### 5. **Local AI (Completely Free)**

- **Ollama:** Run models locally
- **Setup:** `brew install ollama` then `ollama run llama3`
- **No API limits!**

---

## 📦 Quick Install Commands

```bash
# For all alternatives
npm install together-ai @huggingface/inference cohere-ai replicate

# For local AI
brew install ollama
ollama run llama3
```

---

## 🔧 How to Switch APIs

1. Copy the code from `src/alternative-apis.js`
2. Replace the API call in `src/index.js`
3. Add the respective API key to `.env`
4. Install the required package

---

## 💡 Best Strategy

1. **Start with Groq** (current setup) - 6k requests/day
2. **Backup with Together AI** - $25 free credits
3. **Use Hugging Face** for lighter tasks
4. **Go local with Ollama** for unlimited usage

Your current setup with Groq should handle most use cases for free!
