const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const teaser = document.getElementById('teaser');
const teaserCompany = document.getElementById('teaser-company');
const teaserFound = document.getElementById('teaser-found');
const teaserSub = document.getElementById('teaser-sub');
const teaserLockedText = document.getElementById('teaser-locked-text');
const modal = document.getElementById('modal');
const stickyFooter = document.getElementById('sticky-footer');

let latestTriage = null;

// Drag & drop
if (uploadZone) {
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  });
}

function handleFile(input) {
  if (input.files && input.files[0]) {
    processFile(input.files[0]);
  }
}

async function processFile(file) {
  // visuele feedback direct
  uploadZone.innerHTML = `
    <div class="upload-icon" style="border-color:var(--green);">
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--green)" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <div class="upload-label" style="color:var(--green);">${escapeHtml(file.name)}</div>
    <div class="upload-hint">Datei erkannt — erste Einschätzung wird geladen...</div>
  `;

  teaser.classList.add('visible');
  teaserCompany.textContent = 'Analyse läuft...';
  teaserFound.textContent = 'Wir prüfen Absender, Betrag und mögliche Risiken.';
  teaserSub.textContent = 'Bitte kurz warten...';
  teaserLockedText.innerHTML = `<strong>Erste Einschätzung wird erstellt</strong>`;

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/analyze', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    latestTriage = data;

    const company = data.company || 'Unbekannter Absender';
    const amount = typeof data.amount === 'number' ? formatEuro(data.amount) : 'unbekannt';
    const daysLeft = typeof data.days_left === 'number' ? data.days_left : 'wenige';
    const riskText = getRiskText(data.risk);

    teaserCompany.textContent = company;
    teaserFound.textContent = `Mahnung von ${company} erkannt — Betrag: ${amount}`;
    teaserSub.textContent = `⏳ Noch ${daysLeft} Tage Zeit. Erste Einschätzung: ${riskText}`;
    teaserLockedText.innerHTML = `
      <strong>Vollständige Analyse nach Zahlung</strong>
      Du erhältst eine detaillierte Einschätzung, mögliche Widerspruchsgründe und einen fertigen Widerspruch innerhalb von 24 Stunden per E-Mail.
    `;

    setTimeout(() => {
      teaser.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    setTimeout(() => {
      openModal();
    }, 700);
  } catch (err) {
    teaserCompany.textContent = 'Datei erkannt';
    teaserFound.textContent = 'Wir konnten keine Live-Einschätzung laden.';
    teaserSub.textContent = 'Du kannst trotzdem mit der vollständigen Analyse fortfahren.';
    teaserLockedText.innerHTML = `
      <strong>Analyse nach Zahlung verfügbar</strong>
      Nach der Zahlung prüft unser System dein Schreiben vollständig.
    `;
  }
}

function getRiskText(risk) {
  if (risk === 'high') return 'erhöhtes Risiko für überhöhte oder unklare Forderung';
  if (risk === 'medium') return 'einige Punkte sollten genauer geprüft werden';
  return 'eine Prüfung kann sich trotzdem lohnen';
}

function formatEuro(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Sticky footer
window.addEventListener('scroll', () => {
  if (!stickyFooter) return;
  if (window.scrollY > 500) {
    stickyFooter.classList.add('visible');
  } else {
    stickyFooter.classList.remove('visible');
  }
});

// Modal
function openModal() {
  if (!modal) return;
  modal.classList.add('visible');
  document.body.style.overflow = 'hidden';

  // optioneel modal copy dynamischer maken op basis van teaser
  const modalDynamic = document.getElementById('modal-dynamic-copy');
  if (modalDynamic && latestTriage) {
    const company = latestTriage.company || 'dem angegebenen Unternehmen';
    const amount = typeof latestTriage.amount === 'number' ? formatEuro(latestTriage.amount) : '';
    modalDynamic.textContent = amount
      ? `Wir haben ein Schreiben von ${company} mit einem Betrag von ${amount} erkannt.`
      : `Wir haben ein Schreiben von ${company} erkannt.`;
  }
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove('visible');
  document.body.style.overflow = '';
}

function closeModalOutside(e) {
  if (e.target === modal) {
    closeModal();
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// FAQ
function toggleFaq(el) {
  const item = el.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// expose voor inline handlers
window.handleFile = handleFile;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeModalOutside = closeModalOutside;
window.toggleFaq = toggleFaq;
