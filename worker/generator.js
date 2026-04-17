import HAIKU_PROMPT from '../prompts/haiku.txt';
import SONNET_PROMPT from '../prompts/sonnet.txt';
import { callClaudeDocument } from './claude.js';

export async function generateAnalysis(env, { fileBase64, mediaType, route }) {
  const useSonnet = route === 'SONNET';

  const prompt = useSonnet ? SONNET_PROMPT : HAIKU_PROMPT;
  const model = useSonnet ? 'claude-3-sonnet-20240229' : 'claude-3-haiku-20240307';

  const raw = await callClaudeDocument(env, {
    model,
    maxTokens: useSonnet ? 2200 : 1400,
    prompt,
    fileBase64,
    mediaType
  });

  return raw;
}
