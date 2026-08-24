# BudgetAI

Aplikacija za lično i zajedničko budžetiranje. Prati troškove, organizuj ih po
kategorijama, deli budžet sa drugima (porodica, cimeri) i dobij AI savete za
uštedu na osnovu tvoje potrošnje.

## Funkcionalnosti

- Registracija i prijava (JWT autentifikacija)
- Kreiranje budžet-grupa i pridruživanje preko koda za pozivnicu
- Dodavanje/brisanje troškova sa kategorijom, datumom i napomenom
- Prikaz troškova po kategorijama (grafikon) i po članu grupe
- Mesečni budžet sa progres-barom (koliko je potrošeno / preostalo)
- AI saveti za uštedu (DeepSeek API) na osnovu potrošnje za izabrani mesec
- Automatski uvoz troškova i uplata iz bankovnih mejlova (Yettel Bank preko Gmail-a)
- Ciljevi za štednju po grupi (npr. "Odmor") sa praćenjem uplata i progres-barom

## Struktura projekta

```
server/   Node.js + Express + SQLite/Turso (libSQL) backend (REST API)
client/   React (Vite) frontend
```

## Pokretanje

### 1. Backend

```bash
cd server
npm install
cp .env.example .env    # po potrebi izmeni JWT_SECRET
npm run dev              # http://localhost:4000
```

Za razvoj na svom računaru nije potreban poseban DB server — baza je
lokalni SQLite fajl (`server/data.sqlite`) koji se automatski kreira pri
prvom pokretanju. Za deploy (npr. na Render) preporučuje se besplatna
Turso cloud baza — vidi sekciju "Deploy na Render" niže.

### 2. Frontend

U novom terminalu:

```bash
cd client
npm install
npm run dev               # http://localhost:5173 (ili sledeći slobodan port)
```

Frontend automatski prosleđuje pozive ka `/api/*` na backend (port 4000)
preko Vite proxy-ja (vidi `client/vite.config.js`).

Otvori prikazani URL u browseru, registruj se, napravi grupu (ili se
pridruži preko koda za pozivnicu koji dobije vlasnik grupe) i počni da
unosiš troškove.

### 3. (Opciono) AI saveti za uštedu

