# Aptenia — sito web

Portfolio di Aptenia, studio di Hospitality Identity Design.
Sito statico e semplice: HTML, CSS e un piccolo JavaScript, senza build e senza librerie esterne.
Lo stile segue le immagini di riferimento del cliente e le modifiche richieste: carta calda, un solo font sans vicino al Favorit della presentazione, titoli contenuti, foto sempre nelle proporzioni originali.

## Pagine

Il sito segue le reference del cliente (zip "Aptenia inspo"):

| File | Contenuto | Reference |
| --- | --- | --- |
| `index.html` | Tre foto a tutto schermo: “DESIGNING THE SOUL OF HOSPITALITY” (`assets/img/hero-home.jpg`), “About Aptenia” con tasto allo Studio (`home-about.jpg`), “Progetti” con tasto ai progetti | Modifiche 24.11 |
| `studio.html` | Metà foto delle fondatrici / metà testo, poi Identity Design e Il metodo come tre foto che si “illuminano” al passaggio del mouse (sempre accese su telefono) | Modifiche 24.11 |
| `progetti.html` | Tutti i progetti: foto della stessa dimensione con freccia ↘ e descrizione | Latest works |
| `progetto.html?p=<slug>` | Titolo, “Successivo”, foto orizzontale, scheda + testo, galleria con foto intere, precedente/successivo | #ND1H |
| `404.html` | Pagina non trovata | |

## Aggiungere o modificare un progetto

Tutto sta in `assets/js/projects.js`: copia un blocco, cambia `slug`, testi e immagini.
Le foto vanno in `assets/img/progetti/<slug>/`. Nella galleria due immagini `size: "half"` consecutive vengono affiancate, `"full"` va a tutta larghezza. I campi vuoti non vengono mostrati.

Foto: JPG sRGB, lato lungo 2000–2400 px per cover e immagini piene, ~1400 px per le altre, qualità ~80%.

## Stile

Colori in cima a `assets/css/style.css`: carta `#F3F1EC`, carta scura `#E8E5DE`, testo `#1F2326`.
Font in locale (`assets/fonts/`): Cormorant Garamond per i titoli maiuscoli (come “SITE ANALYSIS” e “BRIEF” della reference), Hanken Grotesk per i testi (il più vicino gratuito al Favorit della presentazione).
Foto: originali del Drive in alta qualità. Quelle della home e delle aperture dei progetti (`hero-home.jpg`, `cover-wide.jpg`) sono tagli orizzontali scelti a mano dagli originali; nelle gallerie le foto sono intere.
Animazioni minime: comparsa leggera degli elementi.

## Pubblicazione

Netlify: trascina la cartella (o lo zip) su app.netlify.com/drop. Non serve configurazione.
In locale basta aprire `index.html` con un doppio clic.

## Da completare

- [ ] Foto definitiva della home (Drive, HOME › Designing the Soul of Hospitality): supera i 10 MB e non è stata importata. Sostituire `assets/img/home-1.jpg` (ora c’è una foto provvisoria) con la foto (orizzontale, circa 2880 px di larghezza).

- [ ] Altre foto di Casa Selva: 12 originali sul Drive superano i 10 MB e non sono state importate; ne servono versioni più leggere.
- [ ] Video delle fondatrici (sul Drive, 61 MB): da comprimere se si vuole inserirlo.
- [ ] Anno dei progetti (campo `year` in `projects.js`).
- [ ] P.IVA nel footer (commentata in ogni pagina) e privacy policy.
- [ ] Verificare il telefono `+39 333328627` (9 cifre dopo il +39).
