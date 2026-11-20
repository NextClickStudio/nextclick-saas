# Aptenia — sito web

Portfolio di Aptenia, studio di Hospitality Identity Design.
Sito statico e semplice: HTML, CSS e un piccolo JavaScript, senza build e senza librerie esterne.
Lo stile segue le immagini di riferimento del cliente e le modifiche richieste: carta calda, un solo font sans vicino al Favorit della presentazione, titoli contenuti, foto sempre nelle proporzioni originali.

## Pagine

| File | Contenuto |
| --- | --- |
| `index.html` | Home: foto dello shop MUSA a tutta larghezza con “Designing the soul of hospitality” centrato, poi i progetti con descrizione e i contatti. Per la versione con foto laterale togliere le classi `hero--center hero--cover` dal blocco `hero` e mettere il titolo prima della foto |
| `studio.html` | About Aptenia in una sola pagina discorsiva: chi siamo, i tre ambiti dell’Identity Design, il metodo (`#metodo`), il percorso |
| `progetti.html` | Tutti i progetti: foto della stessa dimensione e descrizione |
| `progetto.html?p=<slug>` | Pagina progetto: titolo, scheda (luogo, tipologia, anno, servizi), testo completo, galleria con foto intere, precedente/successivo |
| `404.html` | Pagina non trovata (usata da Netlify) |

Header e footer sono uguali in tutte le pagine: se cambi un contatto, cambialo in ogni file (o cerca `info@aptenia.it`).

## Aggiungere o modificare un progetto

Tutto sta in `assets/js/projects.js`: copia un blocco, cambia `slug`, testi e immagini.
Le foto vanno in `assets/img/progetti/<slug>/`. Nella galleria due immagini `size: "half"` consecutive vengono affiancate, `"full"` va a tutta larghezza. I campi vuoti non vengono mostrati.

Foto: JPG sRGB, lato lungo 2000–2400 px per cover e immagini piene, ~1400 px per le altre, qualità ~80%.

## Stile

`assets/css/style.css`, colori in cima al file: carta `#F1EFEA`, carta scura `#E7E4DD`, blu Aptenia `#1A232F`.
Font ospitato in locale (`assets/fonts/`): Hanken Grotesk, il più vicino gratuito al Favorit della presentazione. Con una licenza web di Favorit basta aggiungere i file e le regole `@font-face` in `assets/css/fonts.css` e cambiare `--sans` in `style.css`.
Le foto non vengono mai ritagliate, tranne le copertine nell’elenco progetti, che hanno tutte la stessa proporzione 3:4.
Animazioni minime: comparsa leggera degli elementi.

## Pubblicazione

Netlify: trascina la cartella (o lo zip) su app.netlify.com/drop. Non serve configurazione.
In locale basta aprire `index.html` con un doppio clic.

## Da completare

- [ ] Altre foto di Casa Selva: 12 originali sul Drive superano i 10 MB e non sono state importate; ne servono versioni più leggere.
- [ ] Video delle fondatrici (sul Drive, 61 MB): da comprimere se si vuole inserirlo.
- [ ] Anno dei progetti (campo `year` in `projects.js`).
- [ ] P.IVA nel footer (commentata in ogni pagina) e privacy policy.
- [ ] Verificare il telefono `+39 333328627` (9 cifre dopo il +39).
