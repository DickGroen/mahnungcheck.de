export async function sendCustomerEmail(env, { email, name, analysis }) {
  const subject = 'Deine Mahnung-Analyse ist fertig – Mahnung Check DE';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#1b3a8c;color:#ffffff;padding:24px 28px;">
        <h1 style="margin:0;font-size:22px;">Deine Analyse ist fertig</h1>
        <p style="margin:8px 0 0;color:#dbe7ff;font-size:14px;">Mahnung Check DE</p>
      </div>

      <div style="padding:28px;">
        <p style="margin:0 0 16px;font-size:16px;color:#111827;">
          Hallo <strong>${escapeHtml(name || '')}</strong>,
        </p>

        <p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.7;">
          wir haben dein Schreiben geprüft. Unten findest du deine Analyse.
        </p>

        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:18px 18px 8px;margin-bottom:20px;white-space:pre-wrap;font-size:14px;line-height:1.7;color:#111827;">
${escapeHtml(analysis)}
        </div>

        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
          <strong style="display:block;color:#9a3412;margin-bottom:6px;">Wichtiger Hinweis</strong>
          <span style="font-size:14px;color:#9a3412;line-height:1.6;">
            Dies ist eine informative Analyse und keine Rechtsberatung. Ein Widerspruch stoppt die Zahlung nicht automatisch.
          </span>
        </div>

        <p style="margin:0;font-size:14px;color:#6b7280;">
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
      subject,
      html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mailversand fehlgeschlagen: ${err}`);
  }
}

export async function sendAdminEmail(env, { customerName, customerEmail, triage, analysis }) {
  const subject = `Neue Analyse: ${customerName || 'Unbekannt'} (${customerEmail || 'keine Mail'})`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;">
      <h2>Neue Mahnung-Analyse</h2>

      <p><strong>Name:</strong> ${escapeHtml(customerName || '')}</p>
      <p><strong>E-Mail:</strong> ${escapeHtml(customerEmail || '')}</p>

      <h3>Triage</h3>
      <pre style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;white-space:pre-wrap;">${escapeHtml(JSON.stringify(triage, null, 2))}</pre>

      <h3>Analyse</h3>
      <pre style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px;white-space:pre-wrap;">${escapeHtml(analysis || '')}</pre>
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
      to: ['info@mahnung-check.de'],
      subject,
      html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Admin-Mail fehlgeschlagen: ${err}`);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
