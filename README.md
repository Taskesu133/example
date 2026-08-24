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

## Struktura projekta

```
server/   Node.js + Express + SQLite backend (REST API)
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

Baza podataka je SQLite fajl (`server/data.sqlite`) koji se automatski
kreira pri prvom pokretanju — nije potreban poseban DB server.

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

## Deploy na Render

Aplikacija je podešena da radi kao **jedan** Render Web Service — backend
servira i izgrađen React frontend, tako da nema CORS komplikacija i ne
treba ti dodatni servis.

### Opcija A — preko Blueprint-a (najlakše)

1. Na Render dashboard-u: **New → Blueprint**
2. Poveži ovaj GitHub repo — Render će pronaći `render.yaml` u root folderu
   i sam podesiti build/start komande, promenljive okruženja i disk
3. Kada te pita, unesi svoj `DEEPSEEK_API_KEY` (ostalo se popunjava samo)
4. Klikni Deploy

### Opcija B — ručno kreiranje servisa

1. **New → Web Service**, poveži repo
2. **Build Command**:
   `npm install --prefix client && npm run build --prefix client && npm install --prefix server`
3. **Start Command**: `node server/src/index.js`
4. **Environment Variables**:
   - `JWT_SECRET` — bilo koji dugačak nasumičan tekst
   - `DEEPSEEK_API_KEY` — tvoj DeepSeek ključ (opciono, za AI savete)
   - `DB_PATH` — `/var/data/data.sqlite` (samo ako dodaješ disk, videti niže)

### Trajnost podataka (SQLite)

Baza je običan fajl na disku. Render-ov **besplatni** plan ima efemeran
fajl-sistem — podaci (nalozi, troškovi) bi se izgubili pri svakom
redeploy-u ili restartu servisa. Za trajne podatke:

- Dodaj **Persistent Disk** servisu (Render → tvoj servis → Disks → Add
  Disk), mount path npr. `/var/data`, veličina 1GB je dovoljna za start
  — ovo zahteva plaćeni plan (najjeftiniji "Starter")
- Postavi `DB_PATH=/var/data/data.sqlite` da baza piše na taj disk

Ako ti je ovo samo za probu/demo, možeš i bez diska — samo znaj da će se
podaci povremeno resetovati.

## Deljenje budžeta sa drugima

Svaki korisnik ima svoj nalog. Kada napravi grupu, dobija jedinstveni kod za
pozivnicu koji može podeliti sa drugima (npr. ukućanima) — oni se pridružuju
preko dugmeta "Pridruži se grupi" i unosom tog koda. Svi članovi grupe vide
iste troškove, kategorije i budžet, i mogu da unose sopstvene troškove.

## Tehnologije

- **Backend**: Express, better-sqlite3, bcryptjs, jsonwebtoken, openai SDK (DeepSeek API)
- **Frontend**: React 19, React Router, Recharts, Vite
