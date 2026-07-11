const assistantService = require('./assistant.service');

// GET /api/assistant/status — lets the UI know whether the assistant is
// configured (has an API key) without attempting a chat first.
const getStatus = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: { configured: assistantService.isConfigured() } });
  } catch (error) {
    next(error);
  }
};

// POST /api/assistant/chat
// Body: { messages: [{ role: 'user' | 'assistant', content: string }, ...] }
// The full recent conversation is sent each turn; the workspace snapshot is
// rebuilt server-side, so the client never has to send Momentum data itself.
const chat = async (req, res, next) => {
  try {
    const { reply, model } = await assistantService.generateReply(req.user.userId, req.body?.messages);
    res.status(200).json({ success: true, data: { reply, model } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStatus,
  chat,
};
