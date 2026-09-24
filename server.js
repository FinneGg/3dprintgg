const SPREADSHEET_ID = '1yXtoNxNDYDj2UH7IOz93McZK6TWXSvlllor8XRL76LI';

/**
 * Speichert Bestellungen von 3dPrint GG in einem privaten Google-Tabellenblatt.
 * Vor der Bereitstellung muss in den Skripteigenschaften ORDER_SECRET gesetzt sein.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('ORDER_SECRET');
    const body = JSON.parse(e && e.postData ? e.postData.contents : '{}');

    if (!expectedSecret) {
      return jsonResponse({ ok: false, error: 'Die Verbindung ist noch nicht eingerichtet.' });
    }
    if (!body.secret || body.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'Nicht autorisiert.' });
    }

    const name = safeText(body.name, 100);
    const message = safeText(body.message, 2000);
    const otherRequest = safeText(body.otherRequest, 1200);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!name || !message || items.length > 30 || (!items.length && !otherRequest)) {
      return jsonResponse({ ok: false, error: 'Die Bestelldaten sind unvollständig.' });
    }

    const itemSummary = items.map(function (item) {
      const itemName = safeText(item.name, 120);
      const quantity = Number(item.quantity);
      const lineTotal = Number(item.lineTotalCents);

      if (
        !itemName ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 50 ||
        !Number.isInteger(lineTotal) ||
        lineTotal < 0
      ) {
        throw new Error('Ungültige Artikeldaten.');
      }

      return itemName + ' × ' + quantity + ' — ' + formatEuro(lineTotal);
    }).join('\n');

    if (!lock.tryLock(10000)) {
      return jsonResponse({ ok: false, error: 'Die Tabelle ist gerade beschäftigt.' });
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = 'Bestellungen';
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Eingegangen',
        'Auftragsnummer',
        'Name',
        'Artikel',
        'Zwischensumme (€)',
        'Beschreibung',
        'Wunsch aus Sonstiges'
      ]);
      sheet.setFrozenRows(1);
    }

    const totalCents = Number(body.totalCents);
    if (!Number.isInteger(totalCents) || totalCents < 0) {
      return jsonResponse({ ok: false, error: 'Der Gesamtpreis ist ungültig.' });
    }

    const rowNumber = sheet.getLastRow() + 1;
    sheet.appendRow([
      new Date(),
      Utilities.getUuid(),
      name,
      safeText(itemSummary, 5000),
      totalCents / 100,
      message,
      otherRequest
    ]);

    sheet.getRange(rowNumber, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(rowNumber, 5).setNumberFormat('#,##0.00 "€"');

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Order storage failed: ' + error.message);
    return jsonResponse({
      ok: false,
      error: 'Die Bestellung konnte nicht in der Tabelle gespeichert werden.'
    });
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function doGet(e) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('ORDER_SECRET');
    const code = safeText(e && e.parameter ? e.parameter.code : '', 100);
    const secret = safeText(e && e.parameter ? e.parameter.secret : '', 200);
    if (!expectedSecret || secret !== expectedSecret || !code) {
      return jsonResponse({ ok: false, error: 'Nicht autorisiert.' });
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Bestellungen');
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ ok: true, orders: [] });
    const rows = sheet.getDataRange().getValues();
    const orders = rows.slice(1).filter(row => String(row[7] || '') === code).map(row => ({
      name: String(row[2] || ''),
      items: String(row[3] || '').split('\n').map(item => ({ name: item, quantity: 1 })),
      message: String(row[5] || ''),
      submittedAt: new Date(row[0]).toISOString()
    }));
    return jsonResponse({ ok: true, orders });
  } catch (error) {
    return jsonResponse({ ok: false, error: 'Die Bestellliste konnte nicht geladen werden.' });
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeText(value, maxLength) {
  const text = String(value || '').replace(/\r/g, '').trim().slice(0, maxLength);

  // Verhindert, dass Texteingaben als Tabellenformel ausgeführt werden.
  return /^[=+@-]/.test(text) ? "'" + text : text;
}

function formatEuro(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}/**
 * 3dPrint GG: nimmt Bestellungen von der Vercel-Funktion entgegen
 * und speichert jede Bestellung als eine Zeile in Google Tabellen.
 *
 * Vor der Bereitstellung in Apps Script unter Projekteinstellungen > Skripteigenschaften anlegen:
 *   ORDER_SECRET = derselbe geheime Wert wie GOOGLE_SCRIPT_SECRET in Vercel
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('ORDER_SECRET');
    const spreadsheetId = SPREADSHEET_ID;
    const body = JSON.parse(e && e.postData ? e.postData.contents : '{}');

    if (!expectedSecret || !spreadsheetId) {
      return jsonResponse({ ok: false, error: 'Die Tabellen-Verbindung ist noch nicht eingerichtet.' });
    }
    if (!body.secret || body.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'Nicht autorisiert.' });
    }

    const name = safeText(body.name, 100);
    const message = safeText(body.message, 2000);
    const listCode = safeText(body.listCode, 100);
    const otherRequest = safeText(body.otherRequest, 1200);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!name || !message || !listCode || items.length > 30 || (!items.length && !otherRequest)) {
      return jsonResponse({ ok: false, error: 'Die Bestelldaten sind unvollständig.' });
    }

    const itemSummary = items.map(function (item) {
      const itemName = safeText(item.name, 120);
      const quantity = Number(item.quantity);
      const lineTotal = Number(item.lineTotalCents);
      if (!itemName || !Number.isInteger(quantity) || quantity < 1 || quantity > 50 || !Number.isInteger(lineTotal) || lineTotal < 0) {
        throw new Error('Ungültige Artikeldaten.');
      }
      return itemName + ' × ' + quantity + ' — ' + formatEuro(lineTotal);
    }).join('\n');

    if (!lock.tryLock(10000)) {
      return jsonResponse({ ok: false, error: 'Die Tabelle ist gerade beschäftigt.' });
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheetName = 'Bestellungen';
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Eingegangen', 'Auftragsnummer', 'Name', 'Artikel', 'Zwischensumme (€)', 'Beschreibung', 'Wunsch aus Sonstiges', 'Listen-Code']);
      sheet.setFrozenRows(1);
    }

    const totalCents = Number(body.totalCents);
    if (!Number.isInteger(totalCents) || totalCents < 0) {
      return jsonResponse({ ok: false, error: 'Der Gesamtpreis ist ungültig.' });
    }

    const rowNumber = sheet.getLastRow() + 1;
    sheet.appendRow([
      new Date(),
      Utilities.getUuid(),
      name,
      safeText(itemSummary, 5000),
      totalCents / 100,
      message,
      otherRequest,
      listCode
    ]);
    sheet.getRange(rowNumber, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(rowNumber, 5).setNumberFormat('#,##0.00 "€"');
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Order storage failed: ' + error.message);
    return jsonResponse({ ok: false, error: 'Die Bestellung konnte nicht in der Tabelle gespeichert werden.' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeText(value, maxLength) {
  const text = String(value || '').replace(/\r/g, '').trim().slice(0, maxLength);
  // Prevent user text from being interpreted as a spreadsheet formula.
  return /^[=+@-]/.test(text) ? "'" + text : text;
}

function formatEuro(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}
