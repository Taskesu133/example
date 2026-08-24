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

## Deljenje budžeta sa drugima

Svaki korisnik ima svoj nalog. Kada napravi grupu, dobija jedinstveni kod za
pozivnicu koji može podeliti sa drugima (npr. ukućanima) — oni se pridružuju
preko dugmeta "Pridruži se grupi" i unosom tog koda. Svi članovi grupe vide
iste troškove, kategorije i budžet, i mogu da unose sopstvene troškove.

## Tehnologije

- **Backend**: Express, better-sqlite3, bcryptjs, jsonwebtoken, openai SDK (DeepSeek API)
- **Frontend**: React 19, React Router, Recharts, Vite
