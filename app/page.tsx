import Link from "next/link";
import Reveal from "@/components/reveal";
import ProductDemo from "@/components/landing/product-demo";
import Scanner from "@/components/landing/scanner";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { btn } from "@/components/ui";
import { COMPANIES_PER_FREE_SESSION, COMPANIES_PER_SESSION, PLANS, formatEuro } from "@/lib/plans";

const STEPS = [
  {
    n: "01",
    title: "Descrivi cosa vendi",
    text: "Cosa offri, a chi, in che settore e a quali dimensioni di azienda punti. Bastano due minuti.",
  },
  {
    n: "02",
    title: "L'AI trova il sintomo visibile",
    text: "Il segnale che si vede dall'esterno, sul sito di un'azienda, e che rivela che ha proprio il problema che risolvi. Diventa 6-10 criteri misurabili.",
  },
  {
    n: "03",
    title: "Yeppo trova le aziende e le analizza",
    text: `Cerca sul web le aziende giuste per te, visita i loro siti e assegna un punteggio con prove concrete. Fino a ${COMPANIES_PER_SESSION} aziende per sessione.`,
  },
  {
    n: "04",
    title: "L'AI scrive, tu invii con un clic",
    text: "Per ogni azienda: report privato, canale più diretto e messaggio personalizzato per Instagram, WhatsApp, LinkedIn o email. I follow-up li programma Yeppo.",
  },
  {
    n: "05",
    title: "Ti chiedono la call",
    text: "Dal report l'azienda prenota 15 minuti con te. Ti arriva la notifica: accetti e rispondi in DM con un clic.",
  },
];

const CHANNELS = [
  { name: "Instagram DM", hint: "il brand legge i messaggi ogni giorno" },
  { name: "WhatsApp Business", hint: "risposta in minuti, non in settimane" },
  { name: "Chat del sito", hint: "arrivi a una persona reale" },
  { name: "LinkedIn", hint: "dritto a chi decide" },
  { name: "Pagina partner / B2B", hint: "il canale che le aziende aprono per collaborare" },
  { name: "Modulo contatti", hint: "con il report come oggetto" },
];

