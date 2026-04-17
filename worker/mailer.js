import { extractTaggedSection, escapeHtml, bulletsToHtml } from './utils.js';

export async function sendCustomerEmail(env, { email, name, analysis }) {
  const title = extractTaggedSection(analysis, 'TITLE') || 'Analyse deiner Mahnung';
  const summary = extractTaggedSection(analysis, 'SUMMARY');
  const issues = extractTaggedSection(analysis, 'ISSUES');
  const assessment = extractTaggedSection(analysis, 'ASSESSMENT');
  const nextSteps = extractTaggedSection(analysis, 'NEXT_STEPS');
  const objection = extractTaggedSection(analysis, 'OBJECTION');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <div style="background:#1b3a8c;color:#ffffff;padding:26px 30px;">
        <h1 style="margin:0;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
        <p style="margin:8px 0 0;color:#dbe7ff;font-size:14px;">Mahnung Check DE</p>
      </div>

      <div style="padding:28px 30px;">
        <p style="margin:0 0 16px;font-size:16px;color:#111827;">
          Hallo <strong>${escapeHtml(name || '')}</strong>,
        </p>

        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
          deine Analyse ist fertig. Unten findest du die wichtigsten Punkte in übersichtlicher Form.
        </p>

        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:18px 18px 4px;margin-bottom:18px;">
          <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Kurze Zusammenfassung</h2>
          <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.8;">
            ${escapeHtml(summary)}
          </p>
        </div>

        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 18px 8px;margin-bottom:18px;">
          <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Mögliche Problempunkte</h2>
          <ul style="margin:0 0 8px 18px;padding:0;font-size:14px;color:#374151;line-height:1.8;">
            ${bulletsToHtml(issues)}
          </ul>
        </div>

        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 18px 8px;margin-bottom:18px;">
          <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Einschätzung</h2>
          <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.8;">
            ${escapeHtml(assessment)}
          </p>
        </div>

        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 18px 8px;margin-bottom:18px;">
          <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Nächste Schritte</h2>
          <ul style="margin:0 0 8px 18px;padding:0;font-size:14px;color:#374151;line-height:1.8;">
            ${bulletsToHtml(nextSteps)}
          </ul>
        </div>

        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:18px 18px 8px;margin-bottom:18px;">
          <h2 style="margin:0 0 10px;font-size:16px;color:#9a3412;">Vorschlag für Widerspruch</h2>
          <div style="white-space:pre-wrap;font-size:14px;color:#7c2d12;line-height:1.8;">${escapeHtml(objection)}</div>
        </div>

        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin-bottom:18px;">
          <strong style="display:block;color:#991b1b;margin-bottom:6px;">Wichtiger Hinweis</strong>
          <span style="font-size:14px;color:#991b1b;line-height:1.7;">
            Dies ist eine informative Analyse und keine Rechtsberatung. Ein Widerspruch stoppt die Zahlung nicht automatisch.
          </span>
        </div>

        <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
          Fragen? Antworte einfach auf diese E-Mail.
        </p>
      </div>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Mahnung Check DE <noreply@mahnung-check.de>',
      to: [email],
      subject: 'Deine Mahnung-Analyse ist fertig – Mahnung Check DE',
      html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mailversand fehlgeschlagen: ${err}`);
  }
}

export async function sendAdminEmail(env, { customerName, customerEmail, triage, analysis }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Mahnung Check DE <noreply@mahnung-check.de>',
      to: ['info@mahnung-check.de'],
      subject: `Neue Analyse: ${customerName || 'Unbekannt'} (${customerEmail || 'keine Mail'})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;">
          <h2>Neue Mahnung-Analyse</h2>
          <p><strong>Name:</strong> ${escapeHtml(customerName || '')}</p>
          <p><strong>E-Mail:</strong> ${escapeHtml(customerEmail || '')}</p>
          <h3>Triage</h3>
          <pre style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;white-space:pre-wrap;">${escapeHtml(JSON.stringify(triage, null, 2))}</pre>
          <h3>Analyse</h3>
          <pre style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;white-space:pre-wrap;">${escapeHtml(analysis || '')}</pre>
        </div>
      `
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Admin-Mail fehlgeschlagen: ${err}`);
  }
}
