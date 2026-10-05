# Attivare il collegamento Instagram (Meta)

Il Radar legge Instagram con l'API ufficiale di Meta. Serve un'app Meta di proprietà di Yeppo.

## 1. Crea l'app (15 minuti)
1. Vai su https://developers.facebook.com → accedi con il tuo Facebook → **Le mie app → Crea app**.
2. Caso d'uso: **Altro** → tipo **Business** → nome "Yeppo", email info@yeppo.it.
3. Nell'app aggiungi il prodotto **Facebook Login for Business** (o "Facebook Login").
4. **Facebook Login → Impostazioni** → in "URI di reindirizzamento OAuth validi" metti:
   `https://yeppo.it/api/instagram/callback`
5. **Impostazioni app → Di base**:
   - URL informativa sulla privacy: `https://yeppo.it/privacy`
   - URL termini: `https://yeppo.it/termini`
   - Eliminazione dati utente → "URL istruzioni": `https://yeppo.it/privacy#instagram`
   - Dominio app: `yeppo.it`
   - Icona: scarica https://yeppo.it/apple-icon
6. Copia **ID app** e **Chiave segreta**.

## 2. Inserisci le chiavi su Vercel
Vercel → progetto yeppo → Settings → Environment Variables (Production):
- `META_APP_ID` = ID app
- `META_APP_SECRET` = chiave segreta
- `META_CONFIG_ID` = ID della configurazione di Facebook Login for Business

Poi chiedi la ripubblicazione (le chiavi vengono lette durante la build).

## 3. Prova con il tuo account (subito, senza approvazione)
Finché l'app è in "modalità sviluppo" funziona per chi ha un ruolo nell'app (tu sei admin).
- Il tuo Instagram deve essere **professionale** (Business o Creator) e **collegato a una Pagina Facebook**.
- In Yeppo → Radar → **Collega Instagram**.

## 4. Approvazione per tutti gli utenti (App Review)
In **Revisione app → Autorizzazioni e funzionalità** chiedi l'accesso avanzato a:
- `instagram_basic`
- `instagram_manage_insights` (necessario per Business Discovery: verifica dei profili e post dei brand)
- `pages_show_list`
- `pages_read_engagement`
- `business_management`
- funzionalità **Instagram Public Content Access** (per gli hashtag)
- funzionalità **Meta oEmbed Read** (autore dei post da hashtag: funziona solo dopo l'approvazione)

Per ciascuna serve una breve descrizione d'uso e un video (screencast) del flusso:
login con Google su Yeppo → Radar → Collega Instagram → Cerca ora → post trovati → "Scrivi un commento" → "Copia e apri su Instagram".

Testo d'esempio: "Yeppo aiuta piccole agenzie e freelance a trovare i post pubblici recenti dei brand che seguono e degli hashtag del loro
settore, per commentarli manualmente. L'app legge soltanto: non pubblica, non mette like e non invia messaggi. Business Discovery è usato
per leggere gli ultimi post dei profili aziendali scelti dall'utente; Hashtag Search per i post recenti sugli hashtag scelti."

Serve anche la **verifica dell'azienda** (Business Verification) in Meta Business Manager: documenti dell'attività.
Tempi tipici: 1–4 settimane.

## Limiti da sapere
- Business Discovery funziona solo per profili Business/Creator.
- Hashtag: massimo 30 hashtag diversi ogni 7 giorni per account; i post da hashtag non riportano l'autore.
- Il token dura 60 giorni: il Radar avvisa quando scade (basta ricollegare).
