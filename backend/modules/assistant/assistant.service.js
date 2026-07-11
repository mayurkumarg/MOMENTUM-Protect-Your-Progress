// Orchestrates one assistant turn: takes the client's recent conversation,
// rebuilds a FRESH workspace snapshot every call (so answers always reflect the
// user's latest Momentum data, not a stale copy), and asks the LLM for a reply.
//
// Conversation memory lives on the client and is passed in as `messages`; here
// we validate it, trim it to a bounded window, and prepend the freshly-built
// system prompt. This keeps the assistant stateless server-side and makes it
// easy to later add persistence or richer tools without reworking the flow.

const AppError = require('../../utils/AppError');
const contextService = require('./context.service');
const groqService = require('./groq.service');
const { buildSystemPrompt } = require('./prompt');

const MAX_HISTORY_MESSAGES = 12; // recent turns kept for continuity (excludes system prompt)
const MAX_MESSAGE_CHARS = 8000;
const VALID_ROLES = new Set(['user', 'assistant']);

// Normalizes and bounds the client-supplied history. The last message must be
// from the user (the thing we're answering); everything else is prior context.
const sanitizeMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError('A non-empty "messages" array is required.', 400);
  }

  const cleaned = messages
    .filter((message) => message && VALID_ROLES.has(message.role) && typeof message.content === 'string')
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((message) => message.content.length > 0);

  if (cleaned.length === 0) {
    throw new AppError('No valid messages were provided.', 400);
  }

  const trimmed = cleaned.slice(-MAX_HISTORY_MESSAGES);

  if (trimmed[trimmed.length - 1].role !== 'user') {
    throw new AppError('The most recent message must be from the user.', 400);
  }

  return trimmed;
};

const generateReply = async (userId, messages) => {
  const history = sanitizeMessages(messages);

  // Rebuilt every turn — the whole point is "always use the latest data".
  const context = await contextService.buildUserContext(userId);
  const systemPrompt = buildSystemPrompt(context);

  const completion = await groqService.createChatCompletion([
    { role: 'system', content: systemPrompt },
    ...history,
  ]);

  return {
    reply: completion.content,
    model: completion.model,
  };
};

module.exports = {
  generateReply,
  isConfigured: groqService.isConfigured,
};
