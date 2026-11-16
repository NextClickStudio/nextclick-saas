/* ==========================================================================
   PROGETTI
   --------------------------------------------------------------------------
   Ogni progetto è un blocco { ... }. Per aggiungerne uno: copia un blocco,
   cambia "slug" (diventa l'indirizzo progetto.html?p=slug), testi e immagini.
   L'ordine dei blocchi è l'ordine in cui appaiono sul sito.

   Campi:
     title     nome del progetto
     category  tipologia (usata anche per i filtri: Hotel, Residenza, Ristorante…)
     location  luogo          year  anno          area  superficie (es. "250 m²")
     services  servizi svolti
     cover     immagine principale { src, alt }
     intro     frase di apertura
     text      paragrafi di descrizione
     images    galleria: { src, alt, size: "full" | "half" }
               due "half" consecutive vengono affiancate.

   I campi lasciati vuoti ("") non vengono mostrati.
   ⚠ Titoli e testi qui sotto sono PROVVISORI: vanno sostituiti con quelli definitivi.
   ========================================================================== */

window.APTENIA_PROJECTS = [
  {
    slug: "progetto-uno",
    title: "Progetto Uno",
    category: "Hotel",
    location: "",
    year: "",
    area: "",
    services: ["Brand & Concept Design", "Product & Interior Design", "Experience Design"],
    cover: {
      src: "assets/img/progetti/progetto-uno/cover.jpg",
      alt: "Parete espositiva in metallo nero con mensole illuminate nella hall dell’hotel"
    },
    intro: "Il primo sguardo dell’ospite diventa un racconto.",
    text: [
      "Una struttura in metallo nero, luce calda e oggetti su misura trasformano la hall in una galleria dell’identità dell’hotel.",
      "Luce, metallo e oggetti dialogano con l’architettura esistente: ogni mensola è pensata per ciò che custodisce."
    ],
    images: [
      { src: "assets/img/progetti/progetto-uno/01.jpg", alt: "Vista d’insieme della parete espositiva", size: "half" },
      { src: "assets/img/progetti/progetto-uno/02.jpg", alt: "Dettaglio delle mensole illuminate", size: "half" },
      { src: "assets/img/progetti/progetto-uno/05.jpg", alt: "Un’ospite attraversa la hall", size: "full" },
      { src: "assets/img/progetti/progetto-uno/03.jpg", alt: "Dettaglio della parete con schermo e oggetti", size: "half" },
      { src: "assets/img/progetti/progetto-uno/04.jpg", alt: "Rivestimento a listelli in legno", size: "half" }
    ]
  },
  {
    slug: "progetto-due",
    title: "Progetto Due",
    category: "Residenza",
    location: "",
    year: "",
    area: "",
    services: ["Brand & Concept Design", "Product & Interior Design"],
    cover: {
      src: "assets/img/progetti/progetto-due/cover.jpg",
      alt: "Stand appendiabiti su misura in un ambiente con pareti materiche e parquet"
    },
    intro: "Un progetto privato pensato per accogliere.",
    text: [
      "Pareti materiche, legno caldo e un oggetto su misura che diventa il centro dell’esperienza dell’ospite."
    ],
    images: [
      { src: "assets/img/progetti/progetto-due/05.jpg", alt: "Vista dell’ambiente con lo stand su misura", size: "full" },
      { src: "assets/img/progetti/progetto-due/01.jpg", alt: "Stand in metallo con capi e accessori in pelle", size: "half" },
      { src: "assets/img/progetti/progetto-due/02.jpg", alt: "Texture della parete materica", size: "half" },
      { src: "assets/img/progetti/progetto-due/03.jpg", alt: "Base dello stand sul parquet", size: "full" }
    ]
  }
];