Da bi radila AI kartica na dashboardu, potreban je DeepSeek API ključ
(https://platform.deepseek.com):

1. Otvori `server/.env`
2. Postavi `DEEPSEEK_API_KEY=tvoj-kljuc`
3. Restartuj backend

Bez ključa, ostatak aplikacije radi normalno — AI kartica samo prikazuje
poruku da funkcija nije podešena.

## Deploy na Render (potpuno besplatno)

Aplikacija je podešena da radi kao **jedan** besplatan Render Web Service
— backend servira i izgrađen React frontend (nema CORS komplikacija, ne
treba ti dodatni servis). Za trajne podatke (bez gubljenja naloga/troškova
kad servis "zaspi" i probudi se) koristi se **Turso** — besplatna,
SQLite-kompatibilna cloud baza koja ne ističe i ne traži karticu.

### Korak 1 — napravi besplatnu Turso bazu

1. Idi na https://turso.tech i napravi nalog (besplatno, bez kartice)
2. Instaliraj Turso CLI i uloguj se, ili koristi njihov web dashboard
3. Napravi bazu, npr:
   ```bash
   turso db create budgetai
   turso db show budgetai --url          # ovo je TURSO_DATABASE_URL
   turso db tokens create budgetai       # ovo je TURSO_AUTH_TOKEN
   ```
   (Isto možeš i preko dashboard-a na turso.tech, bez CLI-ja.)

### Korak 2 — deploy na Render preko Blueprint-a

1. Na Render dashboard-u: **New → Blueprint**
2. Poveži ovaj GitHub repo — Render će pronaći `render.yaml` u root folderu
   i sam podesiti besplatan plan, build/start komande i promenljive
3. Kad zatraži, unesi:
   - `DEEPSEEK_API_KEY` — tvoj DeepSeek ključ (opciono, za AI savete)
   - `TURSO_DATABASE_URL` i `TURSO_AUTH_TOKEN` iz koraka 1
4. Klikni Deploy

Bez Turso promenljivih, aplikacija i dalje radi (koristi lokalni SQLite
fajl kao fallback), ali na besplatnom Render planu bi se podaci gubili
kad servis zaspi zbog neaktivnosti i onda se ponovo probudi. Sa Turso
podešenim, podaci trajno ostaju — potpuno besplatno.

### Napomena o "buđenju" servisa

Besplatan Render plan uspava servis posle ~15 min neaktivnosti — prvi
sledeći zahtev čeka desetak sekundi dok se probudi. To je normalno i ne
utiče na podatke (koji sada žive u Turso, ne na samom servisu).

## Automatski uvoz troškova iz bankovnih mejlova (Yettel Bank)

Server sam čita Gmail (preko IMAP-a) i automatski dodaje troškove/uplate na
osnovu mejlova od `yettelbank@yettelbank.rs`, bez ikakve Claude/AI sesije —
radi 24/7 nezavisno, direktno unutar Render servisa.

**Prepoznaje tri tipa mejlova:**
- "Transakcija je izvršena" (kupovina karticom) → trošak
- "Zaduženje po tekućem računu" (direktno zaduženje) → trošak
- "Uplata na tekući račun" (uplata/plata) → dodaje se na budžet za taj mesec

Mejlovi o rati kredita, tarifniku i sl. se preskaču (nemaju iznos ili nisu
relevantni).

Troškovi u EUR se automatski pretvaraju u RSD po fiksnom kursu (podrazumevano
117.5, podesivo preko `EUR_TO_RSD_RATE`), tako da se svi troškovi ispravno
sabiraju u istoj valuti. Napomena troška ostaje sa originalnim EUR iznosom
radi transparentnosti (npr. "APPLE.COM/BILL CORK (2.99 EUR)").

### Korak 1 — napravi Gmail App Password

1. Na Gmail nalogu mora biti uključena dvofaktorska autentifikacija (2-Step
   Verification) — Google nalog → Bezbednost
2. Idi na https://myaccount.google.com/apppasswords
3. Napravi novu lozinku za aplikaciju (naziv npr. "BudgetAI"), kopiraj
   16-karakterni kod

### Korak 2 — podesi environment promenljive na Render-u

Servis → **Environment** → dodaj:
- `GMAIL_USER` — tvoja Gmail adresa
- `GMAIL_APP_PASSWORD` — kod iz koraka 1 (bez razmaka)
- `AUTOMATION_GROUP_NAME` — tačan naziv grupe u aplikaciji u koju idu ovi
  troškovi (mora se poklapati sa nazivom grupe, veličina slova nije bitna)

Sačuvaj — pri prvom pokretanju automatski se uvozi poslednjih 30 dana
istorije, a zatim samo nove mejlove.

### Korak 3 — drži servis "budnim" da bi automatizacija stvarno radila

Provera mejlova se pokreće kad neko/nešto pozove `/api/health` (najviše
jednom u 15 minuta). Da bi to bilo redovno bez tvog ručnog otvaranja
aplikacije, podesi besplatan spoljni servis da periodično "pinguje" tu
adresu — npr. [UptimeRobot](https://uptimerobot.com) (besplatno, do svakih
5 minuta):

1. Napravi nalog na uptimerobot.com
2. **Add New Monitor** → HTTP(s) → URL: `https://tvoj-servis.onrender.com/api/health`
3. Interval: 5 minuta → Save

Ovo istovremeno drži besplatan Render servis budnim i okida proveru mejlova.

## Deljenje budžeta sa drugima

Svaki korisnik ima svoj nalog. Kada napravi grupu, dobija jedinstveni kod za
pozivnicu koji može podeliti sa drugima (npr. ukućanima) — oni se pridružuju
preko dugmeta "Pridruži se grupi" i unosom tog koda. Svi članovi grupe vide
iste troškove, kategorije i budžet, i mogu da unose sopstvene troškove.

## Tehnologije

- **Backend**: Express, @libsql/client (SQLite/Turso), bcryptjs, jsonwebtoken, openai SDK (DeepSeek API), imapflow + mailparser (Gmail uvoz)
- **Frontend**: React 19, React Router, Recharts, Vite
