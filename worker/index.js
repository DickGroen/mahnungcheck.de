var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/triage.js
import TRIAGE_PROMPT from "./abb86ccfdf7f5f9185ae0f2e7ce697c419834129-triage.txt";
import HAIKU_PROMPT from "./0d964c7399ac46462d6c7e86d0cdbe73b3891269-haiku.txt";
import SONNET_PROMPT from "./75a6f5cb02bea21f2638503b183c582110b7d384-sonnet.txt";

const GRATIS_PROMPT = `Du bist ein Analyse-System für Mahnungen und Inkassoschreiben in Deutschland.

Deine Aufgabe:
Lies das Dokument und erstelle eine kurze, kostenlose Ersteinschätzung für den Verbraucher.

Fokus: Wie viel Geld könnte der Verbraucher möglicherweise zurückfordern oder einsparen?

Gib deine Antwort IMMER exakt in dieser Struktur zurück:

[COMPANY]
Name des Absenders oder Inkassobüros
[/COMPANY]

[AMOUNT_CLAIMED]
Geforderter Gesamtbetrag als Zahl (nur Zahl, kein €-Zeichen)
[/AMOUNT_CLAIMED]

[AMOUNT_RECOVERABLE]
Geschätzter Betrag der möglicherweise nicht berechtigt ist (nur Zahl, kein €-Zeichen)
[/AMOUNT_RECOVERABLE]

[RISK]
low oder medium oder high
[/RISK]

[TEASER]
Schreibe genau 1 Satz: Nenne NUR dass möglicherweise ein Betrag zurückgehalten werden kann.
Nenne KEINE Gründe, KEINE Paragraphen, KEINE Details.
[/TEASER]`;

// worker/claude.js
async function callClaudeDocument(env, { model, maxTokens, prompt, fileBase64, mediaType }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: [
            mediaType === "application/pdf"
              ? { type: "document", source: { type: "base64", media_type: mediaType, data: fileBase64 } }
              : { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } },
            { type: "text", text: prompt }
          ]
        }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Claude API Fehler: ${JSON.stringify(data)}`);
  }
  return data?.content?.[0]?.text || "";
}
__name(callClaudeDocument, "callClaudeDocument");

// worker/utils.js
async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { base64: btoa(binary), mediaType: file.type || "application/pdf" };
}
__name(fileToBase64, "fileToBase64");

function safeJsonParse(str) {
  try {
    const match = String(str).match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}
__name(safeJsonParse, "safeJsonParse");

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
__name(jsonResponse, "jsonResponse");

function validateUploadInput({ file, name, email }) {
  if (!file) return "Keine Datei empfangen";
  if (!name || !String(name).trim()) return "Name fehlt";
  if (!email || !String(email).includes("@")) return "Ungültige E-Mail-Adresse";
  return null;
}
__name(validateUploadInput, "validateUploadInput");

function extractTaggedSection(text, tag) {
  const start = `[${tag}]`;
  const end = `[/${tag}]`;
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  if (startIndex === -1 || endIndex === -1) return "";
  return text.substring(startIndex + start.length, endIndex).trim();
}
__name(extractTaggedSection, "extractTaggedSection");

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
__name(escapeHtml, "escapeHtml");

function bulletsToHtml(text) {
  return String(text || "").split("\n").map(l => l.trim()).filter(Boolean)
    .map(l => l.replace(/^- /, "").trim())
    .map(l => `<li>${escapeHtml(l)}</li>`).join("");
}
__name(bulletsToHtml, "bulletsToHtml");

// RTF generator
function rtfEscape(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}")
    .replace(/\n/g, "\\par\n")
    .replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0)}?`);
}

