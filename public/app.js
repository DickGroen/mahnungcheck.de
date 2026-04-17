async function analyzeFile() {
  const file = document.getElementById("fileInput").files[0];

  if (!file) {
    alert("Bitte Datei auswählen");
    return;
  }

  const teaser = document.getElementById("teaser");
  teaser.classList.remove("hidden");
  teaser.innerHTML = "Analyse läuft...";

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/analyze", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  teaser.innerHTML = `
    <strong>Mahnung von ${data.company || "Unbekannt"} gefunden</strong><br><br>
    Betrag: €${data.amount || "?"}<br><br>
    ⏳ Noch ${data.days_left || "wenige"} Tage Zeit<br><br>

    ${data.risk === "high" ? "⚠️ Möglicherweise problematisch" : ""}
    
    <br><br>
    <a href="https://buy.stripe.com/yourlink" class="button">
      Analyse freischalten (€49)
    </a>
  `;
}
