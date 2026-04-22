import TRIAGE_PROMPT from '../prompts/triage.js';
import HAIKU_PROMPT from '../prompts/haiku.js';
import SONNET_PROMPT from '../prompts/sonnet.js';

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

// ── Claude API ────────────────────────────────────────────────────────────────

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
  if (!res.ok) throw new Error(`Claude API Fehler: ${JSON.stringify(data)}`);
  return data?.content?.[0]?.text || "";
}

// ── Utils ─────────────────────────────────────────────────────────────────────

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), mediaType: file.type || "application/pdf" };
}

function safeJsonParse(str) {
  try {
    const match = String(str).match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

function validateUploadInput({ file, name, email }) {
  if (!file) return "Keine Datei empfangen";
  if (!name || !String(name).trim()) return "Name fehlt";
  if (!email || !String(email).includes("@")) return "Ungültige E-Mail-Adresse";
  return null;
}

function extractTaggedSection(text, tag) {
  const start = `[${tag}]`;
  const end = `[/${tag}]`;
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  if (startIndex === -1 || endIndex === -1) return "";
  return text.substring(startIndex + start.length, endIndex).trim();
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// ── RTF ───────────────────────────────────────────────────────────────────────

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

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleTriage(env, fileBase64, mediaType) {
  const raw = await callClaudeDocument(env, {
    model: "claude-haiku-4-5-20251001", maxTokens: 800,
    prompt: TRIAGE_PROMPT, fileBase64, mediaType
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { company: null, amount: null, days_left: null, risk: "medium", route: "SONNET" };
  return {
    company: parsed.company || null,
    amount: typeof parsed.amount === "number" ? parsed.amount : null,
    days_left: typeof parsed.days_left === "number" ? parsed.days_left : null,
    risk: parsed.risk || "medium",
    route: parsed.route || "SONNET"
  };
}

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

async function generateAnalysis(env, { fileBase64, mediaType, route }) {
  const useSonnet = route === "SONNET";
  const prompt = useSonnet ? SONNET_PROMPT : HAIKU_PROMPT;
  const model = useSonnet ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
  const raw = await callClaudeDocument(env, {
    model, maxTokens: useSonnet ? 3500 : 1800, prompt, fileBase64, mediaType
  });
  return raw || "";
}

// ── Mail HTML helpers ─────────────────────────────────────────────────────────

function buildGratisMailHtml({ name, company, amount_claimed, amount_recoverable, risk, teaser, stripeLink }) {
  const riskLabel = { low: "Niedrig", medium: "Mittel", high: "Hoch" }[risk] || risk;
  const amountClaimed = amount_claimed ? `€ ${parseFloat(amount_claimed).toFixed(2)}` : "unbekannt";
  const amountRecoverable = amount_recoverable ? `€ ${parseFloat(amount_recoverable).toFixed(2)}` : null;

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <h2 style="color:#1d3a6e;">Deine kostenlose Ersteinschätzung</h2>
      <p>Hallo ${escapeHtml(name)},</p>
      <p>wir haben dein Schreiben von <strong>${escapeHtml(company || "unbekanntem Absender")}</strong> analysiert.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <tr style="background:#f3f4f6;">
          <td style="padding:10px 14px;font-weight:bold;">Geforderter Betrag</td>
          <td style="padding:10px 14px;">${amountClaimed}</td>
        </tr>
        ${amountRecoverable ? `
        <tr>
          <td style="padding:10px 14px;font-weight:bold;">Möglicherweise nicht berechtigt</td>
          <td style="padding:10px 14px;color:#b91c1c;font-weight:bold;">${amountRecoverable}</td>
        </tr>` : ""}
        <tr style="background:#f3f4f6;">
          <td style="padding:10px 14px;font-weight:bold;">Risiko-Einschätzung</td>
          <td style="padding:10px 14px;">${riskLabel}</td>
        </tr>
      </table>
      <p style="background:#fef9c3;border-left:4px solid #eab308;padding:12px 16px;border-radius:4px;">
        ${escapeHtml(teaser || "Teile der Forderung könnten möglicherweise nicht berechtigt sein.")}
      </p>
      <p>Für eine vollständige Analyse mit fertigem Widerspruchsbrief:</p>
      <a href="${stripeLink}" style="display:inline-block;background:#1d3a6e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:8px 0;">
        Vollständige Analyse für €49 →
      </a>
      <p style="color:#6b7280;font-size:0.85rem;margin-top:32px;">
        Hinweis: Dies ist eine informative Ersteinschätzung und keine Rechtsberatung.
        Bei komplexen Situationen empfehlen wir, einen Anwalt oder die Verbraucherzentrale zu kontaktieren.
      </p>
    </div>
  `;
}

function buildPaidCustomerMailHtml({ name, analysis, triage }) {
  const title = extractTaggedSection(analysis, "TITLE") || "Deine Mahnung-Analyse";
  const summary = extractTaggedSection(analysis, "SUMMARY");
  const issues = extractTaggedSection(analysis, "ISSUES");
  const assessment = extractTaggedSection(analysis, "ASSESSMENT");
  const nextSteps = extractTaggedSection(analysis, "NEXT_STEPS");
  const objection = extractTaggedSection(analysis, "OBJECTION");

  const issueLines = String(issues || "").split("\n").map(l => l.trim()).filter(Boolean)
    .map(l => `<li style="margin-bottom:6px;">${escapeHtml(l.replace(/^- /, ""))}</li>`)
    .join("");

  const nextLines = String(nextSteps || "").split("\n").map(l => l.trim()).filter(Boolean)
    .map(l => `<li style="margin-bottom:6px;">${escapeHtml(l.replace(/^- /, ""))}</li>`)
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;">
      <h2 style="color:#1d3a6e;">${escapeHtml(title)}</h2>
      <p>Hallo ${escapeHtml(name)},</p>
      <p>hier ist deine vollständige Analyse deines Schreibens von
        <strong>${escapeHtml(triage?.company || "unbekanntem Absender")}</strong>.
      </p>

      <h3 style="color:#1d3a6e;margin-top:24px;">Zusammenfassung</h3>
      <p style="line-height:1.7;">${escapeHtml(summary)}</p>

      <h3 style="color:#1d3a6e;margin-top:24px;">Mögliche Problempunkte</h3>
      <ul style="padding-left:20px;line-height:1.7;">${issueLines}</ul>

      <h3 style="color:#1d3a6e;margin-top:24px;">Einschätzung</h3>
      <p style="line-height:1.7;">${escapeHtml(assessment)}</p>

      <h3 style="color:#1d3a6e;margin-top:24px;">Nächste Schritte</h3>
      <ul style="padding-left:20px;line-height:1.7;">${nextLines}</ul>

      <h3 style="color:#b91c1c;margin-top:24px;">Widerspruchsbrief</h3>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px 24px;white-space:pre-wrap;font-size:0.9rem;line-height:1.8;">${escapeHtml(objection)}</div>

      <p style="color:#6b7280;font-size:0.82rem;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">
        Hinweis: Dies ist eine informative Analyse und keine Rechtsberatung.
        Ein Widerspruch setzt die Zahlung nicht automatisch aus.
        Bei komplexen Situationen oder hohen Beträgen empfehlen wir, einen Anwalt oder die Verbraucherzentrale zu konsultieren.
      </p>
    </div>
  `;
}

// ── Mailers ───────────────────────────────────────────────────────────────────

async function sendAdminGratisNotification(env, { name, email, gratis, stripeLink }) {
  const html = buildGratisMailHtml({
    name,
    company: gratis.company,
    amount_claimed: gratis.amount_claimed,
    amount_recoverable: gratis.amount_recoverable,
    risk: gratis.risk,
    teaser: gratis.teaser,
    stripeLink
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Mahnung Check DE <noreply@mahnungcheck.de>",
      to: ["dickgroen2@gmail.com"],
      reply_to: [email],
      subject: `Neue Gratis-Anfrage: ${name} (${email})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <p style="background:#f3f4f6;padding:10px 14px;border-radius:6px;font-size:0.85rem;color:#6b7280;">
            📬 Klantmail wordt morgen om 15:00 verstuurd naar <strong>${escapeHtml(email)}</strong>
          </p>
          ${html}
        </div>
      `
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Admin-notificatie mislukt: ${err}`);
  }
}

async function sendAdminPaidNotification(env, { customerName, customerEmail, triage, analysis }) {
  const rtfContent = maakRtf(analysis, customerName, customerEmail, triage);
  const rtfBase64 = rtfToBase64(rtfContent);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Mahnung Check DE <noreply@mahnungcheck.de>",
      to: ["dickgroen2@gmail.com"],
      reply_to: [customerEmail],
      subject: `Neue bezahlte Analyse: ${customerName || "Unbekannt"} (${customerEmail || "keine Mail"})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;">
          <p style="background:#f3f4f6;padding:10px 14px;border-radius:6px;font-size:0.85rem;color:#6b7280;">
            📬 Klantmail wordt morgen om 15:00 verstuurd naar <strong>${escapeHtml(customerEmail)}</strong>
          </p>
          <h2>Neue bezahlte Mahnung-Analyse</h2>
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

async function sendDelayedGratisEmail(env, entry) {
  const html = buildGratisMailHtml({
    name: entry.name,
    company: entry.company,
    amount_claimed: entry.amount_claimed,
    amount_recoverable: entry.amount_recoverable,
    risk: entry.risk,
    teaser: entry.teaser,
    stripeLink: entry.stripe_link || "https://mahnungcheck.de"
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Mahnung Check DE <noreply@mahnungcheck.de>",
      to: [entry.email],
      subject: "Deine kostenlose Ersteinschätzung – Mahnung Check DE",
      html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertraagde gratis mail mislukt voor ${entry.email}: ${err}`);
  }
}

async function sendDelayedPaidEmail(env, entry) {
  const html = buildPaidCustomerMailHtml({
    name: entry.name,
    analysis: entry.analysis,
    triage: entry.triage
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Mahnung Check DE <noreply@mahnungcheck.de>",
      to: [entry.email],
      subject: "Deine vollständige Mahnung-Analyse – Mahnung Check DE",
      html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertraagde betaalde mail mislukt voor ${entry.email}: ${err}`);
  }
}

// ── Cron handler ──────────────────────────────────────────────────────────────

async function handleCron(env) {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const list = await env.MAHNUNG_QUEUE.list();

  for (const key of list.keys) {
    try {
      const raw = await env.MAHNUNG_QUEUE.get(key.name);
      if (!raw) continue;
      const entry = JSON.parse(raw);
      const createdAt = new Date(entry.created_at).getTime();
      if (now - createdAt < oneDayMs) continue;

      if (entry.type === "paid") {
        await sendDelayedPaidEmail(env, entry);
      } else {
        await sendDelayedGratisEmail(env, entry);
      }

      await env.MAHNUNG_QUEUE.delete(key.name);
    } catch (err) {
      console.error(`Cron fout voor ${key.name}:`, err.message);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default {
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

        // Opslaan in KV — klantmail volgt volgende werkdag om 15:00
        const kvKey = `gratis:${Date.now()}:${email}`;
        await env.MAHNUNG_QUEUE.put(kvKey, JSON.stringify({
          type: "gratis",
          name, email,
          company: gratis.company || "",
          amount_claimed: String(gratis.amount_claimed || ""),
          amount_recoverable: String(gratis.amount_recoverable || ""),
          risk: gratis.risk || "medium",
          teaser: gratis.teaser || "",
          stripe_link: stripeLink,
          created_at: new Date().toISOString()
        }));

        // Admin notificatie direct
        try {
          await sendAdminGratisNotification(env, { name, email, gratis, stripeLink });
        } catch (_) {}

        return jsonResponse({
          ok: true,
          message: "Sie erhalten Ihre Einschätzung spätestens am nächsten Werktag vor 16:00 Uhr per E-Mail."
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

        // Opslaan in KV — klantmail volgt volgende werkdag om 15:00
        const kvKey = `paid:${Date.now()}:${email}`;
        await env.MAHNUNG_QUEUE.put(kvKey, JSON.stringify({
          type: "paid",
          name, email,
          analysis,
          triage,
          created_at: new Date().toISOString()
        }));

        // Admin krijgt analyse direct met RTF
        await sendAdminPaidNotification(env, {
          customerName: name, customerEmail: email, triage, analysis
        });

        return jsonResponse({
          ok: true,
          message: "Upload erfolgreich. Du erhältst deine vollständige Analyse spätestens am nächsten Werktag vor 16:00 Uhr per E-Mail."
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  }
};
