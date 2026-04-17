function handleUpload() {
  const teaser = document.getElementById("teaser");

  teaser.classList.remove("hidden");
  teaser.innerHTML = `
    <p>Mahnung erkannt – Betrag ca. 247€</p>
    <p>Du hast noch wenige Tage Zeit.</p>
    <a href="https://buy.stripe.com/yourlink">Analyse freischalten (€49)</a>
  `;
}

async function sendFile() {
  const file = document.getElementById("fileInput").files[0];

  const formData = new FormData();
  formData.append("file", file);

  await fetch("/analyze", {
    method: "POST",
    body: formData
  });

  alert("Analyse wird per E-Mail gesendet");
}

