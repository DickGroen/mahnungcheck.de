import { handleTriage } from './triage.js';
import { generateAnalysis } from './generator.js';
import { sendCustomerEmail, sendAdminEmail } from './mailer.js';
import { fileToBase64, jsonResponse, validateUploadInput } from './utils.js';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const url = new URL(request.url);

    // 1) teaser-triage vanaf landingspagina
    if (request.method === 'POST' && url.pathname === '/analyze') {
      try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
          return jsonResponse({ ok: false, error: 'Keine Datei empfangen' }, 400);
        }

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

    // 2) volledige upload vanaf bedankt.html
    if (request.method === 'POST' && url.pathname === '/submit') {
      try {
        const formData = await request.formData();
        const file = formData.get('file');
        const name = formData.get('name');
        const email = formData.get('email');

        const validationError = validateUploadInput({ file, name, email });
        if (validationError) {
          return jsonResponse({ ok: false, error: validationError }, 400);
        }

        const { base64, mediaType } = await fileToBase64(file);

        const triage = await handleTriage(env, base64, mediaType);
        const analysis = await generateAnalysis(env, {
          fileBase64: base64,
          mediaType,
          route: triage.route
        });

        await sendCustomerEmail(env, {
          email,
          name,
          analysis
        });

        await sendAdminEmail(env, {
          customerName: name,
          customerEmail: email,
          triage,
          analysis
        });

        return jsonResponse({
          ok: true,
          message: 'Upload erfolgreich. Die Analyse wird per E-Mail gesendet.'
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
