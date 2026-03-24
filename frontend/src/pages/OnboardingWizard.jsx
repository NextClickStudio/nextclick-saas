import React, { useState } from 'react';
import {
  Page, Card, Button, ButtonGroup, Text, BlockStack, InlineStack,
  Select, TextField, ColorPicker, Badge, Banner, ProgressBar,
  Grid, Box, Thumbnail, Spinner, RadioButton
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const STEPS = [
  { id: 'plan',     title: 'Scegli il Piano',        emoji: '💳' },
  { id: 'category', title: 'Categoria Brand',         emoji: '🏷️' },
  { id: 'design',   title: 'Design & Colori',         emoji: '🎨' },
  { id: 'products', title: 'Prodotti',                emoji: '📦' },
  { id: 'ai',       title: 'AI Persona',              emoji: '🤖' },
];

const PLANS = {
  starter: {
    name: 'Starter', price: '$49/mese', color: '#006494',
    generations: '1.000 generazioni/mese',
    features: ['Prodotti consigliati', 'Widget embeddabile', 'Analytics base', '7 giorni di prova gratuita'],
    notIncluded: ['Routine completa', 'PDF download', 'AI auto-tagging'],
  },
  pro: {
    name: 'Pro', price: '$199/mese', color: '#8B2FC9',
    generations: '10.000 generazioni/mese',
    features: ['Routine completa + prodotti', 'PDF download', 'AI auto-tagging', 'AI Persona personalizzata', 'Analytics avanzate', '7 giorni di prova gratuita'],
    notIncluded: [],
    recommended: true,
  },
  scale: {
    name: 'Scale', price: '$499/mese', color: '#1A7A4A',
    generations: '100.000 generazioni/mese',
    features: ['Tutto il piano Pro', '100k generazioni/mese', 'Supporto prioritario', 'Export CSV'],
    notIncluded: [],
  },
};

const CATEGORIES = [
  { value: 'beauty', label: '💄 Beauty & Skincare' },
  { value: 'nutrition', label: '💊 Nutrizione & Integratori' },
  { value: 'baby', label: '👶 Baby & Neonati' },
  { value: 'pet', label: '🐾 Pet Food & Cura animali' },
  { value: 'wellness', label: '🧘 Wellness & Benessere' },
  { value: 'fitness', label: '🏋️ Fitness & Sport' },
];

const FONTS = ['Inter', 'Poppins', 'Playfair Display', 'Fraunces', 'DM Sans', 'Syne', 'Montserrat', 'Raleway'];

export function OnboardingWizard({ shop }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [category, setCategory] = useState('beauty');
  const [design, setDesign] = useState({
    brandName: '', logoUrl: '',
    primaryColor: '#0A0A0A', secondaryColor: '#00E676',
    bgColor: '#FFFFFF', textColor: '#0A0A0A',
    buttonColor: '#0A0A0A', buttonTextColor: '#FFFFFF',
    fontFamily: 'Inter', borderRadius: '8px',
  });
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [aiPersona, setAiPersona] = useState('Sei un esperto consulente. Fornisci consigli personalizzati basati sulle esigenze specifiche del cliente.');
  const [aiTone, setAiTone] = useState('professionale');

  const progress = ((step) / STEPS.length) * 100;

  async function handleSubscribe() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/billing/subscribe', { planName: selectedPlan });
      window.top.location.href = data.confirmationUrl;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore durante la sottoscrizione');
      setLoading(false);
    }
  }

  async function saveConfig() {
    await api.patch('/config', {
      category,
      ...design,
      aiPersona,
      aiTone,
    });
  }

  async function handleSyncProducts() {
    setSyncing(true);
    try {
      const { data } = await api.post('/products/sync');
      setSynced(true);
    } catch (err) {
      setError('Errore sincronizzazione prodotti');
    } finally {
      setSyncing(false);
    }
  }

  async function handleFinish() {
    setLoading(true);
    try {
      await saveConfig();
      window.location.reload();
    } catch (err) {
      setError('Errore nel salvataggio');
      setLoading(false);
    }
  }

  function nextStep() {
    if (step === 0) { handleSubscribe(); return; }
    setStep(s => s + 1);
  }

  function prevStep() { setStep(s => Math.max(0, s - 1)); }

  return (
    <div style={{ minHeight: '100vh', background: '#F6F6F7', padding: '40px 20px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text variant="heading2xl" as="h1">⚡ NextClick Studio</Text>
          <Text variant="bodyLg" tone="subdued">Setup del tuo AI Advisor — {STEPS[step].emoji} {STEPS[step].title}</Text>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 24 }}>
          <ProgressBar progress={progress} size="small" />
          <InlineStack align="space-between" gap="200" blockAlign="center" wrap={false}>
            {STEPS.map((s, i) => (
              <Text key={s.id} variant="bodySm" tone={i <= step ? 'base' : 'subdued'}>
                {i + 1}. {s.title}
              </Text>
            ))}
          </InlineStack>
        </div>

        {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}

        {/* ── STEP 0: PIANO ── */}
        {step === 0 && (
          <BlockStack gap="400">
            <Grid columns={{ xs: 1, sm: 3 }} gap={{ xs: '400', sm: '400' }}>
              {Object.entries(PLANS).map(([key, plan]) => (
                <Card key={key}>
                  <div
                    onClick={() => setSelectedPlan(key)}
                    style={{
                      cursor: 'pointer',
                      padding: 20,
                      border: selectedPlan === key ? `3px solid ${plan.color}` : '3px solid transparent',
                      borderRadius: 12,
                      position: 'relative',
                    }}
                  >
                    {plan.recommended && (
                      <div style={{ position: 'absolute', top: -12, right: 16 }}>
                        <Badge tone="success">Consigliato</Badge>
                      </div>
                    )}
                    <BlockStack gap="200">
                      <Text variant="headingLg" as="h3" fontWeight="bold">{plan.name}</Text>
                      <Text variant="heading2xl" as="p" fontWeight="bold" style={{ color: plan.color }}>{plan.price}</Text>
                      <Text variant="bodySm" tone="subdued">{plan.generations}</Text>
                      <div style={{ borderTop: '1px solid #E4E5E7', paddingTop: 12, marginTop: 8 }}>
                        {plan.features.map(f => (
                          <Text key={f} variant="bodySm" as="p">✅ {f}</Text>
                        ))}
                        {plan.notIncluded.map(f => (
                          <Text key={f} variant="bodySm" tone="subdued" as="p">❌ {f}</Text>
                        ))}
                      </div>
                    </BlockStack>
                  </div>
                </Card>
              ))}
            </Grid>
            <Card>
              <Text variant="bodySm" tone="subdued">
                💳 Verrai reindirizzato a Shopify per confermare il pagamento. Hai 7 giorni di prova gratuita.
                Il primo addebito avverrà solo dopo il trial.
              </Text>
            </Card>
          </BlockStack>
        )}

        {/* ── STEP 1: CATEGORIA ── */}
        {step === 1 && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg">In quale settore opera il tuo brand?</Text>
              <Text tone="subdued">Questo aiuta l'AI a usare il linguaggio e le competenze giuste.</Text>
              <Grid columns={{ xs: 2, sm: 3 }} gap={{ xs: '300', sm: '300' }}>
                {CATEGORIES.map(cat => (
                  <div
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    style={{
                      padding: 16, textAlign: 'center', cursor: 'pointer',
                      border: category === cat.value ? '2px solid #008060' : '2px solid #E4E5E7',
                      borderRadius: 8, background: category === cat.value ? '#F0FFF4' : '#FFF',
                    }}
                  >
                    <Text variant="bodyLg">{cat.label}</Text>
                  </div>
                ))}
              </Grid>
            </BlockStack>
          </Card>
        )}

        {/* ── STEP 2: DESIGN ── */}
        {step === 2 && (
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg">Nome Brand e Logo</Text>
                <TextField
                  label="Nome del brand"
                  value={design.brandName}
                  onChange={v => setDesign(d => ({ ...d, brandName: v }))}
                  placeholder="es. salted beauty"
                />
                <TextField
                  label="URL Logo (PNG trasparente consigliato)"
                  value={design.logoUrl}
                  onChange={v => setDesign(d => ({ ...d, logoUrl: v }))}
                  placeholder="https://tuosito.com/logo.png"
                  helpText="Carica il logo su Shopify > Content > Files e incolla l'URL qui"
                />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg">Colori</Text>
                <Grid columns={{ xs: 2, sm: 3 }} gap={{ xs: '300', sm: '300' }}>
                  {[
                    { key: 'primaryColor', label: 'Colore Primario' },
                    { key: 'secondaryColor', label: 'Accento / CTA' },
                    { key: 'bgColor', label: 'Sfondo' },
                    { key: 'textColor', label: 'Testo' },
                    { key: 'buttonColor', label: 'Sfondo Pulsante' },
                    { key: 'buttonTextColor', label: 'Testo Pulsante' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <Text variant="bodySm" fontWeight="semibold">{label}</Text>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <input
                          type="color"
                          value={design[key]}
                          onChange={e => setDesign(d => ({ ...d, [key]: e.target.value }))}
                          style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                        />
                        <TextField
                          value={design[key]}
                          onChange={v => setDesign(d => ({ ...d, [key]: v }))}
                          monospaced
                        />
                      </div>
                    </div>
                  ))}
                </Grid>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingLg">Font & Stile</Text>
                <Select
                  label="Font"
                  options={FONTS.map(f => ({ label: f, value: f }))}
                  value={design.fontFamily}
                  onChange={v => setDesign(d => ({ ...d, fontFamily: v }))}
                />
                <Select
                  label="Arrotondamento bordi"
                  options={[
                    { label: 'Nessuno (0px)', value: '0px' },
                    { label: 'Leggermente arrotondato (4px)', value: '4px' },
                    { label: 'Arrotondato (8px)', value: '8px' },
                    { label: 'Molto arrotondato (16px)', value: '16px' },
                    { label: 'Pillola (999px)', value: '999px' },
                  ]}
                  value={design.borderRadius}
                  onChange={v => setDesign(d => ({ ...d, borderRadius: v }))}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        )}

        {/* ── STEP 3: PRODOTTI ── */}
        {step === 3 && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg">Sincronizza i tuoi prodotti</Text>
              <Text tone="subdued">
                Importiamo automaticamente tutti i prodotti dal tuo store Shopify.
                L'AI li userà per fare raccomandazioni personalizzate.
              </Text>
              {!synced ? (
                <BlockStack gap="300">
                  <Banner tone="info">
                    <p>Verranno importati: titolo, prezzo, immagini, tag e descrizione di ogni prodotto.</p>
                  </Banner>
                  <Button
                    variant="primary"
                    size="large"
                    loading={syncing}
                    onClick={handleSyncProducts}
                  >
                    {syncing ? 'Sincronizzazione in corso...' : '📦 Sincronizza tutti i prodotti'}
                  </Button>
                </BlockStack>
              ) : (
                <BlockStack gap="300">
                  <Banner tone="success">
                    <p>✅ Prodotti sincronizzati! Potrai gestirli in dettaglio dalla sezione Prodotti dopo il setup.</p>
                  </Banner>
                  <Text tone="subdued">
                    Puoi anche selezionare prodotti specifici o lasciare che l'AI li scelga in automatico dal catalogo completo.
                  </Text>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        )}

        {/* ── STEP 4: AI PERSONA ── */}
        {step === 4 && (
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg">Come deve parlare la tua AI?</Text>
                <Text tone="subdued">
                  Descrivi come vuoi che l'intelligenza artificiale si comporti con i tuoi clienti.
                  Più sei preciso, più le risposte saranno in linea con il tuo brand.
                </Text>
                <Select
                  label="Tono di voce"
                  options={[
                    { label: '👔 Professionale', value: 'professionale' },
                    { label: '😊 Amichevole e informale', value: 'amichevole' },
                    { label: '🩺 Clinico e scientifico', value: 'medico' },
                    { label: '✨ Premium e luxury', value: 'luxury' },
                    { label: '💪 Energico e motivazionale', value: 'energico' },
                  ]}
                  value={aiTone}
                  onChange={setAiTone}
                />
                <TextField
                  label="Istruzioni per l'AI (descrivi liberamente)"
                  value={aiPersona}
                  onChange={setAiPersona}
                  multiline={5}
                  placeholder={`Esempi:
"Sei un dermatologo esperto. Parla con autorevolezza scientifica ma con parole semplici. Usa termini tecnici solo quando necessario e spiegali."

"Sei un nutrizionista sportivo con 10 anni di esperienza. Sei motivante e pratico. Dai sempre consigli concreti e timeframe realistici."`}
                  helpText="L'AI seguirà queste istruzioni per ogni raccomandazione generata."
                />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd">Anteprima risposta AI</Text>
                <div style={{
                  padding: 16, background: '#F6F6F7', borderRadius: 8,
                  fontStyle: 'italic', color: '#6D7175', fontSize: 14,
                }}>
                  "{aiPersona.slice(0, 150)}{aiPersona.length > 150 ? '...' : ''}"
                  <br /><br />
                  → Tono: <strong>{aiTone}</strong>
                </div>
              </BlockStack>
            </Card>
          </BlockStack>
        )}

        {/* Navigation buttons */}
        <div style={{ marginTop: 24 }}>
          <InlineStack align="space-between">
            <Button onClick={prevStep} disabled={step === 0 || loading}>
              ← Indietro
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                onClick={nextStep}
                loading={loading}
                disabled={step === 3 && !synced}
              >
                {step === 0 ? '💳 Abbonati e continua →' : 'Continua →'}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleFinish} loading={loading}>
                🚀 Completa setup e vai alla dashboard
              </Button>
            )}
          </InlineStack>
        </div>

      </div>
    </div>
  );
}
