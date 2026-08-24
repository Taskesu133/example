// Parsira mejlove sa yettelbank@yettelbank.rs. Vraca null ako mejl nije
// prepoznatog tipa (npr. rata kredita, tarifnik, kes-bek najava - ovi se
// namerno preskacu jer nemaju pouzdan iznos ili bi dupli-racunali uplatu
// koja ce stici zasebnim mejlom).

function parseAmount(str) {
  return parseFloat(str.replace(/,/g, ''));
}

function toIsoDate(dd, mm, yyyy) {
  return `${yyyy}-${mm}-${dd}`;
}

function toIsoDateFromHeader(date) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}

export function parseYettelEmail({ subject, text, date }) {
  const body = String(text || '').replace(/\s+/g, ' ').trim();
  const subj = String(subject || '');

  if (/Transakcija je izvr[šs]ena/i.test(subj)) {
    const m = body.match(
      /Karticom\s+[\d*]+,?\s*je izvr[šs]ena transakcija u iznosu\s+([\d.,]+)\s*(RSD|EUR)\s*na dan\s+(\d{2})\.(\d{2})\.(\d{4}),\s*(.+?)\s*\.\s*Trenutno/i
    );
    if (!m) return null;
    const [, amountStr, currency, dd, mm, yyyy, merchant] = m;
    return {
      type: 'expense',
      amount: parseAmount(amountStr),
      spentOn: toIsoDate(dd, mm, yyyy),
      note: currency === 'EUR' ? `${merchant.trim()} [EUR]` : merchant.trim(),
    };
  }

  if (/Zadu[žz]enje po teku[ćc]em ra[čc]unu/i.test(subj)) {
    const m = body.match(/Tvoj teku[ćc]i ra[čc]un je zadu[žz]en za\s+([\d.,]+)\s*RSD/i);
    if (!m) return null;
    return {
      type: 'expense',
      amount: parseAmount(m[1]),
      spentOn: toIsoDateFromHeader(date),
      note: 'Zaduzenje po tekucem racunu',
    };
  }

  if (/Uplata na teku[ćc]i ra[čc]un/i.test(subj)) {
    const m = body.match(/Na tvoj teku[ćc]i ra[čc]un je upla[ćc]eno\s+([\d.,]+)\s*RSD/i);
    if (!m) return null;
    return {
      type: 'income',
      amount: parseAmount(m[1]),
      month: toIsoDateFromHeader(date).slice(0, 7),
    };
  }

  return null;
}
