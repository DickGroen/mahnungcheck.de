import TRIAGE from "../prompts/triage.txt";
import { callClaude } from "./claude.js";

export async function handleTriage(file) {
  const prompt = TRIAGE + "\n\nDokument analysieren.";

  const res = await callClaude(prompt, "claude-3-haiku-20240307", ANTHROPIC_API_KEY);

  return JSON.parse(res.content[0].text);
}
