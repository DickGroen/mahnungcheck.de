export async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return {
    base64: btoa(binary),
    mediaType: file.type || 'application/pdf'
  };
}

export function safeJsonParse(str) {
  try {
    const cleaned = String(str).replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export function validateUploadInput({ file, name, email }) {
  if (!file) {
    return 'Keine Datei empfangen';
  }

  if (!name || !String(name).trim()) {
    return 'Name fehlt';
  }

  if (!email || !String(email).includes('@')) {
    return 'Ungültige E-Mail-Adresse';
  }

  return null;
}


// 👇 NIEUW TOEVOEGEN

export function extractTaggedSection(text, tag) {
  const start = `[${tag}]`;
  const end = `[/${tag}]`;

  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);

  if (startIndex === -1 || endIndex === -1) return '';

  return text.substring(startIndex + start.length, endIndex).trim();
}

export function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function bulletsToHtml(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^- /, '').trim())
    .map(line => `<li>${escapeHtml(line)}</li>`)
    .join('');
}
