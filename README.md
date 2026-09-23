# 3dPrint GG

Die Shop-Oberfläche liegt in `index.html`.

## Lokal starten

```bash
python3 -m http.server 8080
```

Danach im Browser `http://localhost:8080` öffnen.

## Online auf dem Handy

Nach dem Veröffentlichen über GitHub Pages ist die Seite unter
<https://finnegg.github.io/3dprintgg/> erreichbar.

Die Seite wird bei jedem Push auf `main` automatisch aktualisiert.

Der Bestellversand erwartet zusätzlich eine konfigurierte `/api/order`-Route. Ohne Backend funktionieren Katalog, Artikelansicht und Warenkorb lokal; das Absenden einer Bestellung benötigt die Vercel-/Google-Apps-Script-Anbindung.
