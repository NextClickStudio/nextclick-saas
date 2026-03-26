import React, { useState } from 'react';
import {
  Page, Card, Button, Text, BlockStack, InlineStack,
  Select, TextField, Badge, Banner, ProgressBar, Box, Spinner
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const STEPS = [
  { id: 'plan',     title: 'Scegli il Piano',   emoji: '💳' },
  { id: 'category', title: 'Categoria Brand',    emoji: '🏷️' },
  { id: 'design',   title: 'Design & Colori',    emoji: '🎨' },
  { id: 'products', title: 'Prodotti',           emoji: '📦' },
  { id: 'ai',       title: 'AI Persona',         emoji: '🤖' },
];

const PLANS = [
  {
    key: 'starter', name: 'Starter', price: '$49/mese', color: '#006494',
    generations: '1.000 generazioni/mese',
    features: ['Prodotti consigliati', 'Widget embeddabile', 'Analytics base', '7 giorni gratis'],
    missing: ['Routine completa', 'PDF download', 'AI auto-tagging'],
  },
  {
    key: 'pro', name: 'Pro', price: '$199/mese', color: '#8B2FC9', recommended: true,
    generations: '10.000 generazioni/mese',
    features: ['Routine completa + prodotti', 'PDF download', 'AI auto-tagging', 'AI Persona', 'Analytics avanzate', '7 giorni gratis'],
    missing: [],
  },
  {
    key: 'scale', name: 'Scale', price: '$499/mese', color: '#1A7A4A',
    generations: '100.000 generazioni/mese',
    features: ['Tutto il piano Pro', '100k generazioni/mese', 'Supporto prioritario', 'Export CSV'],
    missing: [],
  },
];

const CATEGORIES = [
  { value: 'beauty',    label: '💄 Beauty & Skincare' },
  { value: 'nutrition', label: '💊 Nutrizione & Integratori' },
  { value: 'baby',      label: '👶 Baby & Neonati' },
  { value: 'pet',       label: '🐾 Pet Food & Cura animali' },
  { value: 'wellness',  label: '🧘 Wellness & Benessere' },
  { value: 'fitness',   label: '🏋️ Fitness & Sport' },
];

const FONTS = ['Inter','Poppins','Playfair Display','Fraunces','DM Sans','Syne','Montserrat','Raleway'];

export function OnboardingWizard({ shop }) {
  const [step, setStep]               = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [category, setCategory]       = useState('beauty');
  const [design, setDesign]           = useState({
    brandName: '', logoUrl: '',
    primaryColor: '#0A0A0A', secondaryColor: '#00E676',
    bgColor: '#FFFFFF', textColor: '#0A0A0A',
    buttonColor: '#0A0A0A', buttonTextColor: '#FFFFFF',
    fontFamily: 'Inter', borderRadius: '8px',
  });
  const [syncing, setSyncing]         = useState(false);
  const [synced, setSynced]           = useState(false);
  const [aiPersona, setAiPersona]     = useState('Sei un esperto consulente. Fornisci consigli personalizzati basati sulle esigenze specifiche del cliente.');
  const [aiTone, setAiTone]           = useState('professionale');

  const progress = (step / STEPS.length) * 100;

  async function handleSubscribe() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/billing/subscribe', { planName: selectedPlan });
      if (data.confirmationUrl) {
        // ✅ FIX: never use window.top inside Shopify iframe — SecurityError
        // Use window.open for external URLs, location for same-origin
        if (data.confirmationUrl.startsWith('/')) {
          window.location.href = data.confirmationUrl;
        } else {
          // Shopify billing confirmation — must do top-level nav
          // Try safely, fallback to postMessage
          try {
            window.location.href = data.confirmationUrl;
          } catch (e) {
            window.parent.postMessage(
              JSON.stringify({
                message: 'Shopify.API.remoteRedirect',
                data: { location: data.confirmationUrl },
              }),
              'https://admin.shopify.com'
            );
          }
        }
      } else {
        // Plan activated directly (custom/dev app)
        window.location.reload();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Errore durante la sottoscrizione');
      setLoading(false);
    }
  }

  async function handleSyncProducts() {
    setSyncing(true);
    setError('');
    try {
      const { data } = await api.post('/products/sync');
      setSynced(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Errore sincronizzazione prodotti. Riprova.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleFinish() {
    setLoading(true);
    try {
      await api.patch('/config', { category, ...design, aiPersona, aiTone });
      window.location.reload();
    } catch {
      setError('Errore nel salvataggio');
      setLoading(false);
    }
  }

  function next() {
    if (step === 0) { handleSubscribe(); return; }
    setStep(s => s + 1);
  }
  function prev() { setStep(s => Math.max(0, s - 1)); }

  return (
    <div style={{ minHeight: '100vh', background: '#F6F6F7' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text variant="heading2xl" as="h1">⚡ NextClick Studio</Text>
          <div style={{ marginTop: 8 }}>
            <Text variant="bodyLg" tone="subdued">
              {STEPS[step].emoji} {STEPS[step].title}
            </Text>
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 32 }}>
          <ProgressBar progress={progress} size="small" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {STEPS.map((s, i) => (
              <Text key={s.id} variant="bodySm" tone={i <= step ? 'base' : 'subdued'}>
                {i + 1}. {s.title}
              </Text>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 16 }}>
            <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>
          </div>
        )}

        {/* STEP 0: PIANO */}
        {step === 0 && (
          <BlockStack gap="400">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {PLANS.map(plan => (
                <div
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  style={{
                    cursor: 'pointer', borderRadius: 12, padding: 20, position: 'relative',
                    background: '#fff',
                    border: selectedPlan === plan.key ? `3px solid ${plan.color}` : '3px solid #E4E5E7',
                    boxShadow: selectedPlan === plan.key ? `0 0 0 2px ${plan.color}22` : 'none',
                  }}
                >
                  {plan.recommended && (
                    <div style={{
                      position: 'absolute', top: -12, right: 16,
                      background: '#008060', color: '#fff',
                      borderRadius: 99, padding: '2px 12px', fontSize: 11, fontWeight: 700,
                    }}>
                      ⭐ Consigliato
                    </div>
                  )}
                  <BlockStack gap="200">
                    <Text variant="headingLg" fontWeight="bold">{plan.name}</Text>
                    <div style={{ fontSize: 26, fontWeight: 800, color: plan.color }}>{plan.price}</div>
                    <Text variant="bodySm" tone="subdued">{plan.generations}</Text>
                    <div style={{ borderTop: '1px solid #E4E5E7', paddingTop: 12, marginTop: 4 }}>
                      {plan.features.map(f => <div key={f} style={{ fontSize: 13, marginBottom: 4 }}>✅ {f}</div>)}
                      {plan.missing.map(f => <div key={f} style={{ fontSize: 13, color: '#8C9196', marginBottom: 4 }}>❌ {f}</div>)}
                    </div>
                  </BlockStack>
                </div>
              ))}
            </div>
            <Card>
              <Text variant="bodySm" tone="subdued">
                💳 Verrai reindirizzato a Shopify per confermare il pagamento. Hai 7 giorni di prova gratuita.
              </Text>
            </Card>
          </BlockStack>
        )}

        {/* STEP 1: CATEGORIA */}
        {step === 1 && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg">In quale settore opera il tuo brand?</Text>
              <Text tone="subdued">Questo aiuta l'AI a usare il linguaggio e le competenze giuste.</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {CATEGORIES.map(cat => (
                  <div
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    style={{
                      padding: 16, textAlign: 'center', cursor: 'pointer', borderRadius: 8,
                      border: category === cat.value ? '2px solid #008060' : '2px solid #E4E5E7',
                      background: category === cat.value ? '#F0FFF4' : '#FFF',
                      fontSize: 14,
                    }}
                  >
                    {cat.label}
                  </div>
                ))}
              </div>
            </BlockStack>
          </Card>
        )}

        {/* STEP 2: DESIGN */}
        {step === 2 && (
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg">Nome Brand e Logo</Text>
                <TextField label="Nome del brand" value={design.brandName} onChange={v => setDesign(d => ({ ...d, brandName: v }))} placeholder="es. Salted Beauty" />
                <TextField label="URL Logo" value={design.logoUrl} onChange={v => setDesign(d => ({ ...d, logoUrl: v }))} placeholder="https://..." helpText="Carica su Shopify > Content > Files, poi incolla URL" />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingLg">Colori</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { key: 'primaryColor', label: 'Colore Primario' },
                    { key: 'secondaryColor', label: 'Accento / CTA' },
                    { key: 'bgColor', label: 'Sfondo' },
                    { key: 'textColor', label: 'Testo' },
                    { key: 'buttonColor', label: 'Sfondo Pulsante' },
                    { key: 'buttonTextColor', label: 'Testo Pulsante' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="color" value={design[key]} onChange={e => setDesign(d => ({ ...d, [key]: e.target.value }))}
                          style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                        <TextField value={design[key]} onChange={v => setDesign(d => ({ ...d, [key]: v }))} monospaced />
                      </div>
                    </div>
                  ))}
                </div>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingLg">Font & Stile</Text>
                <Select label="Font" options={FONTS.map(f => ({ label: f, value: f }))} value={design.fontFamily} onChange={v => setDesign(d => ({ ...d, fontFamily: v }))} />
                <Select label="Arrotondamento bordi" value={design.borderRadius} onChange={v => setDesign(d => ({ ...d, borderRadius: v }))} options={[
                  { label: 'Nessuno (0px)', value: '0px' },
                  { label: 'Leggero (4px)', value: '4px' },
                  { label: 'Medio (8px)', value: '8px' },
                  { label: 'Grande (16px)', value: '16px' },
                  { label: 'Pillola (999px)', value: '999px' },
                ]} />
              </BlockStack>
            </Card>
          </BlockStack>
        )}

        {/* STEP 3: PRODOTTI */}
        {step === 3 && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg">Sincronizza i tuoi prodotti</Text>
              <Text tone="subdued">Importiamo automaticamente tutti i prodotti dal tuo store Shopify.</Text>
              {!synced ? (
                <BlockStack gap="300">
                  <Banner tone="info"><p>Verranno importati: titolo, prezzo, immagini, tag e descrizione.</p></Banner>
                  <Button variant="primary" size="large" loading={syncing} onClick={handleSyncProducts}>
                    {syncing ? 'Sincronizzazione in corso...' : '📦 Sincronizza tutti i prodotti'}
                  </Button>
                  <Button variant="secondary" onClick={() => { setSynced(true); }}>
                    Salta per ora →
                  </Button>
                </BlockStack>
              ) : (
                <Banner tone="success"><p>✅ Prodotti sincronizzati! Potrai gestirli dalla sezione Prodotti.</p></Banner>
              )}
            </BlockStack>
          </Card>
        )}

        {/* STEP 4: AI PERSONA */}
        {step === 4 && (
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg">Come deve parlare la tua AI?</Text>
                <Select label="Tono di voce" value={aiTone} onChange={setAiTone} options={[
                  { label: '👔 Professionale', value: 'professionale' },
                  { label: '😊 Amichevole', value: 'amichevole' },
                  { label: '🩺 Clinico e scientifico', value: 'medico' },
                  { label: '✨ Premium e luxury', value: 'luxury' },
                  { label: '💪 Energico e motivazionale', value: 'energico' },
                ]} />
                <TextField
                  label="Istruzioni per l'AI"
                  value={aiPersona}
                  onChange={setAiPersona}
                  multiline={5}
                  placeholder="Descrivi il ruolo e le regole che l'AI deve seguire..."
                  helpText="L'AI seguirà queste istruzioni per ogni raccomandazione generata."
                />
              </BlockStack>
            </Card>
          </BlockStack>
        )}

        {/* Navigation */}
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={prev} disabled={step === 0 || loading}>← Indietro</Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={next} loading={loading}>
              {step === 0 ? '💳 Abbonati e continua →' : 'Continua →'}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleFinish} loading={loading}>
              🚀 Completa setup e vai alla dashboard
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
