const express = require('express');
const router = express.Router();

// ── FIX: serve /widget.js direttamente ──
router.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'http://localhost:3000';

  res.send(widgetJS(baseUrl));
});

function widgetJS(baseUrl) {
  return `
(function() {
  'use strict';

  // Find the widget container
  var container = document.querySelector('[data-brand]');
  if (!container) {
    var scripts = document.querySelectorAll('script[data-brand]');
    if (scripts.length > 0) {
      container = document.createElement('div');
      container.setAttribute('data-brand', scripts[scripts.length-1].getAttribute('data-brand'));
      scripts[scripts.length-1].parentNode.insertBefore(container, scripts[scripts.length-1].nextSibling);
    }
  }
  if (!container) return;

  var brandId = container.getAttribute('data-brand');
  if (!brandId) return;

  var BASE_URL = '${baseUrl}';

  // Load config then render
  fetch(BASE_URL + '/api/config/' + brandId)
    .then(function(r) { return r.json(); })
    .then(function(config) { renderWidget(container, brandId, config, BASE_URL); })
    .catch(function(e) { console.error('NextClick widget error:', e); });
})();

function renderWidget(container, brandId, config, baseUrl) {
  var d = config.design;
  var copy = config.copy;
  var plan = config.plan;

  // Load font
  if (config.design.font_family && config.design.font_family !== 'System') {
    var fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(config.design.font_family) + ':wght@300;400;500;700;800&display=swap';
    document.head.appendChild(fontLink);
  }

  var font = config.design.font_family || 'DM Sans';

  // Inject CSS
  var style = document.createElement('style');
  style.textContent = \`
    .nc-widget { background: \${d.color_bg}; color: \${d.color_text}; font-family: '\${font}', sans-serif; max-width: 680px; margin: 0 auto; padding: 32px 24px; border-radius: 4px; }
    .nc-title { font-size: 1.6rem; font-weight: 800; margin-bottom: 8px; color: \${d.color_text}; }
    .nc-sub { font-size: .9rem; opacity: .7; margin-bottom: 28px; line-height: 1.6; }
    .nc-step { display: none; }
    .nc-step.active { display: block; }
    .nc-question { font-size: 1rem; font-weight: 700; margin-bottom: 16px; }
    .nc-input { width: 100%; padding: 12px; border: 1px solid rgba(0,0,0,.15); background: rgba(255,255,255,.05); color: \${d.color_text}; font-family: '\${font}', sans-serif; font-size: .9rem; border-radius: 4px; outline: none; margin-bottom: 12px; }
    .nc-input:focus { border-color: \${d.color_primary}; }
    .nc-textarea { min-height: 100px; resize: vertical; }
    .nc-btn { display: inline-block; padding: 12px 28px; background: \${d.color_button}; color: \${d.color_bg}; font-family: '\${font}', sans-serif; font-size: .78rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; border: none; cursor: pointer; border-radius: 4px; text-decoration: none; }
    .nc-btn:hover { opacity: .88; }
    .nc-btn-outline { background: transparent; border: 1px solid \${d.color_button}; color: \${d.color_button}; margin-right: 8px; }
    .nc-loading { text-align: center; padding: 40px; }
    .nc-spinner { width: 40px; height: 40px; border: 3px solid rgba(0,0,0,.1); border-top-color: \${d.color_primary}; border-radius: 50%; animation: nc-spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes nc-spin { to { transform: rotate(360deg); } }
    .nc-routine { line-height: 1.8; margin-bottom: 24px; }
    .nc-section { background: rgba(0,0,0,.05); border-left: 3px solid \${d.color_primary}; padding: 16px; margin-bottom: 16px; border-radius: 0 4px 4px 0; }
    .nc-section-title { font-weight: 700; font-size: .78rem; letter-spacing: .1em; text-transform: uppercase; color: \${d.color_primary}; margin-bottom: 8px; }
    .nc-products { display: grid; gap: 12px; margin-top: 24px; }
    .nc-product { border: 1px solid rgba(0,0,0,.1); padding: 16px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .nc-product-name { font-weight: 700; font-size: .9rem; }
    .nc-product-reason { font-size: .78rem; opacity: .7; margin-top: 4px; }
    .nc-product-price { font-size: 1rem; font-weight: 700; color: \${d.color_primary}; white-space: nowrap; }
    .nc-product-cta { padding: 8px 16px; background: \${d.color_button}; color: \${d.color_bg}; font-size: .7rem; font-weight: 700; text-decoration: none; border-radius: 4px; letter-spacing: .08em; text-transform: uppercase; }
    .nc-error { background: rgba(255,80,80,.1); border: 1px solid rgba(255,80,80,.3); color: #ff4444; padding: 14px; border-radius: 4px; font-size: .88rem; }
    .nc-limit { background: rgba(255,200,40,.1); border: 1px solid rgba(255,200,40,.3); color: #cc9900; padding: 14px; border-radius: 4px; font-size: .88rem; }
  \`;
  document.head.appendChild(style);

  // State
  var state = { step: 0, profile: {}, description: '', budgetMax: null };

  // Build questions based on category
  var questions = getQuestions(config.category, config.language);

  container.innerHTML = \`
    <div class="nc-widget" id="nc-\${brandId}">
      <div id="nc-step-intro" class="nc-step active">
        <div class="nc-title">\${copy.title}</div>
        <div class="nc-sub">\${copy.subtitle}</div>
        <button class="nc-btn" onclick="ncStart('\${brandId}')">\${copy.cta}</button>
      </div>
      <div id="nc-step-q" class="nc-step"></div>
      <div id="nc-step-loading" class="nc-step">
        <div class="nc-loading">
          <div class="nc-spinner"></div>
          <p style="opacity:.6;font-size:.9rem">Sto preparando i tuoi consigli…</p>
        </div>
      </div>
      <div id="nc-step-result" class="nc-step"></div>
    </div>
  \`;

  window['ncStart'] = function(bid) {
    if (bid !== brandId) return;
    state.step = 0;
    showQuestion(brandId, questions, state, baseUrl, plan, config);
  };
}

function getQuestions(category, lang) {
  var it = {
    beauty: [
      { key: 'skin_type', q: 'Qual è il tuo tipo di pelle?', type: 'choice', opts: ['Secca','Grassa','Mista','Sensibile','Normale'] },
      { key: 'concern', q: 'Qual è la tua principale preoccupazione?', type: 'choice', opts: ['Idratazione','Imperfezioni','Anti-età','Uniformità','Rossori'] },
      { key: 'description', q: 'Raccontaci di più (allergie, esigenze specifiche...)', type: 'textarea' },
    ],
    skincare: [
      { key: 'skin_type', q: 'Che tipo di pelle hai?', type: 'choice', opts: ['Secca','Grassa','Mista','Sensibile','Normale','Matura'] },
      { key: 'goal', q: 'Qual è il tuo obiettivo principale?', type: 'choice', opts: ['Idratazione','Anti-età','Acne','Luminosità','Protezione','Uniformità'] },
      { key: 'description', q: 'Aggiungi dettagli utili', type: 'textarea' },
    ],
    nutrition: [
      { key: 'goal', q: 'Qual è il tuo obiettivo?', type: 'choice', opts: ['Perdere peso','Massa muscolare','Energia','Benessere generale','Recupero sportivo'] },
      { key: 'diet', q: 'Segui una dieta particolare?', type: 'choice', opts: ['Nessuna','Vegetariana','Vegana','Senza glutine','Senza lattosio','Keto'] },
      { key: 'description', q: 'Descrivi le tue esigenze', type: 'textarea' },
    ],
    baby: [
      { key: 'age', q: 'Quanti anni ha il bambino?', type: 'choice', opts: ['0-6 mesi','6-12 mesi','1-3 anni','3-6 anni','6+ anni'] },
      { key: 'concern', q: 'Qual è la preoccupazione principale?', type: 'choice', opts: ['Pelle secca','Dermatite','Protezione solare','Igiene delicata','Capelli fini'] },
      { key: 'description', q: 'Note aggiuntive (allergie, ecc.)', type: 'textarea' },
    ],
    pet: [
      { key: 'animal', q: 'Che tipo di animale hai?', type: 'choice', opts: ['Cane','Gatto','Coniglio','Altro'] },
      { key: 'concern', q: 'Qual è il bisogno principale?', type: 'choice', opts: ['Nutrizione','Cura del pelo','Integratori','Igiene','Problemi digestivi'] },
      { key: 'description', q: 'Descrivi la situazione', type: 'textarea' },
    ],
    haircare: [
      { key: 'hair_type', q: 'Che tipo di capelli hai?', type: 'choice', opts: ['Lisci','Mossi','Ricci','Crespi','Fini','Spessi'] },
      { key: 'concern', q: 'Qual è il tuo problema principale?', type: 'choice', opts: ['Secchezza','Forfora','Caduta','Crespo','Danni da calore','Colore sbiadito'] },
      { key: 'description', q: 'Descrivi la tua routine attuale', type: 'textarea' },
    ],
    wellness: [
      { key: 'goal', q: 'Qual è il tuo obiettivo?', type: 'choice', opts: ['Stress','Sonno','Energia','Immunità','Digestione','Equilibrio ormonale'] },
      { key: 'lifestyle', q: 'Come descrivi il tuo stile di vita?', type: 'choice', opts: ['Sedentario','Attivo','Molto attivo','Stressante','Equilibrato'] },
      { key: 'description', q: 'Aggiungi dettagli utili', type: 'textarea' },
    ],
    fitness: [
      { key: 'goal', q: 'Qual è il tuo obiettivo fitness?', type: 'choice', opts: ['Perdere peso','Massa muscolare','Resistenza','Flessibilità','Recupero','Mantenimento'] },
      { key: 'level', q: 'Qual è il tuo livello?', type: 'choice', opts: ['Principiante','Intermedio','Avanzato'] },
      { key: 'description', q: 'Descrivi la tua situazione attuale', type: 'textarea' },
    ],
  };
  return it[category] || it.beauty;
}

function showQuestion(brandId, questions, state, baseUrl, plan, config) {
  var q = questions[state.step];
  var stepEl = document.getElementById('nc-step-q');
  var introEl = document.getElementById('nc-step-intro');
  var isLast = state.step === questions.length - 1;

  introEl && (introEl.classList.remove('active'));
  stepEl.classList.add('active');

  var progress = questions.map(function(_, i) {
    return '<div style="flex:1;height:3px;background:' + (i <= state.step ? config.design.color_primary : 'rgba(0,0,0,.15)') + ';border-radius:2px"></div>';
  }).join('');

  var inputHtml = '';
  if (q.type === 'choice') {
    inputHtml = q.opts.map(function(o) {
      return '<button class="nc-btn nc-btn-outline" style="margin:4px" onclick="ncAnswer(\'' + brandId + '\',\'' + q.key + '\',\'' + o + '\')">' + o + '</button>';
    }).join('');
  } else {
    inputHtml = '<textarea class="nc-input nc-textarea" id="nc-desc" placeholder="Scrivi qui..."></textarea>' +
      '<button class="nc-btn" onclick="ncSubmitText(\'' + brandId + '\',\'' + q.key + '\')">' + (isLast ? 'Genera →' : 'Avanti →') + '</button>';
  }

  stepEl.innerHTML = '<div style="display:flex;gap:6px;margin-bottom:24px">' + progress + '</div>' +
    '<div class="nc-question">' + q.q + '</div>' +
    '<div>' + inputHtml + '</div>' +
    (state.step > 0 ? '<div style="margin-top:16px"><button class="nc-btn nc-btn-outline" onclick="ncBack(\'' + brandId + '\')">← Indietro</button></div>' : '');

  window['ncAnswer'] = function(bid, key, val) {
    if (bid !== brandId) return;
    state.profile[key] = val;
    if (key === 'description') state.description = val;
    state.step++;
    if (state.step >= questions.length) {
      ncGenerate(brandId, state, baseUrl, plan, config);
    } else {
      showQuestion(brandId, questions, state, baseUrl, plan, config);
    }
  };

  window['ncSubmitText'] = function(bid, key) {
    if (bid !== brandId) return;
    var val = document.getElementById('nc-desc') ? document.getElementById('nc-desc').value : '';
    if (key === 'description') state.description = val;
    else state.profile[key] = val;
    state.step++;
    if (state.step >= questions.length) {
      ncGenerate(brandId, state, baseUrl, plan, config);
    } else {
      showQuestion(brandId, questions, state, baseUrl, plan, config);
    }
  };

  window['ncBack'] = function(bid) {
    if (bid !== brandId) return;
    state.step = Math.max(0, state.step - 1);
    showQuestion(brandId, questions, state, baseUrl, plan, config);
  };
}

function ncGenerate(brandId, state, baseUrl, plan, config) {
  document.getElementById('nc-step-q') && document.getElementById('nc-step-q').classList.remove('active');
  document.getElementById('nc-step-loading') && document.getElementById('nc-step-loading').classList.add('active');

  fetch(baseUrl + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand_id: brandId,
      profile: state.profile,
      description: state.description,
      budget_max: state.budgetMax
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    document.getElementById('nc-step-loading') && document.getElementById('nc-step-loading').classList.remove('active');
    var resultEl = document.getElementById('nc-step-result');
    resultEl.classList.add('active');

    if (data.error) {
      var msg = data.code === 'generations_limit'
        ? 'Limite di generazioni raggiunto per questo mese.'
        : data.error;
      resultEl.innerHTML = '<div class="nc-' + (data.code === 'generations_limit' ? 'limit' : 'error') + '">' + msg + '</div>' +
        '<button class="nc-btn" style="margin-top:16px" onclick="location.reload()">↺ Riprova</button>';
      return;
    }

    var html = '';
    if (plan === 'advisor' && data.routine) {
      html += renderRoutine(data.routine, config.design.color_primary);
    }

    if (data.products && data.products.length > 0) {
      html += '<div style="font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin-top:24px;margin-bottom:12px">Prodotti consigliati</div>';
      html += '<div class="nc-products">' + data.products.map(function(p) {
        return '<div class="nc-product">' +
          '<div><div class="nc-product-name">' + (p.nome||'') + '</div>' +
          '<div class="nc-product-reason">' + (p.motivo||'') + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:12px">' +
          (p.prezzo ? '<div class="nc-product-price">' + p.prezzo + '</div>' : '') +
          (p.url ? '<a class="nc-product-cta" href="' + p.url + '" target="_blank" rel="noopener">Vedi →</a>' : '') +
          '</div></div>';
      }).join('') + '</div>';
    }

    html += '<div style="margin-top:24px"><button class="nc-btn nc-btn-outline" onclick="ncRestart(\'' + brandId + '\')">↺ Ricomincia</button></div>';
    resultEl.innerHTML = html;
  })
  .catch(function(e) {
    document.getElementById('nc-step-loading') && document.getElementById('nc-step-loading').classList.remove('active');
    var resultEl = document.getElementById('nc-step-result');
    resultEl.classList.add('active');
    resultEl.innerHTML = '<div class="nc-error">Errore di connessione. Riprova.</div><button class="nc-btn" style="margin-top:16px" onclick="ncRestart(\'' + brandId + '\')">↺ Riprova</button>';
  });

  window['ncRestart'] = function(bid) {
    if (bid !== brandId) return;
    state.step = 0; state.profile = {}; state.description = '';
    document.getElementById('nc-step-result') && document.getElementById('nc-step-result').classList.remove('active');
    document.getElementById('nc-step-intro') && document.getElementById('nc-step-intro').classList.add('active');
  };
}

function renderRoutine(text, primaryColor) {
  var sections = text.split(/^## /m).filter(function(s) { return s.trim(); });
  return '<div class="nc-routine">' + sections.map(function(sec) {
    var lines = sec.split('\\n');
    var title = lines[0].trim();
    var body = lines.slice(1).join('\\n').trim()
      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\n/g, '<br>');
    return '<div class="nc-section"><div class="nc-section-title">' + title + '</div><div>' + body + '</div></div>';
  }).join('') + '</div>';
}
`;
}

module.exports = router;
