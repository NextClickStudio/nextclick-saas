/* ==========================================================================
   PROGETTI
   --------------------------------------------------------------------------
   Ogni progetto è un blocco { ... }. Per aggiungerne uno: copia un blocco,
   cambia "slug" (diventa l'indirizzo progetto.html?p=slug), testi e immagini.
   L'ordine dei blocchi è l'ordine in cui appaiono sul sito.

   Campi:
     title     nome del progetto            subtitle  titolo del concept
     category  tipologia                    location  luogo
     year      anno                         services  servizi svolti
     cover     immagine per le liste dei progetti (verticale 3:4)
     text      paragrafi di descrizione (testi caricati sul Drive)
     images    galleria, mostrata con le proporzioni originali delle foto:
               { src, alt, size: "full" | "half" } — due "half" consecutive
               vengono affiancate.

   I campi lasciati vuoti ("") non vengono mostrati.
   ========================================================================== */

window.APTENIA_PROJECTS = [
  {
    slug: "musa-lago-di-como",
    title: "MUSA Lago di Como",
    subtitle: "Le Stanze delle Muse",
    category: "Hotel",
    location: "Lago di Como",
    year: "",
    services: ["Brand & Concept Design", "Product Design", "Experience Design"],
    cover: {
      src: "assets/img/progetti/musa/09-mensola.jpg",
      alt: "Mensola con opera in metallo e scultura di equilibrista, MUSA Lago di Como"
    },
    text: [
      "Il progetto nasce dallo studio dell’identità di Musa e delle figure femminili a cui l’hotel ha scelto di dedicare ciascuna delle sue camere. Un percorso di ricerca volto ad approfondire la storia, la personalità e l’immaginario di ogni Musa, trasformandone gli elementi distintivi in un linguaggio progettuale.",
      "Da questa ricerca prende forma Le Stanze delle Muse, il concept creativo sviluppato da Aptenia per dare a ogni camera un’identità riconoscibile e un legame autentico con la figura che le dà il nome.",
      "Il progetto si traduce nella progettazione e produzione di dodici complementi d’arredo originali, uno per ciascuna stanza. Oggetti concepiti non come semplici elementi decorativi, ma come espressioni tangibili della storia di ogni Musa, capaci di dialogare con gli ambienti e arricchire l’esperienza del soggiorno.",
      "Il concept si estende oltre le camere e trova una sua ulteriore espressione nella creazione di uno shop dedicato all’interno dell’hotel. Uno spazio pensato per raccogliere i prodotti della collezione e permettere agli ospiti di acquistare e portare con sé un frammento dell’esperienza vissuta a MUSA, trasformando il ricordo del soggiorno in un oggetto da custodire."
    ],
    images: [
      { src: "assets/img/progetti/musa/01-shop.jpg", alt: "Lo shop dell’hotel: parete espositiva in metallo nero con mensole illuminate", size: "half" },
      { src: "assets/img/progetti/musa/02-scaffale.jpg", alt: "Scaffale illuminato con gli oggetti della collezione tra pareti blu", size: "half" },
      { src: "assets/img/progetti/musa/04-provette-alto.jpg", alt: "Portaprovette in metallo con tappi in sughero, visto dall’alto", size: "full" },
      { src: "assets/img/progetti/musa/03-provette.jpg", alt: "Portaprovette con sali colorati", size: "half" },
      { src: "assets/img/progetti/musa/07-vassoio.jpg", alt: "Vassoio con anelli in metallo nero e specchio anticato", size: "half" },
      { src: "assets/img/progetti/musa/05-calendario.jpg", alt: "Calendario perpetuo in pietra", size: "half" },
      { src: "assets/img/progetti/musa/06-calendario-pietra.jpg", alt: "Dettaglio del calendario perpetuo in travertino", size: "half" },
      { src: "assets/img/progetti/musa/08-anelli.jpg", alt: "Vassoio con anelli in metallo su piano in marmo", size: "half" },
      { src: "assets/img/progetti/musa/10-pannello.jpg", alt: "Pannello in metallo lavorato", size: "half" }
    ]
  },
  {
    slug: "casa-selva",
    title: "Casa Selva",
    subtitle: "L’arte di accogliere",
    category: "Residenza privata",
    location: "Brianza comasca",
    year: "",
    services: ["Brand & Concept Design", "Product & Interior Design"],
    cover: {
      src: "assets/img/progetti/casa-selva/02-vassoio.jpg",
      alt: "Vassoio e candela rivestiti in pelle verde e tortora, Casa Selva"
    },
    text: [
      "Immersa nei boschi della Brianza comasca, Casa Selva è una residenza privata che si trasforma in un luogo di incontro e convivialità. Qui i proprietari accolgono regolarmente amici e ospiti, accomunati dalla passione per il mondo equestre, la caccia sportiva e la vita all’aria aperta.",
      "Aptenia ha sviluppato il progetto partendo dallo studio delle persone, delle loro storie e delle passioni che rendono questa residenza un luogo così particolare. Da un lato, la tradizione familiare del proprietario nella lavorazione artigianale della pelle per la selleria; dall’altro, la sensibilità artistica della moglie e la sua ricerca attraverso il colore.",
      "Due universi distinti, tradotti in un unico linguaggio progettuale attraverso la scelta dei materiali, l’accostamento cromatico e lo studio di forme e dettagli. La pelle, reinterpretata in chiave contemporanea, incontra accenti di colore intensi e inaspettati, creando un contrasto con la naturale essenzialità della pietra e del legno.",
      "Dalla definizione del concept alla progettazione e produzione dei complementi d’arredo, ogni elemento è stato pensato per integrarsi nell’architettura e accompagnare la vita della casa, contribuendo a rendere speciale l’esperienza di chi la abita e di chi vi soggiorna."
    ],
    images: [
      { src: "assets/img/progetti/casa-selva/01-tavola.jpg", alt: "Tavola apparecchiata con sottopiatti e centrotavola in pelle, vista sul giardino", size: "half" },
      { src: "assets/img/progetti/casa-selva/03-ciotole.jpg", alt: "Ciotole in metallo su base in pelle blu accanto a un rivestimento in legno", size: "half" },
      { src: "assets/img/progetti/casa-selva/02-vassoio.jpg", alt: "Vassoio e candela rivestiti in pelle verde e tortora", size: "half" }
    ]
  }
];
