import TRIAGE_PROMPT from '../prompts/triage.js';
import { callClaudeDocument } from './claude.js';
import { safeJsonParse } from './utils.js';

export async function handleTriage(env, fileBase64, mediaType) {
  const raw = await callClaudeDocument(env, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 800,
    prompt: TRIAGE_PROMPT,
    fileBase64,
    mediaType
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) {
    return {
      company: null,
      amount: null,
      days_left: null,
      risk: 'medium',
      route: 'SONNET'
    };
  }
  return {
    company: parsed.company || null,
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    days_left: typeof parsed.days_left === 'number' ? parsed.days_left : null,
    risk: parsed.risk || 'medium',
    route: parsed.route || 'SONNET'
  };
}
