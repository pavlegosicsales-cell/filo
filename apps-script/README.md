# Apps Script pozadina za formu

`Code.gs` prima prijave sa `kontakt.html`, upisuje red u Google tabelu i šalje
jednu brendiranu poruku na mejl.

## Postavljanje

1. Otvori Google tabelu u koju idu prijave, pa **Extensions → Apps Script**.
   (Skript mora da se pravi iz Mirjaninog naloga, jer `MailApp` šalje sa naloga
   vlasnika skripta.)
2. Obriši sve u `Code.gs` i nalepi sadržaj ovog fajla.
3. `NOTIFY_TO` ostavi na razvojnoj adresi dok se ne potvrdi da poruke stižu.
4. **Deploy → New deployment → Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
5. Kopiraj `/exec` URL u `ENDPOINT` u `main.js` (šesti red).

## Puštanje uživo

Jedna linija: `NOTIFY_TO = 'mirjana.gosic@gmail.com'`, pa **Deploy → Manage
deployments → olovka → Version: New version**. Sama izmena koda ne menja ništa
na živom URL-u, to je zamka koja svakoga uhvati bar jednom.

## Podešavanja

| Konstanta | Čemu služi |
|---|---|
| `NOTIFY_TO` | Gde stižu prijave |
| `SHEET_URL` | Link na tabelu u podnožju poruke. Prazno ga sakriva |
| `SHEET_ID` | Popuniti samo ako skript nije vezan za tabelu |

## Polja

Imena parametara koja skript čita moraju da odgovaraju onima koje šalje
`main.js`:

`ime`, `telefon`, `email`, `predmet`, `termin`, `cilj`, `poruka`, `strana`

## Ograničenja

- Sajt šalje `no-cors`, pa browser ne može da pročita odgovor. Poruka „Prijava
  je poslata" se prikazuje bez obzira na to da li je slanje stvarno uspelo.
- Upis u tabelu i slanje mejla su razdvojeni. Ako upis padne, prijava svejedno
  stiže na mejl.
- Besplatan Gmail nalog šalje do 100 poruka dnevno. Za osamnaest mesta godišnje
  to je više nego dovoljno.

## Provera izgleda bez objavljivanja

```bash
node preview-win.js apps-script/Code.gs izlazni-folder
```

Renderuje punu prijavu i osam graničnih slučajeva (samo mejl, samo telefon,
telefon tipa „nemam", bez poruke, prazna prijava, zlonameran unos, predugačke
vrednosti) i pravi screenshotove.
