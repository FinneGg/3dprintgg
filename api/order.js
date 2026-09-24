const PRODUCTS = {
  schneeflocke: { name: 'Schneeflocke', price: 300 },
  baumkugel: { name: 'Weihnachtsbaum-Baumkugel', price: 200 },
  'suessigkeiten-kugel': { name: 'Weihnachtskugel für Süßigkeiten', price: 250 },
  hexenkessel: { name: 'Hexenkessel', price: 250 },
  nuesse: { name: 'Nüsse', price: 150 },
  klappkuerbis: { name: 'Klappbarer Kürbis', price: 500 },
  schiebekuerbisse: { name: 'Zusammenschiebbare Kürbisse', price: 350 },
  'five-keycap-clicker': { name: '5-Keycap-Fidget-Clicker', price: 300 },
  'shulker-clicker': { name: 'Minecraft-Shulker-Clicker', price: 150 },
  miniquallen: { name: 'Miniquallen', price: 350 },
  joystick: { name: 'Joystick', price: 100 },
  spirale: { name: 'Spirale', price: 350 },
  'drachen-ei': { name: 'Drachen-Ei', price: 350 },
  drache: { name: 'Drache', price: 500 },
  'ultimate-multi-fidget-toy': { name: 'Ultimate Multi Fidget Toy', price: 400 },
  chipsstaebchen: { name: 'Chipsstäbchen', price: 100 },
  'emergency-button': { name: 'Emergency Button', price: 150 },
  'realistisches-tuch': { name: 'Ultrarealistisches Tuch', price: 250 },
  'dumpling-squishies': { name: 'Dumpling-Squishies', price: 200 }
};

function text(value, maxLength) {
  return String(value || '').replace(/\r/g, '').trim().slice(0, maxLength);
}

export default async function handler(request, response) {
  if (request.method === 'GET') {
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    const secret = process.env.GOOGLE_SCRIPT_SECRET;
    const code = text(new URL(request.url, 'http://localhost').searchParams.get('code'), 100);
    if (!scriptUrl || !secret || !code) {
      return response.status(400).json({ error: 'Listen-Code fehlt.' });
    }

    try {
      const googleResponse = await fetch(`${scriptUrl}?code=${encodeURIComponent(code)}&secret=${encodeURIComponent(secret)}`);
      const result = await googleResponse.json().catch(() => ({}));
      if (!googleResponse.ok || !result.ok) {
        return response.status(502).json({ error: result.error || 'Die Liste konnte nicht geladen werden.' });
      }
      return response.status(200).json(result);
    } catch (error) {
      console.error('Order list loading failed:', error);
      return response.status(502).json({ error: 'Die Bestellliste ist momentan nicht erreichbar.' });
    }
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Methode nicht erlaubt.' });
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.GOOGLE_SCRIPT_SECRET;
  if (!scriptUrl || !secret) {
    return response.status(503).json({ error: 'Die Bestellverbindung ist noch nicht eingerichtet.' });
  }

  const body = request.body || {};
  if (text(body.website, 100)) {
    return response.status(400).json({ error: 'Ungültige Anfrage.' });
  }

  const name = text(body.name, 100);
  const message = text(body.message, 2000);
  const otherRequest = text(body.otherRequest, 1200);
  const listCode = text(body.listCode, 100);
  const requestedItems = Array.isArray(body.items) ? body.items : [];
  if (!name || !message || !listCode || requestedItems.length > 30 || (!requestedItems.length && !otherRequest)) {
    return response.status(400).json({ error: 'Name, Nachricht oder Artikel fehlen.' });
  }

  const items = [];
  for (const requestedItem of requestedItems) {
    const product = PRODUCTS[text(requestedItem.id, 80)];
    const quantity = Number(requestedItem.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return response.status(400).json({ error: 'Ungültige Artikeldaten.' });
    }
    items.push({
      name: product.name,
      quantity,
      lineTotalCents: product.price * quantity
    });
  }

  const totalCents = items.reduce((total, item) => total + item.lineTotalCents, 0);
  try {
    const googleResponse = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, name, message, listCode, otherRequest, items, totalCents })
    });
    const result = await googleResponse.json().catch(() => ({}));
    if (!googleResponse.ok || !result.ok) {
      return response.status(502).json({ error: result.error || 'Die Bestellung konnte nicht gespeichert werden.' });
    }
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Order forwarding failed:', error);
    return response.status(502).json({ error: 'Die Bestellverbindung ist momentan nicht erreichbar.' });
  }
}
