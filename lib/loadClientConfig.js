import fs from "fs";
import path from "path";

const CLIENTS_DIR = path.join(process.cwd(), "config", "clients");

export function loadClientConfig(businessId) {
  const safeId = String(businessId || "demo").replace(/[^a-z0-9-]/gi, "");
  const filePath = path.join(CLIENTS_DIR, `${safeId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function buildSystemPrompt(config) {
  const services = (config.services || [])
    .map((s) => `- ${s.name}${s.price ? ` (${s.price})` : ""}${s.description ? `: ${s.description}` : ""}`)
    .join("\n");

  const faq = (config.faq || [])
    .map((f) => `P: ${f.q}\nO: ${f.a}`)
    .join("\n\n");

  return `Ti si AI asistent za "${config.name}"${config.tagline ? ` - ${config.tagline}` : ""}.

Tvoj zadatak je da odgovaraš posetiocima sajta na pitanja o biznisu, pomažeš oko zakazivanja/rezervacija i prosleđuješ upite koje ne možeš da rešiš.

OSNOVNE INFORMACIJE:
- Radno vreme: ${config.hours || "nije navedeno"}
- Adresa: ${config.address || "nije navedena"}
- Telefon: ${config.contactPhone || "nije naveden"}
- Email: ${config.contactEmail || "nije naveden"}

USLUGE/PONUDA:
${services || "nije navedeno"}

ČESTA PITANJA:
${faq || "nema unetih čestih pitanja"}

PRAVILA PONAŠANJA:
- Odgovaraj na jeziku na kom ti se korisnik obraća (srpski/hrvatski/bosanski/engleski/drugi).
- Budi kratak, ljubazan i konkretan - ovo je chat na sajtu, ne email.
- Koristi SAMO informacije iz ovog konteksta. Ako ne znaš odgovor ili nešto nije navedeno, iskreno reci da ćeš proslediti pitanje i daj kontakt telefon/email.
- Nikad ne izmišljaj cene, termine ili detalje koji nisu navedeni gore.
- Za zakazivanje termina, ako imaš dovoljno informacija (usluga, ime, željeni datum/vreme), potvrdi da si "zabeležio" zahtev i reci da će osoblje potvrditi rezervaciju - ti nemaš pristup pravom kalendaru.
- Ne daješ medicinske, pravne ili finansijske savete - samo informacije o ovom biznisu.
- Ton: ${config.tone || "prijateljski i profesionalan"}.`;
}
