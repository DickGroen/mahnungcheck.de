var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/triage.js
import TRIAGE_PROMPT from "./abb86ccfdf7f5f9185ae0f2e7ce697c419834129-triage.txt";
import GRATIS_PROMPT from "./gratis.txt";

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
  if (!email || !String(email).includes("@")) return "Ung\xFCltige E-Mail-Adresse";
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

// worker/generator.js
import HAIKU_PROMPT from "./0d964c7399ac46462d6c7e86d0cdbe73b3891269-haiku.txt";
import SONNET_PROMPT from "./75a6f5cb02bea21f2638503b183c582110b7d384-sonnet.txt";

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

async function sendGratisEmail(env, { name, email, gratis, stripeLink }) {
  const company = gratis.company || "dem Absender";
  const claimed = formatEuro(gratis.amount_claimed);
  const recoverable = formatEuro(gratis.amount_recoverable);
  const riskLabel = gratis.risk === "high" ? "Hoch" : gratis.risk === "medium" ? "Mittel" : "Niedrig";
  const riskColor = gratis.risk === "high" ? "#991b1b" : gratis.risk === "medium" ? "#b45309" : "#1a7a4a";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <div style="background:#1b3a8c;color:#ffffff;padding:26px 30px;">
        <h1 style="margin:0;font-size:20px;">Deine kostenlose Ersteinsch\u00e4tzung</h1>
        <p style="margin:8px 0 0;color:#dbe7ff;font-size:14px;">Mahnung Check DE</p>
      </div>
      <div style="padding:28px 30px;">
        <p style="font-size:16px;color:#111827;">Hallo <strong>${escapeHtml(name || "")}</strong>,</p>
        <p style="font-size:15px;color:#374151;line-height:1.7;">Wir haben dein Schreiben von <strong>${escapeHtml(company)}</strong> analysiert. Hier ist deine kostenlose Ersteinsch\u00e4tzung:</p>

        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;font-size:15px;color:#111827;">
            <tr>
              <td style="padding:8px 0;color:#6b7280;">Geforderter Betrag:</td>
              <td style="padding:8px 0;font-weight:700;text-align:right;">${claimed || "unbekannt"}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb;">
              <td style="padding:8px 0;color:#6b7280;">M\u00f6glicherweise nicht berechtigt:</td>
              <td style="padding:8px 0;font-weight:700;color:#1a7a4a;text-align:right;">${recoverable ? `bis zu ${recoverable}` : "wird gepr\u00fcft"}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb;">
              <td style="padding:8px 0;color:#6b7280;">Risiko-Einsch\u00e4tzung:</td>
              <td style="padding:8px 0;font-weight:700;color:${riskColor};text-align:right;">${riskLabel}</td>
            </tr>
          </table>
        </div>

        ${gratis.teaser ? `<p style="font-size:14px;color:#374151;line-height:1.8;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;">${escapeHtml(gratis.teaser)}</p>` : ""}

        <div style="margin:24px 0;padding:20px;background:#f0f4ff;border-radius:12px;border:1px solid #c7d7ff;">
          <p style="margin:0 0 12px;font-weight:700;font-size:15px;color:#1b3a8c;">M\u00f6chtest du die vollst\u00e4ndige Analyse?</p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">F\u00fcr \u20ac49 erh\u00e4ltst du innerhalb von 24 Stunden:</p>
          <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#374151;line-height:1.8;">
            <li>Vollst\u00e4ndige Analyse aller Widerspruchsgr\u00fcnde</li>
            <li>Einsch\u00e4tzung deiner Chancen</li>
            <li>Fertiger Widerspruchsbrief — direkt verwendbar</li>
            <li>Konkrete n\u00e4chste Schritte</li>
          </ul>
          <a href="${stripeLink}" style="display:block;background:#1b3a8c;color:#ffffff;text-align:center;padding:16px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">Vollst\u00e4ndige Analyse freischalten — \u20ac49 \u2192</a>
          <p style="text-align:center;margin:10px 0 0;font-size:12px;color:#9ca3af;">\ud83d\udd12 Sichere Zahlung \u00fcber Stripe</p>
        </div>

        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;">
          <span style="font-size:13px;color:#991b1b;">Dies ist eine informative Ersteinsch\u00e4tzung, keine Rechtsberatung. Kein Anspruch auf Vollst\u00e4ndigkeit oder Richtigkeit.</span>
        </div>
      </div>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Mahnung Check DE <noreply@mahnungcheck.de>",
      to: [email],
      subject: "Deine kostenlose Ersteinsch\u00e4tzung — Mahnung Check DE",
      html
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gratis-Mail fehlgeschlagen: ${err}`);
  }
}
__name(sendGratisEmail, "sendGratisEmail");

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
          <p><strong>Betrag:</strong> ${triage?.amount ? `\u20AC ${triage.amount}` : "unbekannt"}</p>
          <p><strong>Risiko:</strong> ${escapeHtml(triage?.risk || "")}</p>
          <p style="color:#6b7280;font-size:0.9rem;">Vollst\u00e4ndige Analyse als RTF-Datei angeh\u00e4ngt.</p>
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

    // Teaser triage voor landingspagina
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

    // Gratis analyse — stuurt mini-analyse mail naar klant
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

        await sendGratisEmail(env, { name, email, gratis, stripeLink });

        return jsonResponse({
          ok: true,
          message: "Deine kostenlose Ersteinsch\u00e4tzung wird per E-Mail versendet."
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    // Volledige analyse na betaling
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
