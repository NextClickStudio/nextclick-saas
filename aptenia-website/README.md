# Aptenia — sito web

Portfolio di Aptenia, studio di Hospitality Identity Design.
Sito statico e semplice: HTML, CSS e un piccolo JavaScript, senza build e senza librerie esterne.
Lo stile segue le immagini di riferimento del cliente: carta calda, titoli serif maiuscoli, testi piccoli, griglia progetti con frecce, pagina progetto con scheda tecnica.

## Pagine

| File | Contenuto |
| --- | --- |
| `index.html` | Home: immagine con titolo, studio in breve, ultimi progetti con filtri, metodo (accordion), contatti |
| `studio.html` | Chi siamo, lo studio, cosa facciamo, come lo facciamo (`#metodo`), punti di forza |
| `progetti.html` | Tutti i progetti con filtri per tipologia |
| `progetto.html?p=<slug>` | Pagina progetto: titolo, cover, scheda (luogo, tipologia, anno, superficie, servizi), testo, galleria, precedente/successivo |
| `404.html` | Pagina non trovata (usata da Netlify) |

Header e footer sono uguali in tutte le pagine: se cambi un contatto, cambialo in ogni file (o cerca `info@aptenia.it`).

## Aggiungere o modificare un progetto

Tutto sta in `assets/js/projects.js`: copia un blocco, cambia `slug`, testi e immagini.
Le foto vanno in `assets/img/progetti/<slug>/`. Nella galleria due immagini `size: "half"` consecutive vengono affiancate, `"full"` va a tutta larghezza. I campi vuoti non vengono mostrati.

Foto: JPG sRGB, lato lungo 2000–2400 px per cover e immagini piene, ~1400 px per le altre, qualità ~80%.

## Stile

`assets/css/style.css`, colori in cima al file: carta `#F1EFEA`, carta scura `#E7E4DD`, blu Aptenia `#1A232F` per testi e pulsanti.
Font ospitati in locale (`assets/fonts/`, nessuna chiamata a Google): Cormorant Garamond per i titoli maiuscoli, Hanken Grotesk per i testi.
Animazioni ridotte al minimo: comparsa leggera degli elementi e lieve zoom delle foto al passaggio del mouse.

## Pubblicazione

Netlify: trascina la cartella (o lo zip) su app.netlify.com/drop. Non serve configurazione.
In locale basta aprire `index.html` con un doppio clic.

## Da completare

- [ ] Nomi, testi, luogo, anno, superficie e foto definitive dei progetti (ora "Progetto Uno/Due" con foto della company profile).
- [ ] P.IVA nel footer (commentata in ogni pagina) e privacy policy.
- [ ] Verificare il telefono `+39 333328627` (9 cifre dopo il +39).