function maakRtf(analysis, customerName, customerEmail, triage) {
  const title = extractTaggedSection(analysis, "TITLE") || "Mahnung-Analyse";
  const summary = extractTaggedSection(analysis, "SUMMARY");
  const issues = extractTaggedSection(analysis, "ISSUES");
  const assessment = extractTaggedSection(analysis, "ASSESSMENT");
  const nextSteps = extractTaggedSection(analysis, "NEXT_STEPS");
  const objection = extractTaggedSection(analysis, "OBJECTION");

  const issueLines = String(issues || "").split("\n").map(l => l.trim()).filter(Boolean)
    .map(l => `\\par\\pard\\fi-300\\li300 \\bullet  ${rtfEscape(l.replace(/^- /, ""))}`)
    .join("\n");

  const nextLines = String(nextSteps || "").split("\n").map(l => l.trim()).filter(Boolean)
    .map(l => `\\par\\pard\\fi-300\\li300 \\bullet  ${rtfEscape(l.replace(/^- /, ""))}`)
    .join("\n");

  return `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}{\\f1\\fswiss\\fcharset0 Arial;}}
{\\colortbl;\\red27\\green58\\blue140;\\red153\\green26\\blue26;}
\\paperw11906\\paperh16838\\margl1800\\margr1800\\margt1440\\margb1440
\\f1\\fs22
{\\pard\\sb400\\sa200\\f1\\fs32\\b\\cf1 ${rtfEscape(title)}\\par}
{\\pard\\sb200\\sa100\\f1\\fs20\\cf0 Kunde: ${rtfEscape(customerName || "")} (${rtfEscape(customerEmail || "")})\\par}
{\\pard\\sb0\\sa200\\f1\\fs20\\cf0 Unternehmen: ${rtfEscape(triage?.company || "unbekannt")} | Betrag: ${triage?.amount ? `\\u8364? ${triage.amount}` : "unbekannt"} | Risiko: ${rtfEscape(triage?.risk || "")}\\par}
{\\pard\\sb300\\sa100\\f1\\fs24\\b Zusammenfassung\\par}
{\\pard\\sa200\\f1\\fs22 ${rtfEscape(summary)}\\par}
{\\pard\\sb300\\sa100\\f1\\fs24\\b M\\u246?gliche Problempunkte\\par}
${issueLines}
{\\pard\\sa200\\par}
{\\pard\\sb300\\sa100\\f1\\fs24\\b Einsch\\u228?tzung\\par}
{\\pard\\sa200\\f1\\fs22 ${rtfEscape(assessment)}\\par}
{\\pard\\sb300\\sa100\\f1\\fs24\\b N\\u228?chste Schritte\\par}
${nextLines}
{\\pard\\sa200\\par}
{\\pard\\sb300\\sa100\\f1\\fs24\\b\\cf2 Widerspruchsbrief\\par}
{\\pard\\sa200\\f1\\fs22\\cf0 ${rtfEscape(objection)}\\par}
{\\pard\\sb400\\sa100\\f1\\fs18\\cf0\\i Hinweis: Dies ist eine informative Analyse und keine Rechtsberatung.\\par}
}`;
}

