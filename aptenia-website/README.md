# Aptenia — sito web

Portfolio di Aptenia, studio di Hospitality Identity Design.
Sito statico: HTML, CSS e JavaScript, senza build. Le animazioni usano GSAP (ScrollTrigger e SplitText) e Lenis per lo scroll fluido, tutti salvati in `assets/vendor/`.

## Struttura

```
index.html              → home, contatti/footer e logo (nei <template>)
assets/css/style.css    → colori, tipografia e layout
assets/css/fonts.css    → font ospitati localmente (assets/fonts/)
assets/js/projects.js   → I PROGETTI (testi, immagini, gallerie)
assets/js/main.js       → navigazione tra pagine, transizioni e animazioni
assets/img/brand/       → logo vettoriale e favicon
assets/img/studio/      → foto del team
assets/img/metodo/      → foto e materiali della sezione Metodo
assets/img/progetti/    → una cartella per progetto
vercel.json, _redirects → indirizzi puliti su Vercel / Netlify
```

## Pagine

| Indirizzo             | Contenuto                                                                         |
| --------------------- | --------------------------------------------------------------------------------- |
| `/`                   | Home: hero, Mission & Vision, team, progetti, approccio, metodo, punti di forza   |
| `/studio`, `/metodo`  | Portano alla home e scorrono fino alla sezione                                    |
| `/contatti`           | Scorre ai contatti (presenti in fondo a ogni pagina)                              |
| `/progetti`           | Archivio con filtri per tipologia e anteprima al passaggio del mouse              |
| `/progetti/<slug>`    | Pagina progetto, generata da `projects.js`                                        |

## Aggiungere un progetto

1. Crea la cartella `assets/img/progetti/<nome-progetto>/` e mettici le foto.
2. In `assets/js/projects.js` copia un blocco `{ ... }` e modifica `slug`, testi e percorsi delle immagini.
3. Fatto: card in home, riga nell'archivio, pagina dedicata e link "Prossimo progetto" si aggiornano da soli.

I blocchi galleria disponibili (`full`, `pair`, `offset`, `quote`, `text`) sono descritti in cima a `projects.js`.

### Foto

- Formato JPG, lato lungo 2000–2400 px per le immagini a tutta larghezza, circa 1400 px per le altre.
- Qualità circa 80%, profilo **sRGB** (non CMYK).
- Il campo `ratio` stabilisce la proporzione del riquadro, per esempio `"3/4"`. La foto viene ritagliata al centro per riempirlo.

## Modificare i testi della home

I testi sono in `index.html`, dentro `<template id="tpl-home">`. Contatti e footer stanno in `<template id="tpl-footer">`.

## Elementi animati

| Elemento | Dove | Come funziona |
| --- | --- | --- |
| Luce e pulviscolo | Hero | Una luce calda segue il cursore sulla foto (su telefono si muove da sola), con il pulviscolo nel fascio. |
| Dal disegno allo spazio | Home, prima dei progetti | Il disegno tecnico della parete del Progetto Uno si traccia linea per linea e poi diventa la foto. |
| The Identity Walkthrough | Metodo, fase 01 | La pianta si disegna e un percorso attraversa lobby, bar e camera fermandosi sulle tre aree di analisi. |
| The Identity Book | Metodo, fase 02 | Un libro in 3D si apre e si sfoglia: analisi, moodboard con palette e materiali, schizzi che si disegnano. |
| Diagramma | Hospitality Identity Design | I tre cerchi si incontrano e generano il cuore del metodo. |

Il disegno di "Dal disegno allo spazio" è tracciato sulla foto `assets/img/progetti/progetto-uno/cover.jpg`. Se cambia quella foto, va ridisegnato oppure basta togliere la `<section class="bp">` da `index.html`.

Tutte le animazioni rispettano l'impostazione "riduci movimento" del sistema: in quel caso il sito si mostra fermo e completo.

## Vedere il sito in locale

- Doppio clic su `index.html`: funziona, con indirizzi del tipo `index.html#/progetti/...`.
- Con un server locale e indirizzi puliti: `npx serve -s .` dalla cartella del sito.

## Pubblicazione

- **Vercel**: importa la cartella o il repository, senza build. `vercel.json` gestisce gli indirizzi puliti.
- **Netlify**: trascina la cartella (o lo zip) su app.netlify.com/drop. `_redirects` fa la stessa cosa. Nella cartella da caricare servono solo `index.html`, `_redirects` e `assets/`.

## Font

La company profile usa **Favorit** (Dinamo). Sul sito c'è per ora **Hanken Grotesk**, che le somiglia, insieme a **Instrument Serif** per i titoli. Entrambi sono open source e ospitati in `assets/fonts/`, senza chiamate a Google: niente problemi GDPR. Con una licenza web di Favorit:

1. copia i file `.woff2` in `assets/fonts/`;
2. aggiungi le regole `@font-face` in `assets/css/fonts.css`;
3. cambia `--font-sans` in `style.css` in `"Favorit", "Hanken Grotesk", sans-serif`.

## Da completare prima della messa online

- [ ] Nomi, testi, luogo, anno e crediti dei progetti: i titoli "Progetto Uno/Due" sono provvisori, i campi vuoti non vengono mostrati.
- [ ] Foto in alta qualità: ora sono estratte dalla company profile.
- [ ] Numero di telefono: nella presentazione è `+39 333328627` (9 cifre dopo il +39). Va verificato.
- [ ] P.IVA nel footer, obbligatoria per legge.
- [ ] Privacy policy. Al momento il sito non usa cookie, analytics né servizi esterni; i font sono in locale. Con Google Analytics o simili serve anche il banner cookie.
- [ ] Profili social (Instagram, LinkedIn), se ci sono.
- [ ] Dominio (es. aptenia.it) collegato all'hosting.
