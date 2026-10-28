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

## Vedere il sito in locale

- Doppio clic su `index.html`: funziona, con indirizzi del tipo `index.html#/progetti/...`.
- Con un server locale e indirizzi puliti: `npx serve -s .` dalla cartella del sito.

## Pubblicazione

- **Vercel**: importa la cartella o il repository, senza build. `vercel.json` gestisce gli indirizzi puliti.
- **Netlify**: trascina la cartella. `_redirects` fa la stessa cosa.

## Font

La company profile usa **Favorit** (Dinamo). Sul sito c'è per ora **Hanken Grotesk**, che le somiglia, insieme a **Instrument Serif** per i titoli. Entrambi sono open source e ospitati in `assets/fonts/`, senza chiamate a Google: niente problemi GDPR. Con una licenza web di Favorit:

1. copia i file `.woff2` in `assets/fonts/`;
2. aggiungi le regole `@font-face` in `assets/css/fonts.css`;
3. cambia `--font-sans` in `style.css` in `"Favorit", "Hanken Grotesk", sans-serif`.

## Da completare prima della messa online

- [ ] Testi, foto e crediti definitivi dei progetti: quelli in `projects.js` sono segnaposto.
- [ ] Foto in alta qualità: ora sono estratte dalla company profile.
- [ ] Numero di telefono: nella presentazione è `+39 333328627` (9 cifre dopo il +39). Va verificato.
- [ ] P.IVA nel footer, obbligatoria per legge.
- [ ] Privacy policy. Al momento il sito non usa cookie, analytics né servizi esterni; i font sono in locale. Con Google Analytics o simili serve anche il banner cookie.
- [ ] Profili social (Instagram, LinkedIn), se ci sono.
- [ ] Dominio (es. aptenia.it) collegato all'hosting.
