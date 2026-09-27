/**
 * The curriculum. Every lesson is a list of questions; the player shuffles them.
 * Brand and designer names appear as knowledge only (no logos, no brand images).
 */
import type { Lesson, Option, Question, Unit, Visual } from "./types";

// ---------------------------------------------------------------- helpers
const C = (prompt: string, answer: Option, wrong: Option[], explain?: string): Question => ({
  type: "choice",
  prompt,
  options: [answer, ...wrong],
  answer: 0,
  explain,
});
const CV = (prompt: string, visual: Visual, answer: string, wrong: string[], explain?: string): Question => ({
  type: "choice",
  prompt,
  visual,
  options: [answer, ...wrong],
  answer: 0,
  explain,
});
const T = (prompt: string, answer: boolean, explain?: string): Question => ({ type: "truefalse", prompt, answer, explain });
const P = (prompt: string, pairs: [Option, string][]): Question => ({ type: "pairs", prompt, pairs });
const O = (prompt: string, items: string[], explain?: string): Question => ({ type: "order", prompt, items, explain });

const col = (hex: string): Visual => ({ kind: "color", hex });
const pat = (id: string, main: string, accent: string, scale = 1.4, angle?: number): Visual => ({
  kind: "pattern",
  material: { id: id as never, main, accent, scale, angle },
});
const mood = (a: string, b: string): Visual => ({ kind: "mood", colors: [a, b] });

/** Deterministic pick of `n` distractors from a list, skipping the answer. */
function others<T>(list: T[], skip: T, n: number, seed: number): T[] {
  const pool = list.filter((x) => x !== skip);
  const out: T[] = [];
  let i = seed % pool.length;
  while (out.length < n && out.length < pool.length) {
    out.push(pool[i % pool.length]);
    i += 3;
  }
  return out;
}

/** Colour lessons: name the swatch, pick the swatch, match pairs. */
function colourLesson(list: [string, string][]): Question[] {
  const names = list.map(([n]) => n);
  const qs: Question[] = [];
  list.slice(0, 5).forEach(([name, hex], i) => qs.push(CV("What is this colour called?", col(hex), name, others(names, name, 3, i + 1))));
  list.slice(5, 9).forEach(([name, hex], i) => {
    const wrong = others(list, list.find((c) => c[0] === name)!, 3, i + 2).map(([, h]) => col(h));
    qs.push(C(`Which one is ${name}?`, col(hex), wrong));
  });
  qs.push(P("Match each colour to its name", list.slice(8, 12).map(([n, h]) => [col(h), n])));
  qs.push(P("Match each colour to its name", list.slice(0, 4).map(([n, h]) => [col(h), n])));
  return qs;
}

// ---------------------------------------------------------------- 1. Colour
const COLOURS_A: [string, string][] = [
  ["Butter Yellow", "#f0dc98"],
  ["Bordeaux", "#651828"],
  ["Sage", "#9dab8b"],
  ["Cobalt", "#1f3fa3"],
  ["Camel", "#b88a56"],
  ["Lilac", "#b8a5cf"],
  ["Emerald", "#0e6a4d"],
  ["Terracotta", "#b65c3d"],
  ["Navy", "#1b2340"],
  ["Blush", "#e8c4be"],
  ["Mustard", "#c8992d"],
  ["Chocolate", "#47291e"],
];
const COLOURS_B: [string, string][] = [
  ["Powder Blue", "#b6c8da"],
  ["Fuchsia", "#c0195d"],
  ["Olive", "#5d6036"],
  ["Teal", "#1d6d70"],
  ["Ecru", "#e3d6bd"],
  ["Rust", "#94411f"],
  ["Plum", "#4d2244"],
  ["Mint", "#bfe0cc"],
  ["Tomato Red", "#d33a2c"],
  ["Charcoal", "#3b3a39"],
  ["Periwinkle", "#8e97e0"],
  ["Pistachio", "#b9c98a"],
];

