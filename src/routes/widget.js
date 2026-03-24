const express = require('express');
const router = express.Router();

// CORS headers helper — applied to every widget-related response
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Preflight for widget.js
router.options('/widget.js', (req, res) => {
  setCorsHeaders(res);
  res.sendStatus(204);
});

router.get('/widget.js', (req, res) => {
  setCorsHeaders(res);
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');

  // Build a clean absolute base URL — never rely on RAILWAY_PUBLIC_DOMAIN alone
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3000';
  const baseUrl = domain.startsWith('http') ? domain : 'https://' + domain;

  res.send(widgetJS(baseUrl));
});

// ─────────────────────────────────────────────────────────────
// The widget script is built with plain string concatenation
// (NO outer template-literal) to avoid nested-backtick escaping
// issues that cause "Uncaught SyntaxError: Unexpected string".
// ─────────────────────────────────────────────────────────────
function widgetJS(baseUrl) {
  // All dynamic values are injected via string concatenation, not
  // template literals, so there is no risk of a runaway backtick.
  return [
    '(function(){\n',
    '"use strict";\n',

    // ── find container ──
    'var container = document.querySelector("[data-brand]");\n',
    'if (!container) {\n',
    '  var scripts = document.querySelectorAll("script[data-brand]");\n',
    '  if (scripts.length > 0) {\n',
    '    container = document.createElement("div");\n',
    '    container.setAttribute("data-brand", scripts[scripts.length-1].getAttribute("data-brand"));\n',
    '    scripts[scripts.length-1].parentNode.insertBefore(container, scripts[scripts.length-1].nextSibling);\n',
    '  }\n',
    '}\n',
    'if (!container) return;\n',
    'var brandId = container.getAttribute("data-brand");\n',
    'if (!brandId) return;\n',

    // ── base URL injected server-side ──
    'var BASE_URL = "' + baseUrl + '";\n',

    // ── load config then render ──
    'fetch(BASE_URL + "/api/config/" + brandId)\n',
    '  .then(function(r){ return r.json(); })\n',
    '  .then(function(cfg){ renderWidget(container, brandId, cfg, BASE_URL); })\n',
    '  .catch(function(e){ console.error("NextClick widget error:", e); });\n',
    '})();\n\n',

    // ════════════════════════════════
    // renderWidget
    // ════════════════════════════════
    'function renderWidget(container, brandId, config, baseUrl){\n',
    '  var d    = config.design;\n',
    '  var copy = config.copy;\n',
    '  var plan = config.plan;\n',

    // load font
    '  if (d.font_family && d.font_family !== "System") {\n',
    '    var fl = document.createElement("link");\n',
    '    fl.rel  = "stylesheet";\n',
    '    fl.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(d.font_family) + ":wght@300;400;500;700;800&display=swap";\n',
    '    document.head.appendChild(fl);\n',
    '  }\n',
    '  var font = d.font_family || "DM Sans";\n',

    // inject CSS (built with string concatenation — NO backticks)
    '  var css = "";\n',
    '  css += ".nc-widget{background:" + d.color_bg + ";color:" + d.color_text + ";font-family:\'" + font + "\',sans-serif;max-width:680px;margin:0 auto;padding:32px 24px;border-radius:4px}";\n',
    '  css += ".nc-title{font-size:1.6rem;font-weight:800;margin-bottom:8px;color:" + d.color_text + "}";\n',
    '  css += ".nc-sub{font-size:.9rem;opacity:.7;margin-bottom:28px;line-height:1.6}";\n',
    '  css += ".nc-step{display:none}";\n',
    '  css += ".nc-step.active{display:block}";\n',
    '  css += ".nc-question{font-size:1rem;font-weight:700;margin-bottom:16px}";\n',
    '  css += ".nc-input{width:100%;padding:12px;border:1px solid rgba(0,0,0,.15);background:rgba(255,255,255,.05);color:" + d.color_text + ";font-family:\'" + font + "\',sans-serif;font-size:.9rem;border-radius:4px;outline:none;margin-bottom:12px}";\n',
    '  css += ".nc-input:focus{border-color:" + d.color_primary + "}";\n',
    '  css += ".nc-textarea{min-height:100px;resize:vertical}";\n',
    '  css += ".nc-btn{display:inline-block;padding:12px 28px;background:" + d.color_button + ";color:" + d.color_bg + ";font-family:\'" + font + "\',sans-serif;font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;border:none;cursor:pointer;border-radius:4px;text-decoration:none}";\n',
    '  css += ".nc-btn:hover{opacity:.88}";\n',
    '  css += ".nc-btn-outline{background:transparent;border:1px solid " + d.color_button + ";color:" + d.color_button + ";margin-right:8px}";\n',
    '  css += ".nc-loading{text-align:center;padding:40px}";\n',
    '  css += ".nc-spinner{width:40px;height:40px;border:3px solid rgba(0,0,0,.1);border-top-color:" + d.color_primary + ";border-radius:50%;animation:nc-spin 1s linear infinite;margin:0 auto 16px}";\n',
    '  css += "@keyframes nc-spin{to{transform:rotate(360deg)}}";\n',
    '  css += ".nc-routine{line-height:1.8;margin-bottom:24px}";\n',
    '  css += ".nc-section{background:rgba(0,0,0,.05);border-left:3px solid " + d.color_primary + ";padding:16px;margin-bottom:16px;border-radius:0 4px 4px 0}";\n',
    '  css += ".nc-section-title{font-weight:700;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:" + d.color_primary + ";margin-bottom:8px}";\n',
    '  css += ".nc-products{display:grid;gap:12px;margin-top:24px}";\n',
    '  css += ".nc-product{border:1px solid rgba(0,0,0,.1);padding:16px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;gap:12px}";\n',
    '  css += ".nc-product-name{font-weight:700;font-size:.9rem}";\n',
    '  css += ".nc-product-reason{font-size:.78rem;opacity:.7;margin-top:4px}";\n',
    '  css += ".nc-product-price{font-size:1rem;font-weight:700;color:" + d.color_primary + ";white-space:nowrap}";\n',
    '  css += ".nc-product-cta{padding:8px 16px;background:" + d.color_button + ";color:" + d.color_bg + ";font-size:.7rem;font-weight:700;text-decoration:none;border-radius:4px;letter-spacing:.08em;text-transform:uppercase}";\n',
    '  css += ".nc-error{background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.3);color:#ff4444;padding:14px;border-radius:4px;font-size:.88rem}";\n',
    '  css += ".nc-limit{background:rgba(255,200,40,.1);border:1px solid rgba(255,200,40,.3);color:#cc9900;padding:14px;border-radius:4px;font-size:.88rem}";\n',

    '  var style = document.createElement("style");\n',
    '  style.textContent = css;\n',
    '  document.head.appendChild(style);\n',

    // state + questions
    '  var state = {step:0, profile:{}, description:"", budgetMax:null};\n',
    '  var questions = getQuestions(config.category, config.language);\n',

    // HTML skeleton
    '  container.innerHTML =\n',
    '    \'<div class="nc-widget" id="nc-\' + brandId + \'">\' +\n',
    '    \'  <div id="nc-step-intro" class="nc-step active">\' +\n',
    '    \'    <div class="nc-title">\' + copy.title + \'</div>\' +\n',
    '    \'    <div class="nc-sub">\' + copy.subtitle + \'</div>\' +\n',
    '    \'    <button class="nc-btn" onclick="ncStart(\\"\' + brandId + \'\\")">\' + copy.cta + \'</button>\' +\n',
    '    \'  </div>\' +\n',
    '    \'  <div id="nc-step-q" class="nc-step"></div>\' +\n',
    '    \'  <div id="nc-step-loading" class="nc-step">\' +\n',
    '    \'    <div class="nc-loading"><div class="nc-spinner"></div>\' +\n',
    '    \'    <p style="opacity:.6;font-size:.9rem">Sto preparando i tuoi consigli\u2026</p></div>\' +\n',
    '    \'  </div>\' +\n',
    '    \'  <div id="nc-step-result" class="nc-step"></div>\' +\n',
    '    \'</div>\';\n',

    '  window["ncStart"] = function(bid){\n',
    '    if (bid !== brandId) return;\n',
    '    state.step = 0;\n',
    '    showQuestion(brandId, questions, state, baseUrl, plan, config);\n',
    '  };\n',
    '}\n\n',

    // ════════════════════════════════
    // getQuestions
    // ════════════════════════════════
    'function getQuestions(category){\n',
    '  var q = {\n',
    '    beauty:[\n',
    '      {key:"skin_type", q:"Qual \\u00e8 il tuo tipo di pelle?", type:"choice", opts:["Secca","Grassa","Mista","Sensibile","Normale"]},\n',
    '      {key:"concern",   q:"Qual \\u00e8 la tua principale preoccupazione?", type:"choice", opts:["Idratazione","Imperfezioni","Anti-et\\u00e0","Uniformit\\u00e0","Rossori"]},\n',
    '      {key:"description", q:"Raccontaci di pi\\u00f9 (allergie, esigenze specifiche...)", type:"textarea"}\n',
    '    ],\n',
    '    skincare:[\n',
    '      {key:"skin_type", q:"Che tipo di pelle hai?", type:"choice", opts:["Secca","Grassa","Mista","Sensibile","Normale","Matura"]},\n',
    '      {key:"goal",      q:"Qual \\u00e8 il tuo obiettivo principale?", type:"choice", opts:["Idratazione","Anti-et\\u00e0","Acne","Luminosit\\u00e0","Protezione","Uniformit\\u00e0"]},\n',
    '      {key:"description", q:"Aggiungi dettagli utili", type:"textarea"}\n',
    '    ],\n',
    '    nutrition:[\n',
    '      {key:"goal",      q:"Qual \\u00e8 il tuo obiettivo?", type:"choice", opts:["Perdere peso","Massa muscolare","Energia","Benessere generale","Recupero sportivo"]},\n',
    '      {key:"diet",      q:"Segui una dieta particolare?", type:"choice", opts:["Nessuna","Vegetariana","Vegana","Senza glutine","Senza lattosio","Keto"]},\n',
    '      {key:"description", q:"Descrivi le tue esigenze", type:"textarea"}\n',
    '    ],\n',
    '    baby:[\n',
    '      {key:"age",       q:"Quanti anni ha il bambino?", type:"choice", opts:["0-6 mesi","6-12 mesi","1-3 anni","3-6 anni","6+ anni"]},\n',
    '      {key:"concern",   q:"Qual \\u00e8 la preoccupazione principale?", type:"choice", opts:["Pelle secca","Dermatite","Protezione solare","Igiene delicata","Capelli fini"]},\n',
    '      {key:"description", q:"Note aggiuntive (allergie, ecc.)", type:"textarea"}\n',
    '    ],\n',
    '    pet:[\n',
    '      {key:"animal",    q:"Che tipo di animale hai?", type:"choice", opts:["Cane","Gatto","Coniglio","Altro"]},\n',
    '      {key:"concern",   q:"Qual \\u00e8 il bisogno principale?", type:"choice", opts:["Nutrizione","Cura del pelo","Integratori","Igiene","Problemi digestivi"]},\n',
    '      {key:"description", q:"Descrivi la situazione", type:"textarea"}\n',
    '    ],\n',
    '    haircare:[\n',
    '      {key:"hair_type", q:"Che tipo di capelli hai?", type:"choice", opts:["Lisci","Mossi","Ricci","Crespi","Fini","Spessi"]},\n',
    '      {key:"concern",   q:"Qual \\u00e8 il tuo problema principale?", type:"choice", opts:["Secchezza","Forfora","Caduta","Crespo","Danni da calore","Colore sbiadito"]},\n',
    '      {key:"description", q:"Descrivi la tua routine attuale", type:"textarea"}\n',
    '    ],\n',
    '    wellness:[\n',
    '      {key:"goal",      q:"Qual \\u00e8 il tuo obiettivo?", type:"choice", opts:["Stress","Sonno","Energia","Immunit\\u00e0","Digestione","Equilibrio ormonale"]},\n',
    '      {key:"lifestyle", q:"Come descrivi il tuo stile di vita?", type:"choice", opts:["Sedentario","Attivo","Molto attivo","Stressante","Equilibrato"]},\n',
    '      {key:"description", q:"Aggiungi dettagli utili", type:"textarea"}\n',
    '    ],\n',
    '    fitness:[\n',
    '      {key:"goal",      q:"Qual \\u00e8 il tuo obiettivo fitness?", type:"choice", opts:["Perdere peso","Massa muscolare","Resistenza","Flessibilit\\u00e0","Recupero","Mantenimento"]},\n',
    '      {key:"level",     q:"Qual \\u00e8 il tuo livello?", type:"choice", opts:["Principiante","Intermedio","Avanzato"]},\n',
    '      {key:"description", q:"Descrivi la tua situazione attuale", type:"textarea"}\n',
    '    ]\n',
    '  };\n',
    '  return q[category] || q.beauty;\n',
    '}\n\n',

    // ════════════════════════════════
    // showQuestion
    // ════════════════════════════════
    'function showQuestion(brandId, questions, state, baseUrl, plan, config){\n',
    '  var q      = questions[state.step];\n',
    '  var stepEl = document.getElementById("nc-step-q");\n',
    '  var introEl= document.getElementById("nc-step-intro");\n',
    '  var isLast = state.step === questions.length - 1;\n',
    '  if (introEl) introEl.classList.remove("active");\n',
    '  stepEl.classList.add("active");\n',

    '  var progress = questions.map(function(_,i){\n',
    '    var color = (i <= state.step) ? config.design.color_primary : "rgba(0,0,0,.15)";\n',
    '    return \'<div style="flex:1;height:3px;background:\' + color + \';border-radius:2px"></div>\';\n',
    '  }).join("");\n',

    '  var inputHtml = "";\n',
    '  if (q.type === "choice") {\n',
    '    inputHtml = q.opts.map(function(o){\n',
    '      return \'<button class="nc-btn nc-btn-outline" style="margin:4px" \' +\n',
    '             \'onclick="ncAnswer(\\"\' + brandId + \'\\",(\\"\' + q.key + \'\\"),(\\"\' + o + \'\\"))">\' + o + \'</button>\';\n',
    '    }).join("");\n',
    '  } else {\n',
    '    inputHtml =\n',
    '      \'<textarea class="nc-input nc-textarea" id="nc-desc" placeholder="Scrivi qui..."></textarea>\' +\n',
    '      \'<button class="nc-btn" onclick="ncSubmitText(\\"\' + brandId + \'\\",(\\"\' + q.key + \'\\"))">\' +\n',
    '      (isLast ? "Genera \\u2192" : "Avanti \\u2192") + \'</button>\';\n',
    '  }\n',

    '  var backBtn = state.step > 0\n',
    '    ? \'<div style="margin-top:16px"><button class="nc-btn nc-btn-outline" onclick="ncBack(\\"\' + brandId + \'\\")">\u2190 Indietro</button></div>\'\n',
    '    : "";\n',

    '  stepEl.innerHTML =\n',
    '    \'<div style="display:flex;gap:6px;margin-bottom:24px">\' + progress + \'</div>\' +\n',
    '    \'<div class="nc-question">\' + q.q + \'</div>\' +\n',
    '    \'<div>\' + inputHtml + \'</div>\' +\n',
    '    backBtn;\n',

    '  window["ncAnswer"] = function(bid, key, val){\n',
    '    if (bid !== brandId) return;\n',
    '    state.profile[key] = val;\n',
    '    if (key === "description") state.description = val;\n',
    '    state.step++;\n',
    '    if (state.step >= questions.length) ncGenerate(brandId, state, baseUrl, plan, config);\n',
    '    else showQuestion(brandId, questions, state, baseUrl, plan, config);\n',
    '  };\n',

    '  window["ncSubmitText"] = function(bid, key){\n',
    '    if (bid !== brandId) return;\n',
    '    var el  = document.getElementById("nc-desc");\n',
    '    var val = el ? el.value : "";\n',
    '    if (key === "description") state.description = val;\n',
    '    else state.profile[key] = val;\n',
    '    state.step++;\n',
    '    if (state.step >= questions.length) ncGenerate(brandId, state, baseUrl, plan, config);\n',
    '    else showQuestion(brandId, questions, state, baseUrl, plan, config);\n',
    '  };\n',

    '  window["ncBack"] = function(bid){\n',
    '    if (bid !== brandId) return;\n',
    '    state.step = Math.max(0, state.step - 1);\n',
    '    showQuestion(brandId, questions, state, baseUrl, plan, config);\n',
    '  };\n',
    '}\n\n',

    // ════════════════════════════════
    // ncGenerate
    // ════════════════════════════════
    'function ncGenerate(brandId, state, baseUrl, plan, config){\n',
    '  var qEl = document.getElementById("nc-step-q");\n',
    '  var lEl = document.getElementById("nc-step-loading");\n',
    '  if (qEl) qEl.classList.remove("active");\n',
    '  if (lEl) lEl.classList.add("active");\n',

    '  fetch(baseUrl + "/api/generate", {\n',
    '    method: "POST",\n',
    '    headers: {"Content-Type": "application/json"},\n',
    '    body: JSON.stringify({\n',
    '      brand_id:   brandId,\n',
    '      profile:    state.profile,\n',
    '      description:state.description,\n',
    '      budget_max: state.budgetMax\n',
    '    })\n',
    '  })\n',
    '  .then(function(r){ return r.json(); })\n',
    '  .then(function(data){\n',
    '    if (lEl) lEl.classList.remove("active");\n',
    '    var rEl = document.getElementById("nc-step-result");\n',
    '    rEl.classList.add("active");\n',

    '    if (data.error) {\n',
    '      var cls = data.code === "generations_limit" ? "nc-limit" : "nc-error";\n',
    '      var msg = data.code === "generations_limit"\n',
    '        ? "Limite di generazioni raggiunto per questo mese."\n',
    '        : data.error;\n',
    '      rEl.innerHTML = \'<div class="\' + cls + \'">\' + msg + \'</div>\' +\n',
    '        \'<button class="nc-btn" style="margin-top:16px" onclick="location.reload()">\u21ba Riprova</button>\';\n',
    '      return;\n',
    '    }\n',

    '    var html = "";\n',
    '    if (plan === "advisor" && data.routine) html += renderRoutine(data.routine, config.design.color_primary);\n',

    '    if (data.products && data.products.length > 0) {\n',
    '      html += \'<div style="font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin-top:24px;margin-bottom:12px">Prodotti consigliati</div>\';\n',
    '      html += \'<div class="nc-products">\';\n',
    '      data.products.forEach(function(p){\n',
    '        html += \'<div class="nc-product">\';\n',
    '        html += \'<div><div class="nc-product-name">\' + (p.nome||"") + \'</div>\';\n',
    '        html += \'<div class="nc-product-reason">\' + (p.motivo||"") + \'</div></div>\';\n',
    '        html += \'<div style="display:flex;align-items:center;gap:12px">\';\n',
    '        if (p.prezzo) html += \'<div class="nc-product-price">\' + p.prezzo + \'</div>\';\n',
    '        if (p.url)    html += \'<a class="nc-product-cta" href="\' + p.url + \'" target="_blank" rel="noopener">Vedi \u2192</a>\';\n',
    '        html += \'</div></div>\';\n',
    '      });\n',
    '      html += \'</div>\';\n',
    '    }\n',

    '    html += \'<div style="margin-top:24px"><button class="nc-btn nc-btn-outline" onclick="ncRestart(\\"\' + brandId + \'\\")">\u21ba Ricomincia</button></div>\';\n',
    '    rEl.innerHTML = html;\n',

    '    window["ncRestart"] = function(bid){\n',
    '      if (bid !== brandId) return;\n',
    '      state.step = 0; state.profile = {}; state.description = "";\n',
    '      var rr = document.getElementById("nc-step-result");\n',
    '      var ii = document.getElementById("nc-step-intro");\n',
    '      if (rr) rr.classList.remove("active");\n',
    '      if (ii) ii.classList.add("active");\n',
    '    };\n',
    '  })\n',
    '  .catch(function(){\n',
    '    if (lEl) lEl.classList.remove("active");\n',
    '    var rEl = document.getElementById("nc-step-result");\n',
    '    rEl.classList.add("active");\n',
    '    rEl.innerHTML = \'<div class="nc-error">Errore di connessione. Riprova.</div>\' +\n',
    '      \'<button class="nc-btn" style="margin-top:16px" onclick="ncRestart(\\"\' + brandId + \'\\")">\u21ba Riprova</button>\';\n',
    '  });\n',
    '}\n\n',

    // ════════════════════════════════
    // renderRoutine
    // ════════════════════════════════
    'function renderRoutine(text, primaryColor){\n',
    '  var sections = text.split(/^## /m).filter(function(s){ return s.trim(); });\n',
    '  var html = \'<div class="nc-routine">\';\n',
    '  sections.forEach(function(sec){\n',
    '    var lines = sec.split("\\n");\n',
    '    var title = lines[0].trim();\n',
    '    var body  = lines.slice(1).join("\\n").trim()\n',
    '      .replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>")\n',
    '      .replace(/\\n/g, "<br>");\n',
    '    html += \'<div class="nc-section"><div class="nc-section-title">\' + title + \'</div><div>\' + body + \'</div></div>\';\n',
    '  });\n',
    '  html += \'</div>\';\n',
    '  return html;\n',
    '}\n',
  ].join('');
}

module.exports = router;
