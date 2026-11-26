# Aptenia — sito web

Portfolio di Aptenia, studio di Hospitality Identity Design.
Sito statico e semplice: HTML, CSS e un piccolo JavaScript, senza build e senza librerie esterne.
Lo stile segue le immagini di riferimento del cliente e le modifiche richieste: carta calda, un solo font sans vicino al Favorit della presentazione, titoli contenuti, foto sempre nelle proporzioni originali.

## Pagine

Il sito segue le reference del cliente (zip "Aptenia inspo"):

| File | Contenuto | Reference |
| --- | --- | --- |
| `index.html` | Tre foto intere (non tagliate) e distanziate: “Designing the soul of hospitality” (`assets/img/home-1.jpg`), “About Aptenia” (`home-about.jpg`), “Progetti” (`home-3.jpg`) | Modifiche 25.11 |
| `studio.html` | Metà foto / metà testo, poi Identity Design: tre foto che si “illuminano” al passaggio (foto ABOUT_01/02/03) | Modifiche 25.11 |
| `metodo.html` | Discover, Design, Deliver: tre sezioni metà foto / metà testo, alternate | Modifiche 25.11 |
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

- [ ] Seconda foto della home: “attendi foto giusta” (ora c'è la foto delle fondatrici, `assets/img/home-about.jpg`).
- [ ] Casa Selva: sul Drive ci sono altre 11 foto oltre i 10 MB non ancora importate; aggiungerle in `assets/img/progetti/casa-selva/` e in `projects.js`.
- [ ] P.IVA nel footer, privacy policy, anno dei progetti, verifica telefono `+39 333328627`.
