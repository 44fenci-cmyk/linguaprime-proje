import { runGroqAi, setGroqKey, getMockAiResponse } from './ai-service.js';

window.runGroqAi = runGroqAi;
window.setGroqKey = setGroqKey;
window.getMockAiResponse = getMockAiResponse;
window.dispatchEvent(new Event('ai-service-ready'));
