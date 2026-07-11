import { apiRequest } from './client'

// Whether the backend has an LLM key configured. Cheap check the page uses to
// decide between the chat UI and a "not configured yet" state.
export function getAssistantStatus() {
  return apiRequest('/assistant/status')
}

// Send the recent conversation and get the assistant's next reply. The server
// rebuilds the Momentum workspace snapshot itself, so we only send the messages.
// messages: [{ role: 'user' | 'assistant', content: string }, ...]
export function sendAssistantMessage(messages) {
  return apiRequest('/assistant/chat', { method: 'POST', body: { messages } })
}
