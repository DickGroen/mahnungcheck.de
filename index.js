var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

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
      messages: [{
        role: "user",
        content: [
          mediaType === "application/pdf"
            ? { type: "document", source: { type: "base64", media_type: mediaType, data: fileBase64 } }
            : { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } },
          { type: "text", text: prompt }
        ]
      }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude API Fehler: ${JSON.stringify(data)}`);
  return data?.content?.[0]?.text || "";
}
__name(callClaudeDocument, "callClaudeDocument");

// worker/utils.js
async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
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
  const start = `[${tag}]`, end = `[/${tag}]`;
  const si = text.indexOf(start), ei = text.indexOf(end);
  if (si === -1 || ei === -1) return "";
  return text.substring(si + start.length, ei).trim();
}
__name(extractTaggedSection, "extractTaggedSection");

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
__name(escapeHtml, "escapeHtml");

function bulletsToHtml(text) {
  return String(text || "").split("\n").map(l => l.trim()).filter(Boolean)
    .map(l => l.replace(/^- /, "").trim())
    .map(l => `<li>${escapeHtml(l)}</li>`).join("");
}
__name(bulletsToHtml, "bulletsToHtml");

function formatEuro(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return null;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

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
{\\pard\\sb200\\sa100\\f1\\fs20 Kunde: ${rtfEscape(customerName || "")} (${rtfEscape(customerEmail || "")})\\par}
{\\pard\\sb0\\sa200\\f1\\fs20 Unternehmen: ${rtfEscape(triage?.company || "unbekannt")} | Betrag: ${triage?.amount ? `\\u8364? ${triage.amount}` : "unbekannt"} | Risiko: ${rtfEscape(triage?.risk || "")}\\par}
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
{\\pard\\sb400\\sa100\\f1\\fs18\\i Hinweis: Dies ist eine informative Analyse und keine Rechtsberatung.\\par}
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

// Gratis analyse
async function handleGratisAnalysis(env, fileBase64, mediaType) {
  const raw = await callClaudeDocument(env, {
    model: "claude-haiku-4-5-20251001", maxTokens: 1000,
    prompt: GRATIS_PROMPT, fileBase64, mediaType
  });
  return raw || "";
}
__name(handleGratisAnalysis, "handleGratisAnalysis");

// worker/generator.js
import HAIKU_PROMPT from "./0d964c7399ac46462d6c7e86d0cdbe73b3891269-haiku.txt";
import SONNET_PROMPT from "./75a6f5cb02bea21f2638503b183c582110b7d384-sonnet.txt";

async function generateAnalysis(env, { fileBase64, mediaType, route }) {
  const useSonnet = route === "SONNET";
  const raw = await callClaudeDocument(env, {
    model: useSonnet ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001",
    maxTokens: useSonnet ? 3500 : 1800,
    prompt: useSonnet ? SONNET_PROMPT : HAIKU_PROMPT,
    fileBase64, mediaType
  });
  return raw || "";
}
__name(generateAnalysis, "generateAnalysis");

// worker/mailer.js
async function sendGratisEmail(env, { name, email, gratisRaw, stripeLink }) {
  const company = extractTaggedSection(gratisRaw, "COMPANY") || "der Gegenseite";
  const amountClaimed = formatEuro(extractTaggedSection(gratisRaw, "AMOUNT_CLAIMED"));
  const amountRecoverable = formatEuro(extractTaggedSection(gratisRaw, "AMOUNT_RECOVERABLE"));
  const risk = extractTaggedSection(gratisRaw, "RISK") || "medium";
  const teaser = extractTaggedSection(gratisRaw, "TEASER");

  const riskLabel = risk === "high" ? "Hoch \u26A0\uFE0F" : risk === "medium" ? "Mittel \u26A0\uFE0F" : "Niedrig \u2705";
  const riskColor = risk === "high" ? "#b91c1c" : risk === "medium" ? "#b45309" : "#15803d";
  const riskBg = risk === "high" ? "#fef2f2" : risk === "medium" ? "#fffbeb" : "#f0fdf4";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:660px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <div style="background:#1b3a8c;color:#ffffff;padding:24px 28px;">
        <h1 style="margin:0;font-size:20px;line-height:1.3;">Deine kostenlose Ersteinsch\u00e4tzung</h1>
        <p style="margin:6px 0 0;color:#dbe7ff;font-size:13px;">Mahnung Check DE</p>
      </div>
      <div style="padding:24px 28px;">

        <p style="margin:0 0 18px;font-size:15px;color:#111827;">
          Hallo <strong>${escapeHtml(name || "")}</strong>,
        </p>

        <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">
          Wir haben dein Schreiben von <strong>${escapeHtml(company)}</strong> analysiert.
          ${amountClaimed ? `Die geforderte Summe betr\u00e4gt <strong>${amountClaimed}</strong>.` : ""}
        </p>

        ${amountRecoverable ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 20px;margin-bottom:18px;">
          <div style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">M\u00f6glicherweise nicht berechtigt</div>
          <div style="font-size:26px;font-weight:700;color:#15803d;">${amountRecoverable}</div>
          <div style="font-size:13px;color:#166534;margin-top:6px;">Dieser Betrag k\u00f6nnte m\u00f6glicherweise nicht berechtigt sein.</div>
        </div>` : ""}

        <div style="background:${riskBg};border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:700;color:#111827;">Erste Einsch\u00e4tzung</span>
            <span style="font-size:12px;font-weight:700;color:${riskColor};">Risiko: ${riskLabel}</span>
          </div>
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.7;">${escapeHtml(teaser)}</p>
        </div>

        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:22px;">
          <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:6px;">\uD83D\uDD12 Vollst\u00e4ndige Analyse noch gesperrt</div>
          <div style="font-size:13px;color:#78350f;line-height:1.7;">
            F\u00fcr den vollst\u00e4ndigen Bericht mit Widerspruchsgr\u00fcnden, St\u00e4rke-Indikator
            und einem fertigen Widerspruchsbrief freischalten.
          </div>
        </div>

        <a href="${escapeHtml(stripeLink)}" style="display:block;background:#1b3a8c;color:#ffffff;padding:16px;border-radius:8px;font-weight:700;font-size:15px;text-align:center;text-decoration:none;margin-bottom:10px;">
          Vollst\u00e4ndige Analyse + fertigen Widerspruch freischalten \u2014 \u20AC49 \u2192
        </a>
        <p style="text-align:center;font-size:12px;color:#9ca3af;margin:0 0 20px;">
          Einmalig \u00b7 kein Abo \u00b7 \uD83D\uDD12 Sichere Zahlung \u00fcber Stripe
        </p>

        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;">
          <span style="font-size:12px;color:#991b1b;">
            Dies ist eine informative Ersteinsch\u00e4tzung und keine Rechtsberatung.
          </span>
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
      subject: "Deine kostenlose Ersteinsch\u00e4tzung \u2013 Mahnung Check DE",
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
          <p style="margin-top:16px;color:#6b7280;font-size:0.9rem;">Vollst\u00e4ndige Analyse als RTF-Datei angeh\u00e4ngt.</p>
        </div>
      `,
      attachments: [{
        filename: "Mahnung-Analyse.rtf",
        content: rtfBase64
      }]
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

    // /analyze — triage teaser voor landingspagina
    if (request.method === "POST" && url.pathname === "/analyze") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file) return jsonResponse({ ok: false, error: "Keine Datei empfangen" }, 400);
        const { base64, mediaType } = await fileToBase64(file);
        const triage = await handleTriage(env, base64, mediaType);
        return jsonResponse({
          ok: true,
          company: triage.company,
          amount: triage.amount,
          days_left: triage.days_left,
          risk: triage.risk,
          route: triage.route
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    // /analyze-free — gratis analyse per mail
    if (request.method === "POST" && url.pathname === "/analyze-free") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        const name = formData.get("name");
        const email = formData.get("email");

        const validationError = validateUploadInput({ file, name, email });
        if (validationError) return jsonResponse({ ok: false, error: validationError }, 400);

        const { base64, mediaType } = await fileToBase64(file);
        const gratisRaw = await handleGratisAnalysis(env, base64, mediaType);
        const stripeLink = env.STRIPE_LINK || "https://mahnungcheck-de.pages.dev";

        await sendGratisEmail(env, { name, email, gratisRaw, stripeLink });

        return jsonResponse({
          ok: true,
          message: "Deine kostenlose Ersteinsch\u00e4tzung wurde per E-Mail gesendet."
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    // /submit — volledige betaalde analyse
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