const FAQ = [
  {
    q: "Perché funziona meglio di una cold email?",
    a: "Perché non chiedi nulla: regali un'analisi concreta del loro sito, con la loro posizione rispetto ai concorrenti. Il titolare la apre per curiosità, e la conversazione parte da un problema che può vedere con i suoi occhi.",
  },
  {
    q: "Da dove arrivano le aziende?",
    a: "Yeppo le cerca sul web in base a settore, area geografica e dimensione che scegli. Ogni sito viene verificato prima di entrare nella lista. Puoi anche aggiungere a mano le aziende che conosci già.",
  },
  {
    q: "Cosa contiene il report che ricevono le aziende?",
    a: "È breve e diretto: posizione e punteggio rispetto al settore, i 3 punti in cui il sito perde clienti, chi sei tu e come risolvi quei punti, e un modulo per prenotare subito una call di 15 minuti. Il dettaglio dei criteri resta disponibile per chi vuole approfondire.",
  },
  {
    q: "Yeppo invia messaggi al posto mio?",
    a: "Yeppo scrive i messaggi per te, uno diverso per ogni azienda e per ogni canale, e apre la chat giusta con il testo pronto: tu controlli e premi invia. Poi programma i follow-up. Niente invii di massa automatici: Instagram e WhatsApp li vietano e bloccano gli account che li fanno, e sono proprio i messaggi di massa che le aziende ignorano.",
  },
  {
    q: "Come arrivano le richieste di call?",
    a: "L'azienda le invia dal report scegliendo come essere ricontattata (WhatsApp, telefono, email o Instagram). Tu ricevi la notifica in Yeppo, accetti e rispondi con un clic: il messaggio di conferma è già scritto.",
  },
  {
    q: "Quanto costa?",
    a: `Ti registri e hai una sessione di prova gratuita fino a ${COMPANIES_PER_FREE_SESSION} aziende. Poi scegli un piano mensile (Basic, Pro o Agency) e lo disdici quando vuoi, senza vincoli.`,
  },
  {
    q: "È legale analizzare i siti delle aziende?",
    a: "Yeppo legge solo pagine pubbliche, rispetta robots.txt, non raccoglie dati personali e non salva i contenuti dei siti. Quando contatti le aziende resti responsabile del rispetto delle norme sul marketing (vedi Termini).",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1 overflow-hidden">
        {/* HERO */}
        <section className="relative">
          <div className="bg-grid absolute inset-0" />
          <div className="orb -left-32 top-10 h-96 w-96 bg-accent/40" />
          <div className="orb -right-24 top-40 h-80 w-80 bg-cyan/25" style={{ animationDelay: "-6s" }} />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
            <div>
              <div className="fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan" />
                Prospezione B2B guidata dall&apos;AI
              </div>
              <h1 className="fade-in font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl" style={{ animationDelay: "80ms" }}>
                Il tuo commerciale AI.
                <br />
                <span className="text-gradient">Senza cold email.</span>
              </h1>
              <p className="fade-in mt-6 max-w-xl text-lg leading-relaxed text-zinc-400" style={{ animationDelay: "160ms" }}>
                Yeppo trova le aziende giuste, scopre dove perdono clienti e prepara per ognuna un report e il messaggio
                perfetto per Instagram, WhatsApp, LinkedIn o email. Loro vedono il problema, ti chiedono una call. Tu chiudi.
              </p>
              <div className="fade-in mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "240ms" }}>
                <Link href="/registrati" className={`${btn.accent} !px-6 !py-3 text-base`}>
                  Prova gratis
                </Link>
                <Link href="#demo" className={`${btn.secondary} !px-6 !py-3 text-base`}>
                  Guarda la demo
                </Link>
              </div>
              <p className="fade-in mt-4 text-xs text-zinc-500" style={{ animationDelay: "320ms" }}>
                1 sessione gratuita · nessuna carta richiesta
              </p>
            </div>
            <div className="fade-in" style={{ animationDelay: "200ms" }}>
              <Scanner />
            </div>
          </div>
        </section>

        {/* NASTRO */}
        <section className="border-y border-white/[0.06] bg-white/[0.015] py-5">
          <div className="flex overflow-hidden">
            <div className="marquee flex shrink-0 gap-12 whitespace-nowrap pr-12 text-sm text-zinc-500">
              {[...Array(2)].flatMap((_, k) =>
                ["Ricerca automatica delle aziende", "Analisi dei siti con prove", "Report privati", "Messaggi scritti dall'AI", "Follow-up automatici", "Richieste di call", "Classifica di settore", "Radar Instagram"].map((t) => (
                  <span key={`${k}-${t}`} className="flex items-center gap-3">
                    <span className="h-1 w-1 rounded-full bg-accent" />
                    {t}
                  </span>
                )),
              )}
            </div>
          </div>
        </section>

        {/* DEMO DEL PRODOTTO */}
        <section id="demo" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
            <Reveal className="min-w-0">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Guarda Yeppo al lavoro</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Dalla lista di aziende alla call, in 5 passi.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-zinc-400">
                Descrivi cosa vendi. Yeppo trova le aziende che ne hanno bisogno, ti mostra il problema concreto di ognuna, chi
                decide e cosa scrivergli. Tu mandi il messaggio e vedi chi apre la proposta.
              </p>
              <Link href="/registrati" className={`${btn.accent} mt-8 !px-6 !py-3 text-base`}>
                Provalo gratis
              </Link>
            </Reveal>
            <Reveal delay={120} className="min-w-0">
              <ProductDemo />
            </Reveal>
          </div>
        </section>

        {/* IL PROBLEMA */}
        <section className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
          <Reveal className="max-w-3xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Il problema</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Le cold email finiscono nello spam. Le aziende ignorano chi vuole solo vendere.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-zinc-400">
              Il titolare di un&apos;azienda riceve decine di proposte ogni settimana, tutte uguali. Yeppo ribalta il copione:
              invece di chiedere attenzione, gliela regali. Un&apos;analisi del suo sito, fatta su misura, con la sua posizione
              rispetto ai concorrenti.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { t: "Liste generiche", d: "Database comprati, contatti a caso, nessun motivo per essere ascoltato." },
              { t: "Messaggi tutti uguali", d: "Template che parlano di te, non del problema dell'azienda." },
              { t: "Canali sbagliati", d: "Email info@ che nessuno legge, mentre il titolare risponde su Instagram." },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 120}>
                <div className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
                  <span className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-300">✕</span>
                  <h3 className="font-semibold text-white">{x.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{x.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* COME FUNZIONA */}
        <section id="come-funziona" className="relative scroll-mt-20 border-t border-white/[0.06] py-28">
          <div className="orb left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 bg-accent/20" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mb-16 max-w-2xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Come funziona</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Da zero a una lista di prospect con un motivo per parlarti.
              </h2>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 100}>
                  <div className="group relative h-full overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-8 transition-colors hover:border-accent/40">
                    <span className="font-mono text-sm text-accent">{s.n}</span>
                    <h3 className="mt-4 font-display text-2xl font-semibold text-white">{s.title}</h3>
                    <p className="mt-3 leading-relaxed text-zinc-400">{s.text}</p>
                    <div className="absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-accent/0 blur-3xl transition-all duration-700 group-hover:bg-accent/30" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* METODO DI CONTATTO */}
        <section id="contatto" className="scroll-mt-20 border-t border-white/[0.06] py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
            <Reveal>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Metodo di contatto</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Il canale giusto, per ogni azienda.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-zinc-400">
                Yeppo legge i canali che ogni azienda pubblica sul proprio sito e sceglie il più diretto per arrivare a chi
                decide. Ti dà i passi da seguire e l&apos;aggancio personalizzato, basato sul punto debole più forte trovato.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-zinc-300">
                {["Nessuna email fredda: il primo messaggio è una domanda, non una vendita", "Aggancio costruito sui dati del loro sito", "Sai quando aprono il report"].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-[11px] text-emerald-300">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <div className="grid grid-cols-2 gap-3">
              {CHANNELS.map((c, i) => (
                <Reveal key={c.name} delay={i * 80}>
                  <div className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-all hover:-translate-y-1 hover:border-accent/40 hover:bg-white/[0.04]">
                    <p className="font-semibold text-white">{c.name}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{c.hint}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* DAL MESSAGGIO ALLA CALL */}
        <section className="relative border-t border-white/[0.06] py-28">
          <div className="orb right-10 top-20 h-64 w-64 bg-cyan/15" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto mb-16 max-w-2xl text-center">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Outreach</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">Dal primo messaggio alla call.</h2>
              <p className="mt-5 text-lg text-zinc-400">Ogni giorno Yeppo ti dice chi contattare. Tu premi invia, il resto lo segue lui.</p>
            </Reveal>
            <div className="relative grid gap-4 md:grid-cols-4">
              <div className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent md:block" />
              {[
                { icon: "✉", title: "L'aggancio", text: "Chi sei e una domanda sul loro problema. Niente link, niente vendita: solo una conversazione." },
                { icon: "🔥", title: "La soluzione", text: "Nel follow-up arriva la pagina con la soluzione su misura. Yeppo ti dice quando la aprono." },
                { icon: "📞", title: "Ti chiedono la call", text: "Dal report, in un clic. Ti arriva la notifica in Richieste." },
                { icon: "✓", title: "Accetti e rispondi", text: "Conferma già scritta su WhatsApp, email o Instagram." },
              ].map((x, i) => (
                <Reveal key={x.title} delay={i * 150}>
                  <div className="relative h-full rounded-2xl border border-white/[0.07] bg-panel p-6 text-center">
                    <span className="relative mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-cyan/20 text-xl ring-1 ring-white/10">
                      {x.icon}
                    </span>
                    <p className="font-semibold text-white">{x.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{x.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* REPORT */}
        <section className="border-t border-white/[0.06] py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Il report</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Quello che riceve l&apos;azienda.
              </h2>
              <p className="mt-5 text-lg text-zinc-400">
                Corto, chiaro, pensato per il telefono: il problema, la tua soluzione e la call da prenotare subito.
              </p>
            </Reveal>
            <Reveal>
              <div className="glow-border mx-auto max-w-xl rounded-3xl bg-panel p-6 sm:p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-accent">Analisi gratuita</p>
                <p className="mt-3 font-display text-2xl font-semibold leading-tight text-white">Atelier Milano, il tuo sito perde clienti in 3 punti.</p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    ["Posizione", "24", "/30"],
                    ["Punteggio", "34", "/100"],
                    ["Media settore", "52", ""],
                  ].map(([l, v, u]) => (
                    <div key={l} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                      <p className="text-[11px] text-zinc-500">{l}</p>
                      <p className="font-display text-2xl font-semibold text-white">{v}<span className="text-xs text-zinc-500">{u}</span></p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-accent/30 bg-accent-soft p-4">
                  <p className="text-sm font-semibold text-white">Come possiamo risolverlo</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-300">Foto e video prodotto con l&apos;AI in 48 ore: schede che mostrano il capo indossato e in movimento.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="h-8 rounded-lg bg-white/[0.06]" />
                    <div className="h-8 rounded-lg bg-white/[0.06]" />
                  </div>
                  <div className="mt-2 rounded-lg bg-gradient-to-r from-accent to-cyan py-2 text-center text-xs font-semibold text-ink">Prenota la call gratuita</div>
                </div>
                <div className="mt-4 space-y-2">
                  {["Le schede non spiegano vestibilità e taglie", "Foto senza contesto d'uso", "Nessuna guida per chi è indeciso"].map((t, i) => (
                    <div key={t} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-ink">{i + 1}</span>
                      <span className="text-sm text-zinc-200">{t}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-center text-xs text-zinc-600">Esempio illustrativo</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* PREZZI */}
        <section id="prezzi" className="scroll-mt-20 border-t border-white/[0.06] py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Prezzi</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">Un commerciale AI, al prezzo di un caffè al giorno.</h2>
              <p className="mt-5 text-lg text-zinc-400">
                Abbonamento mensile, disdici quando vuoi. Prova gratis: 1 sessione (fino a {COMPANIES_PER_FREE_SESSION} aziende) e 3 ricerche Radar.
              </p>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-3">
              {PLANS.map((p, i) => (
                <Reveal key={p.id} delay={i * 100}>
                  <div className={`relative flex h-full flex-col rounded-3xl border p-7 ${p.highlight ? "glow-border border-transparent bg-panel" : "border-white/[0.07] bg-white/[0.02]"}`}>
                    {p.highlight && (
                      <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-accent to-cyan px-3 py-1 text-xs font-semibold text-ink">
                        Più scelto
                      </span>
                    )}
                    <p className="font-display text-xl font-semibold text-white">{p.name}</p>
                    <p className="mt-4 font-display text-4xl font-semibold text-white">
                      {formatEuro(p.priceCents)}
                      <span className="ml-1 text-sm font-normal text-zinc-500">/mese + IVA</span>
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">{formatEuro(Math.round(p.priceCents / p.sessions))} a sessione</p>
                    <ul className="mt-7 flex-1 space-y-2.5 text-sm text-zinc-300">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-2.5">
                          <span className="text-cyan">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/registrati" className={`mt-8 w-full ${p.highlight ? btn.accent : btn.secondary}`}>
                      Inizia gratis
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-white/[0.06] py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal className="mb-12 text-center">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">FAQ</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">Domande frequenti</h2>
            </Reveal>
            <div className="space-y-3">
              {FAQ.map((f, i) => (
                <Reveal key={f.q} delay={i * 60}>
                  <details className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-5 open:bg-white/[0.035]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-white">
                      {f.q}
                      <span className="text-zinc-500 transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 leading-relaxed text-zinc-400">{f.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINALE */}
        <section className="relative border-t border-white/[0.06] py-28">
          <div className="orb left-1/2 top-1/2 h-80 w-[36rem] -translate-x-1/2 -translate-y-1/2 bg-accent/25" />
          <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              La prossima azienda che contatti <span className="text-gradient">ti ringrazierà.</span>
            </h2>
            <p className="mt-6 text-lg text-zinc-400">Crea l&apos;account e avvia la tua prima sessione gratuita.</p>
            <Link href="/registrati" className={`${btn.accent} mt-10 !px-8 !py-3.5 text-base`}>
              Inizia gratis
            </Link>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
