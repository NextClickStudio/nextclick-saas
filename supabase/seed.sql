-- =====================================================================
-- ZEPPO v1 — dati di prova (FACOLTATIVO)
-- Crea il progetto demo "NextClick" con 6 criteri e 3 aziende di prova
-- (URL placeholder su example.com) già analizzate, così puoi vedere
-- subito classifica e report. Puoi eliminarlo dalla tab Impostazioni.
-- Esegui DOPO schema.sql. Si può rieseguire: non crea doppioni.
-- =====================================================================

insert into projects (id, name, product_description, target_customer, target_sector, symptom, index_name,
                      public_slug, public_top_n, public_ranking_enabled, report_cta_text, report_cta_url, sender_name)
values (
  '00000000-0000-4000-8000-000000000001',
  'NextClick – Beauty e integratori (demo)',
  'NextClick Studio: un widget AI per Shopify che fa qualche domanda al cliente e gli consiglia il prodotto giusto, come farebbe una commessa esperta.',
  'E-commerce italiani di beauty e integratori su Shopify, con cataloghi ampi (50+ prodotti).',
  'Beauty e integratori Italia',
  'Il sito non aiuta il cliente indeciso a scegliere tra tanti prodotti: niente guida alla scelta, niente domande sulle esigenze, schede prodotto che non dicono "per chi è".',
  'Indice della consulenza online',
  'demonextclick',
  10,
  true,
  'Prenota 15 minuti per capire come migliorare',
  'https://calendly.com/',
  'Il team di NextClick Studio'
)
on conflict (id) do nothing;

insert into criteria (id, project_id, name, description, how_to_check, weight, position) values
('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', 'Guida alla scelta',
 'Il sito offre uno strumento o un percorso che aiuta a scegliere il prodotto giusto.',
 'Cercare quiz, "trova il tuo prodotto", configuratori, test della pelle, pagine "come scegliere".', 5, 0),
('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', 'Per chi è il prodotto',
 'Le schede prodotto dicono chiaramente a quale esigenza o tipo di cliente sono adatte.',
 'Nella pagina prodotto cercare frasi come "ideale per", "adatto a", tipo di pelle, obiettivo.', 4, 1),
('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001', 'Navigazione per esigenza',
 'Le categorie e i filtri sono organizzati per problema/obiettivo, non solo per tipo di prodotto.',
 'Controllare menu e collezioni: esistono voci come "pelle secca", "energia", "sonno"?', 3, 2),
('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-000000000001', 'Consulenza disponibile',
 'Il cliente può chiedere un consiglio in tempo reale.',
 'Cercare chat, WhatsApp, "chiedi a un esperto", consulenza gratuita.', 3, 3),
('00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-000000000001', 'Confronto tra prodotti',
 'Il sito aiuta a capire le differenze tra prodotti simili.',
 'Cercare tabelle di confronto, "differenza tra", routine consigliate, bundle spiegati.', 2, 4),
('00000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-000000000001', 'Prova sociale mirata',
 'Recensioni e testimonianze aiutano a capire se il prodotto va bene per me.',
 'Cercare recensioni con dettagli sul tipo di cliente/esigenza, non solo stelle.', 2, 5)
on conflict (id) do nothing;

