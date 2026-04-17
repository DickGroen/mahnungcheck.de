export function safeJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
