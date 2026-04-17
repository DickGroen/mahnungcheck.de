import HAIKU from "../prompts/haiku.txt";
import SONNET from "../prompts/sonnet.txt";
import { callClaude } from "./claude.js";

export async function generate(file, route) {
  const prompt = route === "SONNET" ? SONNET : HAIKU;

  const res = await callClaude(prompt, "claude-3-sonnet-20240229", ANTHROPIC_API_KEY);

  return res.content[0].text;
}
