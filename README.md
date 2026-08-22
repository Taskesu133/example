# AI Biznis Asistent

AI chat widget koji se ugrađuje na sajt malog biznisa (restoran, salon, ordinacija, radnja...) i odgovara posetiocima 0-24 na pitanja o radnom vremenu, cenama, uslugama i pomaže oko zakazivanja. Pravljen da se lako konfiguriše po klijentu i prodaje kao mesečna usluga (agencijski model).

## Kako radi

- `server.js` — Node/Express server sa `/api/chat` endpoint-om koji poziva Claude API
- `config/clients/*.json` — po jedan fajl po klijentu (ime, radno vreme, usluge, cene, FAQ) — od ovoga se automatski gradi "znanje" asistenta
- `public/widget.js` — embeddable chat widget (vanilla JS, izolovan Shadow DOM-om da se ne kosi sa CSS-om klijentovog sajta)
- `public/demo.html` — demo sajt koji možeš da pošalješ potencijalnim klijentima da vide kako izgleda uživo

## Pokretanje lokalno

```bash
npm install
cp .env.example .env
# u .env upiši svoj ANTHROPIC_API_KEY (napraviš ga na console.anthropic.com)
npm start
```

Otvori `http://localhost:3000/demo.html` i klikni na 💬 dugme dole desno.

## Dodavanje novog klijenta

1. Kopiraj `config/clients/demo.json` u `config/clients/<ime-klijenta>.json` (samo mala slova, brojevi i crta u imenu fajla)
2. Popuni podatke o biznisu (radno vreme, usluge, cene, FAQ, ton komunikacije)
3. Na sajtu klijenta dodaj pred `</body>`:

```html
<script
  src="https://TVOJ-DOMEN.com/widget.js"
  data-business="ime-klijenta"
  data-color="#4f46e5"
  data-greeting="Ćao! Kako mogu da pomognem?"
></script>
```

Widget odmah počinje da koristi taj klijentov config — nema dodatnog koda za pisanje.

## Deploy (kad si spreman da ga staviš na pravi domen)

Ovo je običan Node.js server — radi na bilo kom jeftinom hostingu:

- **Railway / Render / Fly.io** — najlakše, povežeš repo, podesiš `ANTHROPIC_API_KEY` kao env var, deploy za par minuta
- **VPS (npr. Hetzner/DigitalOcean)** — `pm2 start server.js`, iza nginx-a sa svojim domenom

Widget script (`data-business="..."`) treba da pokazuje na domen gde je ovaj server deployovan.

## Troškovi i cene

Server podrazumevano koristi `claude-opus-5` (najkvalitetniji model). Za jeftiniji rad po razgovoru (bitno kad imaš dosta klijenata i poruka), promeni `CLAUDE_MODEL` u `.env` na `claude-sonnet-5` ili `claude-haiku-4-5` — kvalitet ostaje sasvim dovoljan za FAQ/zakazivanje, a cena po poruci pada nekoliko puta.

Predlog za prodaju klijentima: mesečna pretplata (npr. 20-50€/mesec po klijentu, zavisno od tržišta) pokriva i tvoj rad na podešavanju i troškove API poziva — realno troškovi po klijentu su ti mnogo niži od cene pretplate dok god ne budu imali stotine razgovora dnevno.

## Bezbednost / ograničenja

- Asistent NE izmišlja informacije koje nisu u `config/clients/*.json` — ako ne zna, prosleđuje na telefon/email klijenta
- Ne pravi prave rezervacije u kalendaru (to zahteva integraciju koja nije deo ovog MVP-a) — samo "beleži" zahtev i kaže da će osoblje potvrditi
- Ne daje medicinske/pravne/finansijske savete
