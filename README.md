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

## Bestellungen speichern

Die Route `api/order.js` speichert Bestellungen über Google Apps Script im Tabellenblatt `Bestellungen`. Dafür muss das Projekt bei Vercel (kostenloser Hobby-Tarif) veröffentlicht werden. Hinterlege dort diese Umgebungsvariablen:

- `GOOGLE_SCRIPT_URL`: Web-App-URL des Google-Apps-Script-Projekts
- `GOOGLE_SCRIPT_SECRET`: derselbe geheime Wert wie die Apps-Script-Eigenschaft `ORDER_SECRET`

GitHub Pages kann die statische Seite anzeigen, aber keine `/api/order`-Route ausführen. Für ein funktionierendes Bestellformular muss die Website daher über Vercel laufen.
