/* ==========================================================================
   PROGETTI
   --------------------------------------------------------------------------
   Ogni progetto è un blocco { ... }. Per aggiungerne uno: copia un blocco,
   cambia "slug" (diventa l'indirizzo: /progetti/slug), testi e immagini.
   L'ordine dei blocchi è l'ordine in cui appaiono sul sito.

   Nei testi puoi usare *asterischi* per il corsivo.

   Blocchi disponibili per la galleria ("layout"):
     full    → immagine a tutta larghezza
     pair    → due immagini affiancate e sfalsate  (images: [ {...}, {...} ])
     offset  → un'immagine spostata a sinistra o a destra (align: "left" | "right",
               size: "small" per una versione più piccola) con didascalia accanto
     quote   → una frase in grande
     text    → un titoletto + un paragrafo

   Ogni immagine accetta: src, alt (descrizione per accessibilità/SEO),
   caption (didascalia, opzionale), ratio (proporzione, es. "3/4", opzionale).

   ⚠ I testi qui sotto sono SEGNAPOSTO: vanno sostituiti con quelli definitivi.
   ========================================================================== */

window.APTENIA_PROJECTS = [
  {
    slug: "progetto-uno",
    title: "Progetto Uno",
    tagline: "Una parete-galleria che racconta la storia dell’hotel a chi entra.",
    category: "Hotel",
    location: "Città, Italia",
    year: "2025",
    services: ["Brand & Concept Design", "Product & Interior Design", "Experience Design"],
    credits: [["Fotografia", "Nome Cognome"]],
    cover: {
      src: "assets/img/progetti/progetto-uno/cover.jpg",
      alt: "Parete espositiva in metallo nero con mensole illuminate nella hall dell’hotel",
      ratio: "16/9"
    },
    intro: "Il primo sguardo dell’ospite diventa un racconto: una struttura in metallo nero, luce calda e oggetti su misura che trasformano la hall in una *galleria dell’identità*.",
    text: [
      "Testo segnaposto. Qui va la descrizione del progetto: il contesto, la storia del luogo, cosa è emerso durante il sopralluogo e come è stato tradotto in spazi, prodotti ed esperienze.",
      "Secondo paragrafo segnaposto: materiali, artigiani coinvolti, dettagli costruttivi e il risultato per gli ospiti."
    ],
    gallery: [
      {
        layout: "pair",
        images: [
          { src: "assets/img/progetti/progetto-uno/01.jpg", alt: "Vista d’insieme della parete espositiva e del passaggio", ratio: "2/3", caption: "La hall, vista d’insieme." },
          { src: "assets/img/progetti/progetto-uno/02.jpg", alt: "Dettaglio delle mensole illuminate con oggetti", ratio: "1/1", caption: "Mensole su misura con luce integrata." }
        ]
      },
      { layout: "quote", text: "Ogni oggetto racconta *un capitolo* della storia del luogo." },
      { layout: "full", src: "assets/img/progetti/progetto-uno/05.jpg", alt: "Un’ospite attraversa la hall", ratio: "21/9" },
      {
        layout: "text",
        title: "Il dettaglio",
        text: "Testo segnaposto sul dettaglio: come luce, metallo e oggetti dialogano con l’architettura esistente."
      },
      { layout: "offset", align: "right", src: "assets/img/progetti/progetto-uno/03.jpg", alt: "Dettaglio della parete con schermo e oggetti", ratio: "1/1", caption: "Didascalia segnaposto." },
      { layout: "offset", align: "left", size: "small", src: "assets/img/progetti/progetto-uno/04.jpg", alt: "Dettaglio del rivestimento a listelli in legno", ratio: "3/5", caption: "Listelli in legno all’ingresso." }
    ]
  },

  {
    slug: "progetto-due",
    title: "Progetto Due",
    tagline: "Un rituale di accoglienza costruito su materia, colore e misura.",
    category: "Residenza privata",
    location: "Città, Italia",
    year: "2025",
    services: ["Brand & Concept Design", "Product & Interior Design"],
    credits: [["Fotografia", "Nome Cognome"]],
    cover: {
      src: "assets/img/progetti/progetto-due/cover.jpg",
      alt: "Stand appendiabiti su misura in un ambiente con pareti materiche e parquet",
      ratio: "16/9"
    },
    intro: "Un progetto privato pensato per accogliere: pareti materiche, legno caldo e un *oggetto su misura* che diventa il centro dell’esperienza.",
    text: [
      "Testo segnaposto. Qui va la descrizione del progetto: chi sono gli ospiti, quale atmosfera si voleva creare, quali elementi sono stati disegnati su misura.",
      "Secondo paragrafo segnaposto: materiali, finiture e collaborazioni con artigiani e produttori."
    ],
    gallery: [
      { layout: "full", src: "assets/img/progetti/progetto-due/05.jpg", alt: "Vista dell’ambiente con lo stand su misura", ratio: "21/9" },
      {
        layout: "pair",
        images: [
          { src: "assets/img/progetti/progetto-due/01.jpg", alt: "Stand appendiabiti in metallo con capi e accessori in pelle", ratio: "2/3", caption: "L’oggetto su misura." },
          { src: "assets/img/progetti/progetto-due/02.jpg", alt: "Texture della parete materica", ratio: "2/3", caption: "La materia delle pareti." }
        ]
      },
      { layout: "quote", text: "Accogliere è *un gesto* che si progetta." },
      { layout: "offset", align: "left", src: "assets/img/progetti/progetto-due/03.jpg", alt: "Base dello stand sul parquet in legno", ratio: "16/10", caption: "Didascalia segnaposto." },
      { layout: "offset", align: "right", size: "small", src: "assets/img/progetti/progetto-due/04.jpg", alt: "Dettaglio dell’accessorio in pelle verde", ratio: "2/3", caption: "Pelle color salvia, cucita a mano." }
    ]
  }
];