insert into companies (id, project_id, name, website_url, status, notes) values
('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'Bellezza Naturale (demo)', 'https://bellezza-naturale.example.com', 'da_contattare', null),
('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'Vita Integra (demo)', 'https://vita-integra.example.com', 'contattata', 'Scritto al titolare su LinkedIn'),
('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'Pelle Pura (demo)', 'https://pelle-pura.example.com', 'da_contattare', null)
on conflict (id) do nothing;

insert into analyses (id, company_id, status, pages_analyzed, scores, weak_points, summary, total_score, analyzed_at) values
('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'completata',
 '[{"url":"https://bellezza-naturale.example.com","title":"Bellezza Naturale – Cosmetici bio"},{"url":"https://bellezza-naturale.example.com/products/siero-viso","title":"Siero viso"}]',
 '[{"criterion_id":"00000000-0000-4000-8000-0000000000c1","score":8,"evidence":"In homepage c''è un pulsante \"Fai il test della pelle\"."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c2","score":7,"evidence":"Nella pagina prodotto è indicato \"ideale per pelli secche e mature\"."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c3","score":6,"evidence":"Il menu ha una sezione \"Per esigenza\" con 4 voci."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c4","score":7,"evidence":"È presente una chat di assistenza."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c5","score":4,"evidence":"Non ho trovato confronti tra prodotti simili."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c6","score":6,"evidence":"Recensioni presenti, alcune citano il tipo di pelle."}]',
 '[{"title":"Manca un confronto tra prodotti simili","explanation":"Chi esita tra due sieri non trova un aiuto per capire la differenza, e rischia di rimandare l''acquisto.","evidence":"Nessuna tabella o testo di confronto nelle pagine lette."},
   {"title":"Le recensioni non aiutano a scegliere","explanation":"Le recensioni ci sono, ma raramente dicono per quale tipo di pelle il prodotto ha funzionato.","evidence":"Nella pagina prodotto le recensioni sono per lo più solo stelle."},
   {"title":"Filtri per esigenza limitati","explanation":"Le esigenze proposte sono poche: chi ha un problema diverso deve sfogliare tutto il catalogo.","evidence":"Il menu \"Per esigenza\" ha 4 voci."}]',
 'Il sito accompagna bene il cliente con un test della pelle e schede chiare. Resta margine sul confronto tra prodotti simili.',
 67, now() - interval '2 days'),
('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2', 'completata',
 '[{"url":"https://vita-integra.example.com","title":"Vita Integra – Integratori naturali"},{"url":"https://vita-integra.example.com/collections/energia","title":"Energia"}]',
 '[{"criterion_id":"00000000-0000-4000-8000-0000000000c1","score":1,"evidence":"Non ho trovato quiz o percorsi di scelta."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c2","score":3,"evidence":"Le schede elencano gli ingredienti ma non a chi è adatto il prodotto."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c3","score":5,"evidence":"Esiste una collezione \"Energia\", ma le altre categorie sono per tipo di prodotto."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c4","score":2,"evidence":"Solo un modulo contatti generico."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c5","score":1,"evidence":"Nessun confronto tra prodotti."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c6","score":4,"evidence":"Recensioni presenti ma generiche."}]',
 '[{"title":"Il cliente indeciso resta da solo","explanation":"Con molti integratori simili e nessuna guida, chi non sa cosa gli serve rischia di uscire dal sito senza comprare.","evidence":"In homepage e nella collezione Energia non ci sono quiz né domande sulle esigenze."},
   {"title":"Le schede non dicono per chi è il prodotto","explanation":"Gli ingredienti ci sono, ma manca la frase che fa dire al cliente \"questo è per me\".","evidence":"Nella collezione Energia le descrizioni elencano solo i componenti."},
   {"title":"Nessun modo rapido per chiedere un consiglio","explanation":"Chi ha un dubbio deve compilare un modulo e aspettare: spesso non lo fa.","evidence":"Non è presente una chat né un contatto WhatsApp."}]',
 'Il catalogo è ampio ma il sito non aiuta a scegliere. Chi arriva con un bisogno generico trova poche indicazioni su quale prodotto fa per lui.',
 25, now() - interval '2 days'),
('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a3', 'completata',
 '[{"url":"https://pelle-pura.example.com","title":"Pelle Pura – Skincare"}]',
 '[{"criterion_id":"00000000-0000-4000-8000-0000000000c1","score":3,"evidence":"C''è una pagina \"Come scegliere\" ma solo testuale."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c2","score":6,"evidence":"Alcune schede indicano il tipo di pelle."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c3","score":4,"evidence":"Categorie per tipo di prodotto, pochi filtri."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c4","score":5,"evidence":"Presente un link WhatsApp."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c5","score":3,"evidence":"Nessun confronto esplicito."},
   {"criterion_id":"00000000-0000-4000-8000-0000000000c6","score":5,"evidence":"Recensioni presenti."}]',
 '[{"title":"La guida alla scelta è difficile da trovare","explanation":"La pagina \"Come scegliere\" esiste ma è solo testo e non porta a un prodotto preciso.","evidence":"Link nel menu, nessun collegamento ai prodotti."},
   {"title":"Categorie pensate per chi sa già cosa cerca","explanation":"Chi arriva con un problema (es. pelle grassa) deve capire da solo quale categoria aprire.","evidence":"Menu organizzato per creme, sieri, detergenti."},
   {"title":"Poche differenze spiegate","explanation":"Prodotti simili sembrano intercambiabili e il cliente non sa quale prendere.","evidence":"Nessun testo che confronti i prodotti."}]',
 'Il sito ha buone basi ma lascia al cliente il lavoro di scegliere. Una guida più visibile ridurrebbe gli abbandoni.',
 43, now() - interval '2 days')
on conflict (id) do nothing;

insert into reports (company_id, slug) values
('00000000-0000-4000-8000-0000000000a1', 'demoBellezza01'),
('00000000-0000-4000-8000-0000000000a2', 'demoVitaInt002'),
('00000000-0000-4000-8000-0000000000a3', 'demoPellePur03')
on conflict (company_id) do nothing;