const colour: Unit = {
  id: "colour",
  title: "Colour",
  blurb: "Names, the colour wheel and how to pair them",
  color: "#e8c4be",
  ink: "#2a1414",
  lessons: [
    { id: "colour-1", unit: "colour", title: "Colour names I", questions: colourLesson(COLOURS_A) },
    { id: "colour-2", unit: "colour", title: "Colour names II", questions: colourLesson(COLOURS_B) },
    {
      id: "colour-3",
      unit: "colour",
      title: "The colour wheel",
      questions: [
        C("What is the complementary colour of blue?", "Orange", ["Green", "Purple", "Yellow"], "Complementary colours sit opposite each other on the wheel."),
        C("What is the complementary colour of red?", "Green", ["Orange", "Blue", "Pink"]),
        C("What is the complementary colour of yellow?", "Purple", ["Green", "Orange", "Red"]),
        C("Colours that sit next to each other on the wheel are called…", "Analogous", ["Complementary", "Triadic", "Neutral"]),
        C("A look built from shades of one single colour is…", "Monochromatic", ["Analogous", "Complementary", "Tonal contrast"]),
        C("Three colours evenly spaced on the wheel form a…", "Triadic scheme", ["Split scheme", "Tonal scheme", "Neutral scheme"]),
        T("In paint, the primary colours are red, yellow and blue.", true),
        T("Complementary colours worn together look calm and low-contrast.", false, "They create the strongest contrast: that's why they 'pop'."),
        C("Green, orange and purple are…", "Secondary colours", ["Primary colours", "Neutrals", "Earth tones"]),
        P("Match each colour to its complement", [
          ["Blue", "Orange"],
          ["Red", "Green"],
          ["Yellow", "Purple"],
          ["Teal", "Coral"],
        ]),
      ],
    },
    {
      id: "colour-4",
      unit: "colour",
      title: "Warm, cool & neutral",
      questions: [
        C("A colour mixed with white is called a…", "Tint", ["Shade", "Tone", "Hue"]),
        C("A colour mixed with black is called a…", "Shade", ["Tint", "Tone", "Pastel"]),
        C("A colour mixed with grey is called a…", "Tone", ["Tint", "Shade", "Hue"]),
        C("Which of these is a warm colour?", "Terracotta", ["Navy", "Sage", "Lilac"]),
        C("Which of these is a cool colour?", "Teal", ["Mustard", "Rust", "Camel"]),
        T("Navy is treated as a neutral in menswear.", true),
        T("Jewel tones are pale, powdery colours.", false, "Jewel tones are deep and saturated: emerald, sapphire, ruby, amethyst."),
        T("Pastels are colours softened with a lot of white.", true),
        C("Which is NOT a classic neutral?", "Cobalt", ["Camel", "Grey", "Ecru"]),
        C("Pairing different shades of beige, camel and brown is called…", "Tonal dressing", ["Colour blocking", "Clashing", "Contrast dressing"]),
        C("Wearing large blocks of bold, contrasting colours is called…", "Colour blocking", ["Tonal dressing", "Ombré", "Monochrome"], "Popularised in the 1960s, famously by Yves Saint Laurent's Mondrian dress (1965)."),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 2. Fabrics & prints
const PRINTS_A: [string, Visual][] = [
  ["Houndstooth", pat("houndstooth", "#efe9dd", "#161514", 1.8)],
  ["Pinstripe", pat("stripes", "#23252b", "#8c8e94", 0.6)],
  ["Polka dots", pat("polka", "#161514", "#f3efe7", 1.6)],
  ["Gingham", pat("check", "#f3efe7", "#c0392b", 1.4)],
  ["Breton stripe", pat("stripes", "#f3efe7", "#1b2340", 1.1, 90)],
  ["Checkerboard", pat("checker", "#f1ece2", "#1b1a19", 1.6)],
];
const PRINTS_B: [string, Visual][] = [
  ["Leopard", pat("leopard", "#c99a5b", "#2a1d12", 1.3)],
  ["Zebra", pat("zebra", "#f1ece2", "#151413", 1.4)],
  ["Snakeskin", pat("snake", "#b9ab8c", "#4b4130", 1.2)],
  ["Camouflage", pat("camo", "#6b6b45", "#3b3a24", 1.5)],
  ["Argyle", pat("argyle", "#e3d6bd", "#5d6036", 1.4)],
  ["Tartan", pat("check", "#7d1c24", "#1c2b45", 2)],
];
function printLesson(list: [string, Visual][], extra: Question[]): Question[] {
  const names = list.map(([n]) => n);
  const qs: Question[] = list.map(([name, v], i) => CV("Which print is this?", v, name, others(names, name, 3, i + 1)));
  qs.push(P("Match each print to its name", list.slice(0, 4).map(([n, v]) => [v, n])));
  return [...qs, ...extra];
}

const fabrics: Unit = {
  id: "fabrics",
  title: "Fabrics & prints",
  blurb: "Recognise every print, fibre and weave",
  color: "#35507a",
  ink: "#f2eee6",
  lessons: [
    {
      id: "fabrics-1",
      unit: "fabrics",
      title: "Classic prints",
      questions: printLesson(PRINTS_A, [
        T("Houndstooth is a broken check with four-pointed shapes.", true),
        T("The Breton stripe comes from the uniform of French sailors.", true, "Officially adopted by the French navy in 1858; Coco Chanel brought it into fashion."),
        C("Pinstripes are most associated with…", "Tailored suits", ["Swimwear", "Knitwear", "Evening gowns"]),
      ]),
    },
    {
      id: "fabrics-2",
      unit: "fabrics",
      title: "Bold prints",
      questions: printLesson(PRINTS_B, [
        T("Tartan patterns are traditionally linked to Scottish clans.", true),
        C("The argyle diamond pattern comes from…", "Scotland", ["Italy", "Japan", "Morocco"], "It's based on the tartan of Clan Campbell of Argyll."),
        C("Which designer made leopard print a signature from the late 1940s?", "Christian Dior", ["Coco Chanel", "Giorgio Armani", "Jil Sander"], "Dior showed leopard print in his very first collection in 1947."),
      ]),
    },
    {
      id: "fabrics-3",
      unit: "fabrics",
      title: "Fibres",
      questions: [
        C("Linen is made from…", "Flax", ["Cotton", "Hemp seeds", "Bamboo"]),
        C("Silk is made from…", "Silkworm cocoons", ["Spider webs", "Cotton bolls", "Wood pulp"]),
        C("Cashmere comes from…", "Goats", ["Sheep", "Rabbits", "Alpacas"]),
        C("Mohair comes from the…", "Angora goat", ["Angora rabbit", "Merino sheep", "Llama"]),
        C("Angora wool comes from the…", "Angora rabbit", ["Angora goat", "Merino sheep", "Camel"]),
        C("Viscose is made from…", "Wood pulp", ["Petroleum", "Sheep's wool", "Silk"]),
        T("Polyester is a synthetic fibre made from petroleum.", true),
        T("Merino is a breed of goat.", false, "Merino is a breed of sheep known for very fine wool."),
        C("Which fibre is the most expensive in the world, from a South American animal?", "Vicuña", ["Mohair", "Alpaca", "Cashmere"]),
        P("Match the fibre to its source", [
          ["Linen", "Flax plant"],
          ["Silk", "Silkworm"],
          ["Cashmere", "Goat"],
          ["Wool", "Sheep"],
        ]),
      ],
    },
    {
      id: "fabrics-4",
      unit: "fabrics",
      title: "Weaves & fabrics",
      questions: [
        C("Denim is a sturdy cotton woven in a…", "Twill weave", ["Satin weave", "Plain weave", "Knit"], "The twill creates denim's diagonal lines."),
        C("The ridges of corduroy are called…", "Wales", ["Ribs", "Pleats", "Welts"]),
        C("A fabric with a glossy face and a dull back is…", "Satin", ["Tweed", "Jersey", "Linen"]),
        C("A rough woollen cloth from Scotland and Ireland is…", "Tweed", ["Chiffon", "Organza", "Poplin"]),
        C("A soft fabric with a short, dense cut pile is…", "Velvet", ["Organza", "Seersucker", "Poplin"]),
        C("A stretchy knitted fabric used for T-shirts is…", "Jersey", ["Twill", "Taffeta", "Tulle"]),
        C("A fabric made with looped yarn and a nubby surface is…", "Bouclé", ["Satin", "Chiffon", "Gabardine"], "Chanel's famous jackets are often made of bouclé tweed."),
        C("A puckered, striped cotton made for hot weather is…", "Seersucker", ["Velvet", "Tweed", "Flannel"]),
        T("Chiffon is thick and heavy.", false, "Chiffon is sheer, light and floaty."),
        T("Gabardine was invented by Thomas Burberry.", true, "He invented this water-resistant fabric in 1879."),
        P("Match fabric and description", [
          ["Organza", "Sheer and crisp"],
          ["Tulle", "Fine net"],
          ["Taffeta", "Stiff and rustling"],
          ["Flannel", "Soft and brushed"],
        ]),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 3. Anatomy of clothes
function glossary(title: string, id: string, terms: [string, string][], extra: Question[] = []): Lesson {
  const defs = terms.map(([, d]) => d);
  const names = terms.map(([t]) => t);
  const qs: Question[] = [];
  terms.slice(0, 6).forEach(([t, d], i) => qs.push(C(`What is ${/^[aeiou]/i.test(t) ? "an" : "a"} ${t.toLowerCase()}?`, d, others(defs, d, 3, i + 1))));
  terms.slice(6).forEach(([t, d], i) => qs.push(C(`“${d}”. What is it called?`, t, others(names, t, 3, i + 2))));
  qs.push(P("Match the term to its meaning", terms.slice(0, 4).map(([t, d]) => [t, d])));
  return { id, unit: id.split("-")[0], title, questions: [...qs, ...extra] };
}

const anatomy: Unit = {
  id: "anatomy",
  title: "Anatomy of clothes",
  blurb: "Collars, sleeves, silhouettes and how clothes are built",
  color: "#f2eee6",
  ink: "#0e0e0d",
  lessons: [
    glossary("Collars & necklines", "anatomy-1", [
      ["Notch lapel", "Lapel with a V-shaped cut where it meets the collar"],
      ["Peak lapel", "Lapel whose points sweep up towards the shoulders"],
      ["Shawl collar", "Rounded collar with no notch, typical of tuxedos"],
      ["Peter Pan collar", "Flat collar with rounded ends"],
      ["Mandarin collar", "Short stand-up collar that doesn't fold"],
      ["Boat neck", "Wide, shallow neckline running shoulder to shoulder"],
      ["Sweetheart neckline", "Neckline shaped like the top of a heart"],
      ["Cowl neck", "Neckline with soft draped folds"],
      ["Button-down collar", "Shirt collar whose points are buttoned to the shirt"],
    ]),
    glossary("Sleeves & cuffs", "anatomy-2", [
      ["Raglan sleeve", "Sleeve that runs in one piece up to the collar, with a diagonal seam"],
      ["Puff sleeve", "Sleeve gathered at the shoulder for volume"],
      ["Bishop sleeve", "Full sleeve gathered into a cuff at the wrist"],
      ["Cap sleeve", "Very short sleeve that covers only the shoulder"],
      ["Bell sleeve", "Sleeve that flares wide towards the wrist"],
      ["Batwing sleeve", "Sleeve with a very deep armhole cut in one with the bodice"],
      ["French cuff", "Double-length cuff folded back and closed with cufflinks"],
      ["Leg-of-mutton sleeve", "Sleeve puffed at the shoulder and tight from the elbow"],
    ]),
    glossary(
      "Silhouettes",
      "anatomy-3",
      [
        ["A-line", "Fitted at the top, widening gradually towards the hem"],
        ["Empire waist", "Waistline raised to just below the bust"],
        ["Drop waist", "Waistline lowered to the hips"],
        ["Sheath", "Close-fitting straight dress without a waist seam"],
        ["Shift", "Straight, loose dress hanging from the shoulders"],
        ["Bias cut", "Fabric cut diagonally to the grain so it drapes and clings"],
        ["Peplum", "Short flared strip of fabric at the waist of a top"],
        ["Mermaid", "Fitted to the knee, then flaring out"],
        ["Trapeze", "Dress flaring dramatically from the shoulders"],
      ],
      [
        C("Who is credited with making the A-line famous in 1955?", "Christian Dior", ["Coco Chanel", "Yves Saint Laurent", "Paul Poiret"]),
        C("Which designer is known as the 'queen of the bias cut'?", "Madeleine Vionnet", ["Elsa Schiaparelli", "Jeanne Lanvin", "Coco Chanel"]),
      ],
    ),
    glossary("How clothes are built", "anatomy-4", [
      ["Yoke", "Shaped panel across the shoulders or hips"],
      ["Dart", "Tapered fold stitched to shape fabric to the body"],
      ["Placket", "Strip of fabric that holds buttons or a zip"],
      ["Hem", "Folded, finished bottom edge of a garment"],
      ["Selvedge", "Self-finished edge of woven fabric that doesn't fray"],
      ["Vent", "Slit at the back hem of a jacket"],
      ["Welt pocket", "Pocket with a narrow finished slit sewn into the garment"],
      ["Rise", "Distance from the crotch seam to the waistband"],
      ["Gusset", "Extra piece of fabric inserted for fit and movement"],
      ["Toile", "Prototype of a garment made in cheap cotton muslin"],
    ]),
  ],
};

// ---------------------------------------------------------------- 4. History
const history: Unit = {
  id: "history",
  title: "Fashion history",
  blurb: "From the corset to quiet luxury",
  color: "#8a6552",
  ink: "#f2eee6",
  lessons: [
    {
      id: "history-1",
      unit: "history",
      title: "1850 – 1939",
      questions: [
        C("Who is considered the father of haute couture?", "Charles Frederick Worth", ["Paul Poiret", "Christian Dior", "Cristóbal Balenciaga"], "An Englishman in Paris, he was the first to sew his name into garments, in 1858."),
        C("Which designer freed women from the corset around 1906–1910?", "Paul Poiret", ["Charles Worth", "Jeanne Lanvin", "Christian Dior"]),
        C("The 1920s 'flapper' dress had a…", "Drop waist and knee-length hem", ["Cinched waist and full skirt", "Empire waist and train", "Corset and bustle"]),
        C("In 1926 Vogue called which dress 'the Ford' of fashion?", "Chanel's little black dress", ["Dior's Bar jacket", "Vionnet's bias gown", "Poiret's hobble skirt"]),
        C("Which designer invented 'shocking pink' in 1937?", "Elsa Schiaparelli", ["Coco Chanel", "Madeleine Vionnet", "Jeanne Lanvin"]),
        C("Schiaparelli's 1937 lobster dress was made with which artist?", "Salvador Dalí", ["Pablo Picasso", "Andy Warhol", "Henri Matisse"]),
        T("Levi Strauss and Jacob Davis patented riveted jeans in 1873.", true),
        T("Nylon stockings first went on sale in the 1960s.", false, "They went on sale in 1940 and caused queues across the US."),
        O("Put these in chronological order", ["Worth sews his name into garments", "Poiret drops the corset", "Chanel's little black dress", "Schiaparelli's shocking pink"]),
      ],
    },
    {
      id: "history-2",
      unit: "history",
      title: "1940 – 1969",
      questions: [
        C("Christian Dior's 1947 debut was nicknamed…", "The New Look", ["The Space Age", "Le Smoking", "The Sack"], "The name came from Carmel Snow, editor of Harper's Bazaar."),
        C("The New Look silhouette was defined by…", "A cinched waist and a full skirt", ["A drop waist", "Shoulder pads and a pencil skirt", "A straight shift"]),
        C("In which year was the bikini introduced?", "1946", ["1926", "1958", "1965"], "Presented by Louis Réard in Paris."),
        C("Cristóbal Balenciaga introduced the 'sack dress' in…", "1957", ["1937", "1947", "1967"]),
        C("In which year did Coco Chanel reopen her house after the war?", "1954", ["1946", "1960", "1939"]),
        C("Who is most credited with popularising the mini skirt in 1960s London?", "Mary Quant", ["Vivienne Westwood", "Twiggy", "Ossie Clark"]),
        C("André Courrèges's 1964 collection launched the…", "Space Age look", ["New Look", "Hippie look", "Punk look"]),
        C("What was Yves Saint Laurent's 1966 tuxedo for women called?", "Le Smoking", ["Le Tailleur", "La Robe Noire", "Le Trench"]),
        T("Paco Rabanne presented '12 unwearable dresses' made of metal and plastic in 1966.", true),
        O("Put these in chronological order", ["Dior's New Look", "Balenciaga's sack dress", "Courrèges's Space Age", "YSL's Le Smoking"]),
      ],
    },
    {
      id: "history-3",
      unit: "history",
      title: "1970 – 1999",
      questions: [
        C("Diane von Furstenberg launched her iconic wrap dress in…", "1974", ["1964", "1984", "1994"]),
        C("Which duo put punk into fashion from their London shop SEX?", "Vivienne Westwood & Malcolm McLaren", ["Dolce & Gabbana", "Viktor & Rolf", "Ossie Clark & Celia Birtwell"]),
        C("In 1981 two Japanese designers shocked Paris with black, deconstructed clothes. Who?", "Rei Kawakubo & Yohji Yamamoto", ["Issey Miyake & Kenzo Takada", "Junya Watanabe & Chitose Abe", "Hanae Mori & Kansai Yamamoto"]),
        C("1980s 'power dressing' was defined by…", "Big shoulder pads", ["Drop waists", "Crinolines", "Low-rise trousers"]),
        C("Which designer showed a 'grunge' collection for Perry Ellis in 1992?", "Marc Jacobs", ["Tom Ford", "Calvin Klein", "Helmut Lang"]),
        C("The 1990s 'heroin chic' look is most associated with which model?", "Kate Moss", ["Naomi Campbell", "Cindy Crawford", "Claudia Schiffer"]),
        C("Which designer made 'bumster' trousers in the early 1990s?", "Alexander McQueen", ["John Galliano", "Jean Paul Gaultier", "Thierry Mugler"]),
        C("Who was the first designer to show a collection online, in 1998?", "Helmut Lang", ["Tom Ford", "Jil Sander", "Martin Margiela"]),
        T("1990s minimalism was led by designers like Jil Sander, Helmut Lang and Calvin Klein.", true),
        O("Put these in chronological order", ["Wrap dress", "Kawakubo & Yamamoto in Paris", "Grunge for Perry Ellis", "First online show"]),
      ],
    },
    {
      id: "history-4",
      unit: "history",
      title: "2000 – today",
      questions: [
        C("Low-rise jeans, velour tracksuits and baby tees belong to…", "Y2K style", ["Normcore", "Quiet luxury", "Indie sleaze"]),
        C("The term 'normcore' was coined in…", "2013", ["2003", "2008", "2019"], "By the trend agency K-Hole."),
        C("Wearing sportswear as everyday fashion is called…", "Athleisure", ["Gorpcore", "Streetwear", "Tenniscore"]),
        C("Logo-free, expensive basics in neutral colours are called…", "Quiet luxury", ["Logomania", "Maximalism", "Dopamine dressing"]),
        C("Which platform drove the '-core' micro-trends of the 2020s?", "TikTok", ["MySpace", "Tumblr", "Pinterest"]),
        C("Buying and selling second-hand clothes online is part of the…", "Resale boom", ["Fast fashion", "Haute couture", "Bespoke tailoring"]),
        T("'See now, buy now' means selling a collection right after the show.", true),
        T("Virgil Abloh was the first Black artistic director of Louis Vuitton menswear.", true, "He took the role in 2018."),
        O("Put these in chronological order", ["Y2K", "Normcore", "Quiet luxury"]),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 5. Paris
const paris: Unit = {
  id: "paris",
  title: "The Paris maisons",
  blurb: "Chanel, Dior, Saint Laurent, Hermès and the houses that made Paris",
  color: "#1b1a19",
  ink: "#d4ad55",
  lessons: [
    {
      id: "paris-1",
      unit: "paris",
      title: "Chanel & Dior",
      questions: [
        C("What was Gabrielle Chanel's nickname?", "Coco", ["Mimi", "Lulu", "Gigi"]),
        C("In which year was the Chanel 2.55 bag introduced?", "1955", ["1925", "1947", "1971"], "The name is the date: February 1955."),
        C("Chanel N°5 perfume was launched in…", "1921", ["1945", "1911", "1960"]),
        C("Chanel's historic address in Paris is…", "31 rue Cambon", ["30 avenue Montaigne", "24 rue du Faubourg Saint-Honoré", "5 avenue Marceau"]),
        C("Which flower is Chanel's emblem?", "The camellia", ["The rose", "Lily of the valley", "The peony"]),
        C("Christian Dior's house is at…", "30 avenue Montaigne", ["31 rue Cambon", "Place Vendôme", "Rue de la Paix"]),
        C("Dior's lucky flower was…", "Lily of the valley", ["The camellia", "The tulip", "The orchid"]),
        C("The Lady Dior bag was named after…", "Princess Diana", ["Grace Kelly", "Jackie Kennedy", "Audrey Hepburn"]),
        C("Who designed Dior's Saddle bag at the end of the 1990s?", "John Galliano", ["Raf Simons", "Hedi Slimane", "Maria Grazia Chiuri"]),
        T("Chanel's two-tone beige-and-black slingback dates from 1957.", true),
        T("Christian Dior opened his house in 1946 and showed the New Look in 1947.", true),
        P("Match the icon to its house", [
          ["2.55 bag", "Chanel"],
          ["Bar jacket", "Dior"],
          ["N°5", "Chanel"],
          ["Lady Dior", "Dior"],
        ]),
      ],
    },
    {
      id: "paris-2",
      unit: "paris",
      title: "Saint Laurent, Givenchy, Balenciaga",
      questions: [
        C("Yves Saint Laurent founded his house in 1961 with…", "Pierre Bergé", ["Pierre Cardin", "Hubert de Givenchy", "Karl Lagerfeld"]),
        C("YSL's 1965 dress inspired by a Dutch painter is the…", "Mondrian dress", ["Picasso dress", "Van Gogh dress", "Klimt dress"]),
        C("YSL's first ready-to-wear line, 1966, was called…", "Rive Gauche", ["Rive Droite", "Le Smoking", "Prêt-à-Paris"]),
        C("Which actress was Hubert de Givenchy's muse?", "Audrey Hepburn", ["Grace Kelly", "Brigitte Bardot", "Catherine Deneuve"]),
        C("Givenchy dressed Audrey Hepburn in the black dress of which film?", "Breakfast at Tiffany's", ["Roman Holiday", "Sabrina", "My Fair Lady"]),
        C("Cristóbal Balenciaga was born in…", "Spain", ["France", "Italy", "Argentina"]),
        C("Which designer called Balenciaga 'the master of us all'?", "Christian Dior", ["Coco Chanel", "Yves Saint Laurent", "Hubert de Givenchy"]),
        C("Balmain has been led since 2011 by…", "Olivier Rousteing", ["Demna", "Anthony Vaccarello", "Nicolas Ghesquière"]),
        T("Pierre Balmain founded his house in Paris in 1945.", true),
        P("Match designer and house", [
          ["Hubert de Givenchy", "Givenchy"],
          ["Cristóbal Balenciaga", "Balenciaga"],
          ["Pierre Balmain", "Balmain"],
          ["Yves Saint Laurent", "Saint Laurent"],
        ]),
      ],
    },
    {
      id: "paris-3",
      unit: "paris",
      title: "Hermès, Louis Vuitton & the old houses",
      questions: [
        C("Hermès started in 1837 as a…", "Harness workshop", ["Hat shop", "Perfumery", "Tailor"]),
        C("The Hermès Kelly bag is named after…", "Grace Kelly", ["Gene Kelly", "Kelly Brook", "Kelly Clarkson"]),
        C("The Birkin bag was created in 1984 for…", "Jane Birkin", ["Grace Kelly", "Charlotte Rampling", "Brigitte Bardot"]),
        C("Hermès's famous silk scarf is called a…", "Carré", ["Foulard", "Twilly", "Bandeau"], "The first one appeared in 1937."),
        C("What colour is the Hermès box?", "Orange", ["Tiffany blue", "Black", "Red"]),
        C("Louis Vuitton started in 1854 as a…", "Trunk maker", ["Shoemaker", "Jeweller", "Tailor"]),
        C("The LV Monogram canvas was created in 1896 by…", "Georges Vuitton", ["Louis Vuitton", "Marc Jacobs", "Gaston-Louis Vuitton"]),
        C("Which is the oldest French couture house still operating?", "Lanvin", ["Chanel", "Dior", "Balmain"], "Founded by Jeanne Lanvin in 1889."),
        C("Goyard is famous for its…", "Chevron canvas", ["Quilted leather", "Intrecciato weave", "Bamboo handle"]),
        T("Chloé was founded in Paris in 1952 by Gaby Aghion.", true),
        P("Match the bag to its house", [
          ["Kelly", "Hermès"],
          ["Speedy", "Louis Vuitton"],
          ["Paddington", "Chloé"],
          ["Saint Louis tote", "Goyard"],
        ]),
      ],
    },
    {
      id: "paris-4",
      unit: "paris",
      title: "The rebels of Paris",
      questions: [
        C("Which designer created Madonna's cone bra in 1990?", "Jean Paul Gaultier", ["Thierry Mugler", "Karl Lagerfeld", "Gianni Versace"]),
        C("Jean Paul Gaultier's signature top is the…", "Marinière (Breton stripe)", ["Tuxedo shirt", "Corset top", "Polo shirt"]),
        C("Thierry Mugler was famous for…", "Sculpted power shoulders and cyborg glamour", ["Minimal white shirts", "Tweed suits", "Hippie maxi dresses"]),
        C("Martin Margiela's split-toe boot is called…", "Tabi", ["Chelsea", "Jodhpur", "Derby"]),
        C("Maison Margiela labels are…", "Blank white with four white stitches", ["Gold with a logo", "Red with a number", "Black leather patches"]),
        C("Elsa Schiaparelli's style was inspired by…", "Surrealism", ["Minimalism", "Punk", "Art Nouveau"]),
        C("Simon Porte Jacquemus is known for…", "The tiny 'Le Chiquito' bag", ["The Tabi boot", "The 2.55 bag", "The Kelly bag"]),
        C("Pierre Cardin was a pioneer of…", "Licensing his name on products", ["Online shows", "Sustainable fashion", "Streetwear"]),
        T("Martin Margiela almost never appeared in photos or interviews.", true),
        T("Jacquemus showed a collection in a lavender field in Provence in 2019.", true),
        P("Match the designer and the signature", [
          ["Gaultier", "Cone bra"],
          ["Margiela", "Tabi boots"],
          ["Schiaparelli", "Shocking pink"],
          ["Jacquemus", "Le Chiquito"],
        ]),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 6. Italy
const italy: Unit = {
  id: "italy",
  title: "The Italian maisons",
  blurb: "Milan, Florence and Rome: Gucci, Prada, Versace, Armani and more",
  color: "#0e6a4d",
  ink: "#f2eee6",
  lessons: [
    {
      id: "italy-1",
      unit: "italy",
      title: "Gucci & Prada",
      questions: [
        C("Gucci was founded in 1921 in…", "Florence", ["Milan", "Rome", "Venice"]),
        C("Gucci's 1953 loafer is famous for its…", "Horsebit", ["Tassel", "Penny strap", "Buckle"]),
        C("The Gucci Bamboo bag dates from…", "1947", ["1921", "1966", "1994"]),
        C("Gucci's green-red-green stripe is called the…", "Web stripe", ["Tricolore", "Racing stripe", "Flora"]),
        C("The Gucci Flora print was created in 1966 for…", "Grace Kelly", ["Jackie Kennedy", "Sophia Loren", "Audrey Hepburn"]),
        C("Prada was founded in 1913 in…", "Milan", ["Florence", "Rome", "Turin"]),
        C("Miuccia Prada's 1984 breakthrough was a backpack in…", "Black nylon", ["Canvas", "Python", "Straw"]),
        C("Miu Miu takes its name from…", "Miuccia Prada's nickname", ["A cat", "A city", "A perfume"]),
        C("Prada's original shop is in Milan's…", "Galleria Vittorio Emanuele II", ["Via Montenapoleone", "Brera", "Piazza Duomo"]),
        T("Tom Ford relaunched Gucci as a sexy, glamorous brand in the 1990s.", true),
        P("Match icon and house", [
          ["Horsebit loafer", "Gucci"],
          ["Nylon backpack", "Prada"],
          ["Bamboo bag", "Gucci"],
          ["Triangle logo", "Prada"],
        ]),
      ],
    },
    {
      id: "italy-2",
      unit: "italy",
      title: "Versace, Armani, Dolce & Gabbana",
      questions: [
        C("What is the Versace logo?", "The head of Medusa", ["A lion", "A horse", "A snake"]),
        C("Gianni Versace founded his house in…", "1978", ["1958", "1988", "1998"]),
        C("The Versace 'safety pin' dress was worn in 1994 by…", "Elizabeth Hurley", ["Naomi Campbell", "Madonna", "Princess Diana"]),
        C("Giorgio Armani revolutionised the jacket by making it…", "Soft and unstructured", ["Stiff and padded", "Cropped and boxy", "Made of latex"]),
        C("Which 1980 film made Armani famous in the US?", "American Gigolo", ["Wall Street", "Scarface", "Top Gun"]),
        C("Dolce & Gabbana's style is rooted in…", "Sicily", ["Tuscany", "Lombardy", "Sardinia"]),
        C("Franco Moschino was known for…", "Irony and humour in fashion", ["Strict minimalism", "Technical outerwear", "Bridal gowns"]),
        C("Roberto Cavalli became famous for…", "Animal prints and sandblasted denim", ["Knitwear zigzags", "Tailored greige suits", "Tweed"]),
        T("Donatella Versace took over the house after Gianni's death in 1997.", true),
        T("Armani's signature neutral is a mix of grey and beige nicknamed 'greige'.", true),
        P("Match the designer to the city", [
          ["Versace", "Milan"],
          ["Valentino", "Rome"],
          ["Gucci", "Florence"],
          ["Bottega Veneta", "Vicenza"],
        ]),
      ],
    },
    {
      id: "italy-3",
      unit: "italy",
      title: "Fendi, Valentino, Bottega Veneta",
      questions: [
        C("Fendi was founded in 1925 in…", "Rome", ["Milan", "Naples", "Florence"]),
        C("Who designed for Fendi from 1965 until 2019?", "Karl Lagerfeld", ["Tom Ford", "Gianni Versace", "Marc Jacobs"]),
        C("The Fendi Baguette (1997) was created by…", "Silvia Venturini Fendi", ["Karl Lagerfeld", "Kim Jones", "Miuccia Prada"]),
        C("Valentino is famous for its own shade of…", "Red", ["Pink", "Blue", "Green"]),
        C("Valentino's studded shoes and bags line is called…", "Rockstud", ["Clou", "Punk", "Stud Up"]),
        C("Bottega Veneta's woven leather technique is called…", "Intrecciato", ["Quilting", "Monogram", "Chevron"]),
        C("Bottega Veneta's historic slogan was 'When your own … are enough'", "initials", ["logos", "names", "bags"]),
        C("Loro Piana is most famous for…", "Vicuña and cashmere", ["Sneakers", "Swimwear", "Denim"]),
        C("Brunello Cucinelli's company is based in the village of…", "Solomeo", ["Portofino", "Capri", "Cortina"]),
        T("Loro Piana and Brunello Cucinelli are symbols of 'quiet luxury'.", true),
      ],
    },
    {
      id: "italy-4",
      unit: "italy",
      title: "Heritage of Made in Italy",
      questions: [
        C("Salvatore Ferragamo was nicknamed the…", "Shoemaker to the stars", ["King of knitwear", "Prince of prints", "Master of tailoring"]),
        C("Ferragamo is credited with inventing the…", "Wedge heel", ["Stiletto", "Loafer", "Platform sneaker"], "Created in the 1930s, when steel was scarce."),
        C("Missoni is famous for…", "Zigzag knitwear", ["Animal prints", "Denim", "Leather jackets"]),
        C("Emilio Pucci is known for…", "Psychedelic, colourful prints", ["Black minimalism", "Tweed suits", "Military coats"]),
        C("Max Mara's iconic coat is the…", "101801 camel coat", ["Trench 1856", "Peacoat 1947", "Duffle 1890"]),
        C("Max Mara is based in…", "Reggio Emilia", ["Milan", "Florence", "Naples"]),
        C("Etro is best known for…", "Paisley", ["Houndstooth", "Polka dots", "Camouflage"]),
        C("The most famous luxury shopping street in Milan is…", "Via Montenapoleone", ["Via del Corso", "Via Toledo", "Via Condotti"]),
        C("Rome's luxury shopping street at the foot of the Spanish Steps is…", "Via Condotti", ["Via Montenapoleone", "Via Tornabuoni", "Via Roma"]),
        T("Pitti Uomo, the big menswear fair, takes place in Florence.", true),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 7. London, New York, Tokyo, Antwerp
const world: Unit = {
  id: "world",
  title: "London, New York, Tokyo, Antwerp",
  blurb: "The houses and schools beyond Paris and Milan",
  color: "#1f3fa3",
  ink: "#f2eee6",
  lessons: [
    {
      id: "world-1",
      unit: "world",
      title: "London",
      questions: [
        C("Burberry was founded in 1856 by…", "Thomas Burberry", ["Christopher Bailey", "Charles Worth", "Alfred Dunhill"]),
        C("Burberry's most iconic garment is the…", "Trench coat", ["Kilt", "Blazer", "Duffle coat"], "Designed for officers in the First World War trenches."),
        C("Alexander McQueen trained as a tailor on…", "Savile Row", ["Carnaby Street", "Bond Street", "King's Road"]),
        C("Who discovered McQueen and bought his entire graduate collection in 1992?", "Isabella Blow", ["Anna Wintour", "Diana Vreeland", "Grace Coddington"]),
        C("McQueen's famous scarf pattern features…", "Skulls", ["Roses", "Snakes", "Stars"]),
        C("Vivienne Westwood's logo is an…", "Orb with a ring", ["Anchor", "Crown", "Lion"]),
        C("Which London school did McQueen, Galliano and Stella McCartney attend?", "Central Saint Martins", ["Royal College of Art", "Parsons", "Istituto Marangoni"]),
        C("Stella McCartney is known for never using…", "Leather and fur", ["Cotton", "Silk", "Denim"]),
        T("Naomi Campbell fell on Vivienne Westwood's super-high platforms on the runway in 1993.", true),
        P("Match the designer and signature", [
          ["Burberry", "Trench coat"],
          ["McQueen", "Bumsters"],
          ["Westwood", "Punk tartan"],
          ["Stella McCartney", "No leather"],
        ]),
      ],
    },
    {
      id: "world-2",
      unit: "world",
      title: "New York",
      questions: [
        C("Ralph Lauren started his company in 1967 selling…", "Ties", ["Polo shirts", "Jeans", "Perfume"]),
        C("Calvin Klein's minimalism became famous through ads with Kate Moss and…", "Mark Wahlberg", ["Brad Pitt", "Leonardo DiCaprio", "Johnny Depp"]),
        C("Donna Karan's 1985 capsule wardrobe was called…", "Seven Easy Pieces", ["The Basics", "Five Essentials", "The Uniform"]),
        C("Halston was the star designer of which 1970s nightclub?", "Studio 54", ["The Factory", "CBGB", "Paradise Garage"]),
        C("Halston designed the pillbox hat worn in 1961 by…", "Jackie Kennedy", ["Grace Kelly", "Marilyn Monroe", "Audrey Hepburn"]),
        C("Carolina Herrera's signature piece is the…", "Crisp white shirt", ["Wrap dress", "Cardigan", "Trench"]),
        C("Claire McCardell is considered the mother of…", "American sportswear", ["Haute couture", "Punk", "Streetwear"]),
        C("New York's big fashion school is…", "Parsons", ["Central Saint Martins", "La Cambre", "Bunka"]),
        T("New York Fashion Week opens the international fashion month.", true),
      ],
    },
    {
      id: "world-3",
      unit: "world",
      title: "Tokyo",
      questions: [
        C("Rei Kawakubo's label is called…", "Comme des Garçons", ["Undercover", "Sacai", "Kenzo"]),
        C("Comme des Garçons's Spring 1997 collection with padded bumps is known as…", "Lumps and Bumps", ["Hiroshima Chic", "Pleats Please", "Dover Street"], "Its official title was 'Body Meets Dress, Dress Meets Body'."),
        C("Yohji Yamamoto is known for…", "Oversized black clothes", ["Neon colours", "Denim", "Logo sweatshirts"]),
        C("Issey Miyake's permanently pleated line is called…", "Pleats Please", ["Plissé Paris", "Fold Me", "Pleat Lab"]),
        C("Kawakubo's multi-brand store concept, opened in London in 2004, is…", "Dover Street Market", ["Colette", "10 Corso Como", "Selfridges"]),
        C("Yohji Yamamoto's sports line with Adidas is…", "Y-3", ["Y-Project", "Y/Project", "3-Y"]),
        T("Critics called the Japanese designers' 1981 Paris debut 'Hiroshima chic'.", true),
      ],
    },
    {
      id: "world-4",
      unit: "world",
      title: "Antwerp & Belgium",
      questions: [
        C("The 'Antwerp Six' studied at the…", "Royal Academy of Fine Arts Antwerp", ["La Cambre", "Central Saint Martins", "Parsons"]),
        C("Which of these designers is one of the Antwerp Six?", "Dries Van Noten", ["Raf Simons", "Martin Margiela", "Demna"]),
        C("Which of these is one of the Antwerp Six?", "Ann Demeulemeester", ["Veronique Branquinho", "Diane von Furstenberg", "Phoebe Philo"]),
        C("Dries Van Noten is known for…", "Rich prints and colour mixes", ["All-black minimalism", "Logo sneakers", "Bridal wear"]),
        C("Raf Simons, a Belgian designer, was creative director of Dior from…", "2012 to 2015", ["1996 to 2011", "2016 to 2020", "2004 to 2008"]),
        C("Martin Margiela, a Belgian, founded his house in Paris in…", "1988", ["1968", "1998", "2008"]),
        T("The Antwerp Six got their name because the British press couldn't pronounce their names.", true),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 8. Creative directors
const directors: Unit = {
  id: "directors",
  title: "Creative directors",
  blurb: "Who designed for whom: fashion's musical chairs",
  color: "#b0141c",
  ink: "#f2eee6",
  lessons: [
    {
      id: "directors-1",
      unit: "directors",
      title: "The legends",
      questions: [
        C("Karl Lagerfeld was creative director of Chanel from 1983 until…", "2019", ["2009", "1999", "2015"]),
        C("Tom Ford led Gucci from 1994 to…", "2004", ["1999", "2010", "2015"]),
        C("John Galliano was creative director of Dior from 1996 to…", "2011", ["2001", "2006", "2016"]),
        C("Alexander McQueen was creative director of which French house (1996–2001)?", "Givenchy", ["Dior", "Balenciaga", "Lanvin"]),
        C("Marc Jacobs was creative director of Louis Vuitton from…", "1997 to 2013", ["2001 to 2011", "1990 to 2000", "2013 to 2018"]),
        C("Tom Ford also designed for which house from 1999 to 2004?", "Yves Saint Laurent", ["Chanel", "Givenchy", "Balmain"]),
        C("Alber Elbaz is remembered for his years at…", "Lanvin", ["Chloé", "Céline", "Balmain"]),
        T("Karl Lagerfeld designed for Chanel, Fendi and Chloé.", true),
        P("Match the designer and the house", [
          ["Karl Lagerfeld", "Chanel"],
          ["Tom Ford", "Gucci"],
          ["John Galliano", "Dior"],
          ["Marc Jacobs", "Louis Vuitton"],
        ]),
      ],
    },
    {
      id: "directors-2",
      unit: "directors",
      title: "The 2000s & 2010s",
      questions: [
        C("Phoebe Philo is most famous for her decade at…", "Céline", ["Chloé", "Givenchy", "Loewe"]),
        C("Hedi Slimane renamed Yves Saint Laurent to…", "Saint Laurent", ["YSL Paris", "Laurent", "Saint Laurent Rive Gauche"]),
        C("Nicolas Ghesquière led Balenciaga from 1997 to 2012, then moved to…", "Louis Vuitton", ["Dior", "Chanel", "Céline"]),
        C("Riccardo Tisci led Givenchy from 2005 to 2017, then moved to…", "Burberry", ["Versace", "Chanel", "Prada"]),
        C("Christopher Bailey was creative director of…", "Burberry", ["Bottega Veneta", "Mulberry", "Alexander McQueen"]),
        C("Who led Alexander McQueen after his death, from 2010 to 2023?", "Sarah Burton", ["Stella McCartney", "Phoebe Philo", "Clare Waight Keller"]),
        C("Alessandro Michele brought maximalism to which house in 2015?", "Gucci", ["Prada", "Versace", "Fendi"]),
        C("Who was the first woman to become artistic director of Dior, in 2016?", "Maria Grazia Chiuri", ["Sarah Burton", "Phoebe Philo", "Virginie Viard"]),
        C("Who was the first woman artistic director of Givenchy, in 2017?", "Clare Waight Keller", ["Sarah Burton", "Stella McCartney", "Maria Grazia Chiuri"]),
        C("Jonathan Anderson created the Puzzle bag at…", "Loewe", ["Céline", "Chloé", "Mulberry"]),
        P("Match the designer and the house", [
          ["Phoebe Philo", "Céline"],
          ["Alessandro Michele", "Gucci"],
          ["Nicolas Ghesquière", "Balenciaga"],
          ["Sarah Burton", "Alexander McQueen"],
        ]),
      ],
    },
    {
      id: "directors-3",
      unit: "directors",
      title: "The new generation",
      questions: [
        C("Virgil Abloh founded which label in Milan?", "Off-White", ["Supreme", "Palace", "Fear of God"]),
        C("Off-White's graphic signature is…", "Words in quotation marks", ["A red sole", "A skull", "A snake"]),
        C("Demna became famous for oversized, ironic streetwear at…", "Balenciaga", ["Givenchy", "Kenzo", "Moschino"]),
        C("Daniel Lee made the 'Bottega green' famous at…", "Bottega Veneta", ["Burberry", "Gucci", "Celine"]),
        C("Anthony Vaccarello has led which house since 2016?", "Saint Laurent", ["Balmain", "Versace", "Lanvin"]),
        C("Kim Jones was artistic director of menswear at…", "Dior", ["Hermès", "Prada", "Celine"]),
        C("Pierpaolo Piccioli is known for romantic couture at…", "Valentino", ["Dior", "Givenchy", "Fendi"]),
        C("Olivier Rousteing became the head of Balmain at the age of…", "25", ["35", "19", "42"]),
        T("Raf Simons became co-creative director of Prada with Miuccia Prada in 2020.", true),
        P("Match the designer and the house", [
          ["Virgil Abloh", "Louis Vuitton menswear"],
          ["Demna", "Balenciaga"],
          ["Anthony Vaccarello", "Saint Laurent"],
          ["Kim Jones", "Dior Men"],
        ]),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 9. Icons: bags, shoes, jewels
const icons: Unit = {
  id: "icons",
  title: "Bags, shoes & jewels",
  blurb: "The objects everyone recognises",
  color: "#d4ad55",
  ink: "#0e0e0d",
  lessons: [
    {
      id: "icons-1",
      unit: "icons",
      title: "It-bags",
      questions: [
        C("Which house makes the Birkin?", "Hermès", ["Chanel", "Louis Vuitton", "Dior"]),
        C("Which house makes the 2.55?", "Chanel", ["Hermès", "Fendi", "Gucci"]),
        C("Which house makes the Baguette?", "Fendi", ["Prada", "Dior", "Celine"]),
        C("Which house makes the Speedy and the Neverfull?", "Louis Vuitton", ["Goyard", "Hermès", "Chanel"]),
        C("Which house makes the Puzzle bag?", "Loewe", ["Bottega Veneta", "Balenciaga", "Chloé"]),
        C("Which house makes the Jodie and the Cassette?", "Bottega Veneta", ["Loewe", "Prada", "Gucci"]),
        C("The Balenciaga City bag is better known as the…", "Motorcycle bag", ["Hobo", "Bowling bag", "Saddle"]),
        C("The Mulberry bag named after Alexa Chung is the…", "Alexa", ["Bayswater", "Roxanne", "Lily"]),
        T("The Birkin was sketched on an airline sick bag during a flight.", true, "Jane Birkin and Hermès's Jean-Louis Dumas met on a flight in 1983."),
        P("Match the bag to its house", [
          ["Birkin", "Hermès"],
          ["Baguette", "Fendi"],
          ["Lady Dior", "Dior"],
          ["Puzzle", "Loewe"],
        ]),
      ],
    },
    {
      id: "icons-2",
      unit: "icons",
      title: "Legendary shoes",
      questions: [
        C("Which designer is known for red soles?", "Christian Louboutin", ["Manolo Blahnik", "Jimmy Choo", "Roger Vivier"]),
        C("Carrie Bradshaw's favourite shoe designer in Sex and the City was…", "Manolo Blahnik", ["Jimmy Choo", "Christian Louboutin", "Salvatore Ferragamo"]),
        C("Which designer is credited with the modern stiletto heel in the 1950s?", "Roger Vivier", ["Christian Louboutin", "Manolo Blahnik", "Charles Jourdan"]),
        C("Roger Vivier's signature shoe has a…", "Square metal buckle", ["Red sole", "Horsebit", "Bow"]),
        C("Ferragamo's low-heeled pump with a grosgrain bow is the…", "Vara", ["Hangisi", "So Kate", "Belle"]),
        C("Manolo Blahnik's jewelled satin pump is the…", "Hangisi", ["Vara", "Pigalle", "Belle Vivier"]),
        C("Christian Louboutin's classic pointed pump is the…", "Pigalle", ["Hangisi", "Vara", "Tabi"]),
        C("Chanel's two-tone shoe is a…", "Slingback", ["Mule", "Loafer", "Wedge"]),
        T("Christian Louboutin got the red sole idea from an assistant's red nail polish.", true),
        P("Match the shoe to the designer", [
          ["Pigalle", "Louboutin"],
          ["Hangisi", "Manolo Blahnik"],
          ["Vara", "Ferragamo"],
          ["Tabi", "Margiela"],
        ]),
      ],
    },
    {
      id: "icons-3",
      unit: "icons",
      title: "Jewellery houses",
      questions: [
        C("Cartier's Love bracelet (1969) is closed with…", "A small screwdriver", ["A magnet", "A clasp", "A key"]),
        C("Cartier's Tank watch (1917) was inspired by…", "Military tanks", ["Fish tanks", "Water towers", "Train cars"]),
        C("Van Cleef & Arpels's four-leaf clover motif is called…", "Alhambra", ["Trinity", "Juste un Clou", "Serpenti"]),
        C("Bulgari's snake-shaped jewellery line is…", "Serpenti", ["Alhambra", "B.zero1", "Panthère"]),
        C("Bulgari was founded in…", "Rome", ["Paris", "Milan", "Geneva"]),
        C("Tiffany & Co.'s famous box is…", "Robin's-egg blue", ["Orange", "Red", "Black"]),
        C("Cartier's emblematic animal is the…", "Panther", ["Snake", "Lion", "Swan"]),
        T("Place Vendôme in Paris is home to many of the great jewellery houses.", true),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 10. Runway legends
const runway: Unit = {
  id: "runway",
  title: "Runway legends",
  blurb: "The shows everyone still talks about",
  color: "#262523",
  ink: "#f2eee6",
  lessons: [
    {
      id: "runway-1",
      unit: "runway",
      title: "Shows that made history",
      questions: [
        C("In McQueen's 1999 show 'No. 13', a dress was spray-painted live by…", "Robots", ["Graffiti artists", "The audience", "Drones"]),
        C("McQueen's 'Plato's Atlantis' (Spring 2010) was the first big show…", "Streamed live online", ["Shown underwater", "Shown in 3D", "Without models"]),
        C("In McQueen's 'VOSS' show (2001), the audience watched models inside a…", "Mirrored glass box", ["Cage", "Swimming pool", "Tunnel"]),
        C("In 2000, Hussein Chalayan turned what into clothes on the runway?", "Furniture", ["Umbrellas", "Paper", "Car parts"]),
        C("In 2022, Coperni made a dress on Bella Hadid by…", "Spraying it on live", ["Knitting it live", "3D-printing it", "Gluing flowers"]),
        C("Versace's Autumn 1991 finale had supermodels lip-syncing to…", "George Michael's 'Freedom! '90'", ["Madonna's 'Vogue'", "Prince's 'Cream'", "Queen's 'I Want to Break Free'"]),
        C("Martin Margiela's 1989 show took place in…", "A children's playground", ["A metro station", "An airport", "A church"]),
        T("Rick Owens's Spring 2014 show featured US step-dance teams instead of models.", true),
        T("Balenciaga's Spring 2023 show had a runway covered in mud.", true),
      ],
    },
    {
      id: "runway-2",
      unit: "runway",
      title: "Chanel & the Grand Palais",
      questions: [
        C("Karl Lagerfeld's Chanel shows were famously held at the…", "Grand Palais", ["Louvre", "Palais Garnier", "Eiffel Tower"]),
        C("For Autumn 2014, Chanel turned the Grand Palais into a…", "Supermarket", ["Beach", "Airport", "Casino"]),
        C("For Autumn 2017, Chanel launched a life-size…", "Rocket", ["Iceberg", "Carousel", "Plane"]),
        C("Chanel also recreated which of these inside the Grand Palais?", "A beach with waves", ["A football stadium", "A metro line", "A ski slope"]),
        C("Jacquemus's 2019 show 'Le Coup de Soleil' was held…", "In a lavender field", ["On a beach", "In a wheat field", "On a rooftop"]),
        C("Gucci's Spring 2023 'Twinsburg' show featured…", "68 pairs of identical twins", ["Only children", "Only dogs", "Robots"]),
        C("Moschino's 2014 debut by Jeremy Scott was inspired by…", "McDonald's", ["Barbie", "Coca-Cola", "SpongeBob"]),
        T("The Dior New Look was shown on 12 February 1947.", true),
      ],
    },
    {
      id: "runway-3",
      unit: "runway",
      title: "The supermodels",
      questions: [
        C("Who said 'We don't wake up for less than $10,000 a day'?", "Linda Evangelista", ["Naomi Campbell", "Cindy Crawford", "Kate Moss"]),
        C("Which 1960s model with a pixie cut was nicknamed after a twig?", "Twiggy", ["Jean Shrimpton", "Penelope Tree", "Peggy Moffitt"]),
        C("The 'Big Five' supermodels of the early 90s included Naomi, Linda, Cindy, Christy and…", "Claudia Schiffer", ["Kate Moss", "Gisele Bündchen", "Heidi Klum"]),
        C("Which model walked in Gianni Versace's 2017 tribute show with Naomi, Cindy, Claudia, Carla and Helena?", "Carla Bruni", ["Kate Moss", "Gigi Hadid", "Tyra Banks"]),
        T("Naomi Campbell was the first Black model on the cover of French Vogue, in 1988.", true),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 11. The fashion system
const system: Unit = {
  id: "system",
  title: "The fashion system",
  blurb: "Couture, the calendar, the magazines and the groups behind the brands",
  color: "#9dab8b",
  ink: "#0e0e0d",
  lessons: [
    {
      id: "system-1",
      unit: "system",
      title: "Couture & ready-to-wear",
      questions: [
        C("'Prêt-à-porter' means…", "Ready-to-wear", ["Made-to-measure", "Second-hand", "Custom tailoring"]),
        C("In France, 'haute couture' is…", "A legally protected name", ["Any expensive dress", "A magazine", "A fashion school"]),
        C("The seamstresses of couture ateliers are nicknamed…", "Les petites mains", ["Les grandes dames", "Les ciseaux", "Les modistes"]),
        C("A suit cut from a brand-new pattern made for one client is…", "Bespoke", ["Made-to-measure", "Ready-to-wear", "Off-the-rack"]),
        C("A small, focused collection of essential pieces is a…", "Capsule collection", ["Diffusion line", "Resort collection", "Couture collection"]),
        C("A cheaper second line from a designer is a…", "Diffusion line", ["Capsule", "Toile", "Lookbook"]),
        C("The collections between the main seasons are called…", "Resort (or Cruise) and Pre-Fall", ["Capsule and Couture", "Winter and Summer", "Drop and Collab"]),
        C("A catalogue of all the looks of a collection is a…", "Lookbook", ["Line sheet", "Moodboard", "Mood book"]),
        T("A 'muse' is a person who inspires a designer.", true),
        P("Match the term and its meaning", [
          ["Atelier", "Workshop"],
          ["Défilé", "Fashion show"],
          ["Toile", "Muslin prototype"],
          ["Maison", "Fashion house"],
        ]),
      ],
    },
    {
      id: "system-2",
      unit: "system",
      title: "The calendar",
      questions: [
        O("Put fashion month in order", ["New York", "London", "Milan", "Paris"]),
        C("The Met Gala takes place on the…", "First Monday of May", ["Last Friday of June", "First Sunday of March", "Second Tuesday of September"]),
        C("The Met Gala raises money for the Met's…", "Costume Institute", ["Painting department", "Fashion school", "Library"]),
        C("Couture weeks take place in…", "Paris", ["Milan", "London", "New York"]),
        C("The most important menswear trade fair, held in Florence, is…", "Pitti Uomo", ["Salone del Mobile", "Micam", "Première Vision"]),
        C("Première Vision is a trade fair for…", "Fabrics", ["Shoes", "Jewellery", "Perfume"]),
        T("The Spring/Summer collections are shown in September and October.", true, "Collections are shown about six months ahead."),
        T("The Autumn/Winter collections are shown in July.", false, "They're shown in February and March."),
      ],
    },
    {
      id: "system-3",
      unit: "system",
      title: "Magazines & groups",
      questions: [
        C("Vogue was founded in…", "1892", ["1920", "1867", "1950"]),
        C("The oldest American fashion magazine, founded in 1867, is…", "Harper's Bazaar", ["Vogue", "Elle", "W"]),
        C("Anna Wintour became editor-in-chief of US Vogue in…", "1988", ["1978", "1998", "2008"]),
        C("Which legendary editor ran Vogue from 1963 to 1971?", "Diana Vreeland", ["Anna Wintour", "Carmel Snow", "Grace Coddington"]),
        C("LVMH, the biggest luxury group, is led by…", "Bernard Arnault", ["François-Henri Pinault", "Johann Rupert", "Renzo Rosso"]),
        C("Gucci, Saint Laurent and Bottega Veneta belong to…", "Kering", ["LVMH", "Richemont", "Prada Group"]),
        C("Cartier and Van Cleef & Arpels belong to…", "Richemont", ["Kering", "LVMH", "OTB"]),
        C("Renzo Rosso's OTB group owns Diesel, Marni and…", "Maison Margiela", ["Moschino", "Valentino", "Versace"]),
        T("Dior, Louis Vuitton, Fendi and Celine all belong to LVMH.", true),
        T("The film 'The Devil Wears Prada' is said to be inspired by Anna Wintour.", true),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 12. Icons & muses
const muses: Unit = {
  id: "muses",
  title: "Icons & muses",
  blurb: "The people who made the clothes famous",
  color: "#f25aa8",
  ink: "#0e0e0d",
  lessons: [
    {
      id: "muses-1",
      unit: "muses",
      title: "Screen & style icons",
      questions: [
        C("Marilyn Monroe's white halter dress in The Seven Year Itch was designed by…", "William Travilla", ["Hubert de Givenchy", "Edith Head", "Oleg Cassini"]),
        C("Princess Diana's 1994 'revenge dress' was by…", "Christina Stambolian", ["Catherine Walker", "Versace", "Emanuel"]),
        C("Jackie Kennedy's official White House designer was…", "Oleg Cassini", ["Halston", "Givenchy", "Valentino"]),
        C("Which actress became Princess of Monaco and gave her name to a Hermès bag?", "Grace Kelly", ["Audrey Hepburn", "Sophia Loren", "Ava Gardner"]),
        C("Which 1990s actress wore Versace's safety pin dress to a premiere?", "Elizabeth Hurley", ["Julia Roberts", "Nicole Kidman", "Sharon Stone"]),
        C("Iris Apfel was famous for…", "Huge round glasses and maximalist style", ["Minimal black", "Grunge", "Sportswear"]),
        T("Madonna wore Jean Paul Gaultier's cone bra on her 1990 Blond Ambition tour.", true),
        P("Match the icon and the designer", [
          ["Audrey Hepburn", "Givenchy"],
          ["Grace Kelly", "Hermès"],
          ["Madonna", "Gaultier"],
          ["Jane Birkin", "Hermès Birkin"],
        ]),
      ],
    },
    {
      id: "muses-2",
      unit: "muses",
      title: "Editors, stylists & photographers",
      questions: [
        C("Which fashion editor discovered Alexander McQueen?", "Isabella Blow", ["Anna Wintour", "Carine Roitfeld", "Anna Dello Russo"]),
        C("Carine Roitfeld was editor-in-chief of…", "French Vogue", ["Harper's Bazaar", "Elle", "i-D"]),
        C("Who took the famous 1950s photo 'Dovima with Elephants'?", "Richard Avedon", ["Helmut Newton", "Irving Penn", "Mario Testino"]),
        C("Which photographer is known for provocative black-and-white 'Big Nudes'?", "Helmut Newton", ["Annie Leibovitz", "Richard Avedon", "Peter Lindbergh"]),
        C("Grace Coddington was creative director of…", "US Vogue", ["Harper's Bazaar", "i-D", "The Face"]),
        C("Anna Dello Russo is an Italian editor known for…", "Extravagant street style", ["Minimal black outfits", "Designing shoes", "Photography"]),
        T("Street style photography was pioneered by Bill Cunningham in New York.", true),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 13. Aesthetics & live trends
const clues = (name: string, a: string, b: string, list: string, wrong: string[]) =>
  ({ type: "choice", prompt: `${list}. Which aesthetic is it?`, visual: mood(a, b), options: [name, ...wrong], answer: 0 }) as Question;

const aesthetics: Unit = {
  id: "aesthetics",
  title: "Aesthetics & live trends",
  blurb: "The -cores, and the trends moving on Google right now",
  color: "#c9677f",
  ink: "#f2eee6",
  lessons: [
    {
      id: "aesthetics-1",
      unit: "aesthetics",
      title: "Aesthetics I",
      questions: [
        clues("Old Money", "#1f3448", "#e7dfcf", "Tennis whites, loafers, cable knits, navy blazer", ["Y2K", "Grunge", "Gorpcore"]),
        clues("Y2K", "#f4a6d7", "#9ad8f5", "Low-rise jeans, butterfly clips, baby tees, metallics", ["Old Money", "Balletcore", "Dark Academia"]),
        clues("Gorpcore", "#58623a", "#d8752f", "Fleeces, hiking boots, technical shells, carabiners", ["Blokecore", "Tenniscore", "Western"]),
        clues("Balletcore", "#f6dfe0", "#e8b7bf", "Wrap cardigans, leg warmers, satin flats, tulle", ["Coquette", "Cottagecore", "Y2K"]),
        clues("Mob Wife", "#3b1f16", "#b08a5a", "Faux fur, leopard, gold jewellery, big hair", ["Office Siren", "Old Money", "Indie Sleaze"]),
        clues("Dark Academia", "#3a2a1e", "#8c6b48", "Tweed blazers, turtlenecks, plaid, old books", ["Old Money", "Grunge", "Cottagecore"]),
        clues("Cottagecore", "#dfe6c6", "#9a7b4f", "Prairie dresses, florals, puff sleeves, wicker baskets", ["Coquette", "Boho", "Balletcore"]),
        clues("Grunge", "#2b2a26", "#6b3a2e", "Flannel shirts, ripped jeans, combat boots, slip dress over a tee", ["Indie Sleaze", "Punk", "Goth"]),
      ],
    },
    {
      id: "aesthetics-2",
      unit: "aesthetics",
      title: "Aesthetics II",
      questions: [
        clues("Quiet Luxury", "#d9cbb5", "#8b7a66", "Logo-free cashmere, perfect tailoring, neutral tones", ["Old Money", "Minimalism", "Office Siren"]),
        clues("Coquette", "#f6d5dc", "#c9677f", "Bows, lace, pink, ribbons in the hair", ["Balletcore", "Cottagecore", "Y2K"]),
        clues("Indie Sleaze", "#1b1b1b", "#c5243d", "Skinny jeans, leather jacket, flash photos, messy hair", ["Grunge", "Goth", "Rockstar Girlfriend"]),
        clues("Coastal Grandmother", "#a9c6d6", "#f2ead8", "Linen, straw hats, striped shirts, neutral knits", ["Old Money", "Cottagecore", "Scandi"]),
        clues("Office Siren", "#2c2c30", "#9aa3ad", "Pencil skirts, thin glasses, fitted blouses, sleek bun", ["Quiet Luxury", "Mob Wife", "Minimalism"]),
        clues("Blokecore", "#1f3fa3", "#d33a2c", "Football jerseys, track pants, retro trainers", ["Gorpcore", "Tenniscore", "Streetwear"]),
        clues("Tenniscore", "#f7f5f0", "#2e7d4f", "Pleated skirts, polos, white socks, visors", ["Old Money", "Preppy", "Athleisure"]),
        clues("Western", "#b5773e", "#e8d3b0", "Cowboy boots, fringe, denim, big buckles", ["Boho", "Coastal Cowgirl", "Gorpcore"]),
      ],
    },
    {
      id: "aesthetics-3",
      unit: "aesthetics",
      title: "Trend radar (live)",
      questions: Array.from({ length: 8 }, () => ({ type: "live", mode: "higher" }) as Question),
    },
    {
      id: "aesthetics-4",
      unit: "aesthetics",
      title: "Rising or falling (live)",
      questions: Array.from({ length: 8 }, () => ({ type: "live", mode: "direction" }) as Question),
    },
  ],
};

export const UNITS: Unit[] = [colour, fabrics, anatomy, history, paris, italy, world, directors, icons, runway, system, muses, aesthetics];

export const LESSONS: Lesson[] = UNITS.flatMap((u) => u.lessons);
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

/** Every static question, addressable by id (used by duels). */
export const QUESTION_POOL: { id: string; unit: string; q: Question }[] = LESSONS.flatMap((l) =>
  l.questions.map((q, i) => ({ id: `${l.id}:${i}`, unit: l.unit, q })).filter((x) => x.q.type !== "live"),
);
export const questionById = (id: string) => QUESTION_POOL.find((x) => x.id === id)?.q;