function rtfToBase64(rtfString) {
  const bytes = new TextEncoder().encode(rtfString);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// worker/triage.js
async function handleTriage(env, fileBase64, mediaType) {
  const raw = await callClaudeDocument(env, {
    model: "claude-haiku-4-5-20251001", maxTokens: 800,
    prompt: TRIAGE_PROMPT, fileBase64, mediaType
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { company: null, amount: null, days_left: null, risk: "medium", route: "HAIKU" };
  return {
    company: parsed.company || null,
    amount: typeof parsed.amount === "number" ? parsed.amount : null,
    days_left: typeof parsed.days_left === "number" ? parsed.days_left : null,
    risk: parsed.risk || "medium",
    route: parsed.route || "HAIKU"
  };
}
__name(handleTriage, "handleTriage");

// gratis analyse
async function handleGratisAnalyse(env, fileBase64, mediaType) {
  const raw = await callClaudeDocument(env, {
    model: "claude-haiku-4-5-20251001", maxTokens: 600,
    prompt: GRATIS_PROMPT, fileBase64, mediaType
  });
  return {
    company: extractTaggedSection(raw, "COMPANY") || null,
    amount_claimed: parseFloat(extractTaggedSection(raw, "AMOUNT_CLAIMED")) || null,
    amount_recoverable: parseFloat(extractTaggedSection(raw, "AMOUNT_RECOVERABLE")) || null,
    risk: extractTaggedSection(raw, "RISK") || "medium",
    teaser: extractTaggedSection(raw, "TEASER") || null
  };
}
__name(handleGratisAnalyse, "handleGratisAnalyse");

async function generateAnalysis(env, { fileBase64, mediaType, route }) {
  const useSonnet = route === "SONNET";
  const prompt = useSonnet ? SONNET_PROMPT : HAIKU_PROMPT;
  const model = useSonnet ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
  const raw = await callClaudeDocument(env, {
    model, maxTokens: useSonnet ? 3500 : 1800, prompt, fileBase64, mediaType
  });
  return raw || "";
}
__name(generateAnalysis, "generateAnalysis");

// worker/mailer.js
function formatEuro(amount) {
  if (!amount || isNaN(amount)) return null;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

async function sendAdminEmail(env, { customerName, customerEmail, triage, analysis }) {
  const rtfContent = maakRtf(analysis, customerName, customerEmail, triage);
  const rtfBase64 = rtfToBase64(rtfContent);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Mahnung Check DE <noreply@mahnungcheck.de>",
      to: ["dickgroen2@gmail.com"],
      reply_to: ["dickgroen2@gmail.com"],
      subject: `Neue Analyse: ${customerName || "Unbekannt"} (${customerEmail || "keine Mail"})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;">
          <h2>Neue Mahnung-Analyse</h2>
          <p><strong>Name:</strong> ${escapeHtml(customerName || "")}</p>
          <p><strong>E-Mail:</strong> ${escapeHtml(customerEmail || "")}</p>
          <p><strong>Unternehmen:</strong> ${escapeHtml(triage?.company || "unbekannt")}</p>
          <p><strong>Betrag:</strong> ${triage?.amount ? `€ ${triage.amount}` : "unbekannt"}</p>
          <p><strong>Risiko:</strong> ${escapeHtml(triage?.risk || "")}</p>
          <p style="color:#6b7280;font-size:0.9rem;">Vollständige Analyse als RTF-Datei angehängt.</p>
        </div>
      `,
      attachments: [{ filename: "Mahnung-Analyse.rtf", content: rtfBase64 }]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Admin-Mail fehlgeschlagen: ${err}`);
  }
}
__name(sendAdminEmail, "sendAdminEmail");

// worker/index.js
var index_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/analyze") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file) return jsonResponse({ ok: false, error: "Keine Datei empfangen" }, 400);
        const { base64, mediaType } = await fileToBase64(file);
        const triage = await handleTriage(env, base64, mediaType);
        return jsonResponse({ ok: true, ...triage });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/analyze-free") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        const name = formData.get("name");
        const email = formData.get("email");
        const stripeLink = env.STRIPE_LINK || "https://mahnungcheck.de";

        const validationError = validateUploadInput({ file, name, email });
        if (validationError) return jsonResponse({ ok: false, error: validationError }, 400);

        const { base64, mediaType } = await fileToBase64(file);
        const gratis = await handleGratisAnalyse(env, base64, mediaType);

        const makePayload = {
          name,
          email,
          company: gratis.company || "",
          amount_claimed: String(gratis.amount_claimed || ""),
          amount_recoverable: String(gratis.amount_recoverable || ""),
          risk: gratis.risk || "medium",
          teaser: gratis.teaser || "",
          stripe_link: stripeLink,
          created_at: new Date().toISOString()
        };

        const makeRes = await fetch("https://hook.eu1.make.com/x2sqrgvcb6om9d5f14c53wpp6ug2wpy9", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makePayload)
        });

        if (!makeRes.ok) {
          const err = await makeRes.text();
          throw new Error(`Make webhook fehlgeschlagen: ${err}`);
        }

        return jsonResponse({
          ok: true,
          message: "Deine kostenlose Ersteinschätzung wird per E-Mail versendet."
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/submit") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        const name = formData.get("name");
        const email = formData.get("email");

        const validationError = validateUploadInput({ file, name, email });
        if (validationError) return jsonResponse({ ok: false, error: validationError }, 400);

        const { base64, mediaType } = await fileToBase64(file);
        const triage = await handleTriage(env, base64, mediaType);
        const analysis = await generateAnalysis(env, {
          fileBase64: base64, mediaType, route: triage.route
        });

        await sendAdminEmail(env, {
          customerName: name, customerEmail: email, triage, analysis
        });

        return jsonResponse({
          ok: true,
          message: "Upload erfolgreich. Die Analyse wird per E-Mail gesendet."
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    return new Response("Not found", { status: 404 });
  }
};
export { index_default as default };
