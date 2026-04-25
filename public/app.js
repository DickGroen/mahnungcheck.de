// ── Teaser flow ───────────────────────────────────────────────────────────────
// Called when user selects a file via the hidden #file-input
// Runs triage → shows teaser section with result

async function handleFile(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  if (file.size > 10 * 1024 * 1024) {
    showTeaserError('Bestand te groot. Maximaal 10 MB.');
    return;
  }

  const teaser = document.getElementById('teaser');
  const teaserCompany = document.getElementById('teaser-company');
  const teaserFound = document.getElementById('teaser-found');
  const teaserSub = document.getElementById('teaser-sub');
  const teaserLocked = document.getElementById('teaser-locked-text');
  const modalCopy = document.getElementById('modal-dynamic-copy');

  // Ladezustand
  teaser.style.display = 'block';
  teaser.classList.remove('teaser--visible');
  teaserCompany.textContent = 'Wird analysiert...';
  teaserFound.textContent = '⏳ Einen Moment...';
  teaserSub.textContent = 'Dein Schreiben wird geprüft.';

  setTimeout(() => teaser.classList.add('teaser--visible'), 10);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${WORKER_URL}/analyze`, { method: 'POST', body: formData });
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || 'Analyse fehlgeschlagen');

    const sender = data.sender || data.company || null;
    const risk = data.risk || 'medium';
    const claimAmount = data.claim_amount || null;

    // Punt 4: bedrag prominent in titel
    if (claimAmount) {
      teaserCompany.textContent = `Möglicherweise €${claimAmount} zu viel gefordert`;
    } else {
      teaserCompany.textContent = sender ? `Schreiben von ${sender} erkannt` : 'Anfechtbare Forderung erkannt';
    }

    teaserFound.textContent = 'Erste Feststellung:';

    const riskMessages = {
      high: '🔴 Starke Anzeichen für eine anfechtbare Forderung. Lass es jetzt vollständig prüfen.',
      medium: '🟠 Mögliche Anfechtungspunkte gefunden. Eine vollständige Prüfung gibt Sicherheit.',
      low: '🟡 Geringes Risiko — aber eine Prüfung kann Überraschungen aufdecken.'
    };
    teaserSub.textContent = riskMessages[risk] || 'Klicke unten für die vollständige Analyse.';

    if (teaserLocked) {
      const betragText = claimAmount ? `€${claimAmount}` : 'die Forderung';
      teaserLocked.innerHTML = `<strong>Vollständige Analyse nach Zahlung</strong>
        Wir prüfen ${betragText} auf alle Anfechtungsgründe und erstellen einen fertigen Widerspruch — innerhalb von 24 Stunden.`;
    }

    if (modalCopy) {
      if (claimAmount && sender) {
        modalCopy.textContent = `Wir haben eine möglicherweise überhöhte Forderung von €${claimAmount} durch ${sender} erkannt. Die vollständige Prüfung folgt nach der Zahlung.`;
      } else if (sender) {
        modalCopy.textContent = `Wir haben ein Schreiben von ${sender} erkannt. Die vollständige Prüfung folgt nach der Zahlung.`;
      } else {
        modalCopy.textContent = 'Wir haben Anzeichen für eine anfechtbare Forderung erkannt. Die vollständige Prüfung folgt nach der Zahlung.';
      }
    }

  } catch (err) {
    teaserCompany.textContent = 'Schreiben erkannt';
    teaserFound.textContent = 'Bereit zur Analyse:';
    teaserSub.textContent = 'Klicke unten, um deine vollständige Analyse und deinen Widerspruch anzufordern.';
    console.warn('Triage-Fehler:', err.message);
  }

  // Scroll to teaser
  teaser.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showTeaserError(msg) {
  const teaser = document.getElementById('teaser');
  if (teaser) {
    teaser.style.display = 'block';
    const sub = document.getElementById('teaser-sub');
    if (sub) sub.textContent = msg;
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.classList.remove('modal--open');
    document.body.style.overflow = '';
  }
}

function closeModalOutside(event) {
  if (event.target === document.getElementById('modal')) {
    closeModal();
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── FAQ accordion ─────────────────────────────────────────────────────────────

function toggleFaq(el) {
  const item = el.closest('.faq-item');
  const answer = item.querySelector('.faq-a');
  const chevron = item.querySelector('.faq-chevron');
  const isOpen = item.classList.contains('faq-item--open');

  // Close all others
  document.querySelectorAll('.faq-item--open').forEach(openItem => {
    openItem.classList.remove('faq-item--open');
    const a = openItem.querySelector('.faq-a');
    const c = openItem.querySelector('.faq-chevron');
    if (a) a.style.maxHeight = null;
    if (c) c.style.transform = '';
  });

  if (!isOpen) {
    item.classList.add('faq-item--open');
    if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}

// ── Sticky footer ─────────────────────────────────────────────────────────────

(function initStickyFooter() {
  const stickyFooter = document.getElementById('sticky-footer');
  if (!stickyFooter) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateSticky() {
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    const nearBottom = scrollY + windowHeight > docHeight - 200;

    if (scrollY > 400 && !nearBottom) {
      stickyFooter.classList.add('sticky-footer--visible');
    } else {
      stickyFooter.classList.remove('sticky-footer--visible');
    }

    lastScrollY = scrollY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateSticky);
      ticking = true;
    }
  }, { passive: true });
})();

