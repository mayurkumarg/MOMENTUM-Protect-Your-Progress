// Thin transport around Groq's OpenAI-compatible chat completions API. This is
// the ONLY place that knows how to talk to the LLM provider — the model, the
// endpoint, and the key all live here, so swapping providers later (or adding
// streaming) is a change to this one file. Uses axios, already a dependency and
// the same HTTP client github.service uses.

const axios = require('axios');
const AppError = require('../../utils/AppError');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 30000;

const getApiKey = () => process.env.GROQ_API_KEY || '';
const getModel = () => process.env.GROQ_MODEL || DEFAULT_MODEL;

const isConfigured = () => Boolean(getApiKey());

// messages: [{ role: 'system' | 'user' | 'assistant', content: string }]
const createChatCompletion = async (messages, { temperature = 0.4, maxTokens = 1024 } = {}) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new AppError('The AI assistant is not configured yet. Add a GROQ_API_KEY to enable it.', 503);
  }

  try {
    const response = await axios.post(
      GROQ_URL,
      {
        model: getModel(),
        messages,
        temperature,
        max_tokens: maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;

    if (!reply || !reply.trim()) {
      throw new AppError('The assistant returned an empty response. Please try again.', 502);
    }

    return {
      content: reply.trim(),
      model: response.data?.model || getModel(),
      usage: response.data?.usage || null,
    };
  } catch (error) {
    if (error.isOperational) throw error;

    if (error.code === 'ECONNABORTED') {
      throw new AppError('The assistant took too long to respond. Please try again.', 504);
    }

    const status = error.response?.status;
    if (status === 401) {
      throw new AppError('The assistant credentials are invalid. Check GROQ_API_KEY.', 502);
    }
    if (status === 429) {
      throw new AppError('The assistant is rate-limited right now. Please wait a moment and try again.', 429);
    }

    // Log the real provider error server-side; keep the client message generic.
    console.error('[assistant] Groq request failed:', error.response?.data || error.message);
    throw new AppError('The assistant is temporarily unavailable. Please try again.', 502);
  }
};

module.exports = {
  createChatCompletion,
  isConfigured,
  getModel,
};
