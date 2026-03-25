import React, { useState, useEffect } from 'react';
import {
  Page, Card, BlockStack, Text, TextField, Button,
  InlineStack, Select, Badge, Banner
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const DEFAULT_FLOW = [
  {
    id: 'goal', title: 'Qual è il tuo obiettivo principale?', type: 'multi',
    options: ['Idratazione', 'Anti-età', 'Luminosità', 'Imperfezioni', 'Lenitivo'],
  },
  {
    id: 'skintype', title: 'Qual è il tuo tipo di pelle?', type: 'single',
    options: ['Secca', 'Normale', 'Grassa', 'Mista', 'Sensibile'],
  },
  {
    id: 'budget', title: 'Qual è il tuo budget per prodotto?', type: 'single',
    options: ['Fino a €20', '€20-€40', '€40-€60', 'Oltre €60'],
  },
  {
    id: 'notes', title: 'Hai qualcosa di specifico da dirci?', type: 'text',
    placeholder: 'Allergie, preferenze, problemi particolari...',
  },
];

export function CopyEditor() {
  const [config, setConfig] = useState(null);
  const [flow, setFlow] = useState(DEFAULT_FLOW);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/config').then(({ data }) => {
      setConfig(data.config);
      if (data.config?.questionFlow && data.config.questionFlow.length > 0) {
        setFlow(data.config.questionFlow);
      }
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/config', {
        heroTitle: config.heroTitle,
        heroSubtitle: config.heroSubtitle,
        ctaText: config.ctaText,
        loadingText: config.loadingText,
        questionFlow: flow,
      });
      setToast('Testi salvati!');
    } catch {
      setToast('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  function updateConfig(key, val) {
    setConfig(c => ({ ...c, [key]: val }));
  }

  function updateStep(idx, key, val) {
    setFlow(f => f.map((s, i) => i === idx ? { ...s, [key]: val } : s));
  }

  function updateOption(stepIdx, optIdx, val) {
    setFlow(f => f.map((s, i) => {
      if (i !== stepIdx) return s;
      const opts = [...s.options];
      opts[optIdx] = val;
      return { ...s, options: opts };
    }));
  }

  function addOption(stepIdx) {
    setFlow(f => f.map((s, i) => i === stepIdx ? { ...s, options: [...(s.options || []), 'Nuova opzione'] } : s));
  }

  function removeOption(stepIdx, optIdx) {
    setFlow(f => f.map((s, i) => {
      if (i !== stepIdx) return s;
      return { ...s, options: s.options.filter((_, j) => j !== optIdx) };
    }));
  }

  function addStep() {
    setFlow(f => [...f, {
      id: `step_${Date.now()}`,
      title: 'Nuova domanda',
      type: 'single',
      options: ['Opzione 1', 'Opzione 2'],
    }]);
  }

  function removeStep(idx) {
    setFlow(f => f.filter((_, i) => i !== idx));
  }

  function moveStep(idx, dir) {
    setFlow(f => {
      const arr = [...f];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return arr;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  if (!config) return null;

  return (
      <Page
        title="Testi & Domande"
        primaryAction={{ content: saving ? 'Salvataggio...' : '💾 Salva', onAction: handleSave, loading: saving }}
      >
        <BlockStack gap="500">
        {toast && <Banner tone="success" onDismiss={() => setToast("")}><p>{toast}</p></Banner>}

          {/* General copy */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Testi generali</Text>
              <TextField label="Titolo hero" value={config.heroTitle || ''} onChange={v => updateConfig('heroTitle', v)} />
              <TextField label="Sottotitolo" value={config.heroSubtitle || ''} onChange={v => updateConfig('heroSubtitle', v)} />
              <TextField label="Testo pulsante principale" value={config.ctaText || ''} onChange={v => updateConfig('ctaText', v)} />
              <TextField
                label="Messaggio di caricamento"
                value={config.loadingText || ''}
                onChange={v => updateConfig('loadingText', v)}
                helpText="Mostrato mentre l'AI genera la risposta"
              />
            </BlockStack>
          </Card>

          {/* Question flow */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd">Domande del form</Text>
                <Badge>{flow.length} domande</Badge>
              </InlineStack>
              <Banner tone="info">
                <p>Queste sono le domande che verranno mostrate ai tuoi clienti. L'ordine conta — trascina per riorganizzare.</p>
              </Banner>

              {flow.map((step, idx) => (
                <div key={step.id} style={{ border: '1px solid #E4E5E7', borderRadius: 8, padding: 16 }}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Badge>Step {idx + 1}</Badge>
                      <InlineStack gap="200">
                        <Button size="slim" onClick={() => moveStep(idx, -1)} disabled={idx === 0}>↑</Button>
                        <Button size="slim" onClick={() => moveStep(idx, 1)} disabled={idx === flow.length - 1}>↓</Button>
                        <Button size="slim" tone="critical" onClick={() => removeStep(idx)}>✕</Button>
                      </InlineStack>
                    </InlineStack>

                    <TextField
                      label="Domanda"
                      value={step.title}
                      onChange={v => updateStep(idx, 'title', v)}
                    />

                    <Select
                      label="Tipo di risposta"
                      options={[
                        { label: 'Scelta singola', value: 'single' },
                        { label: 'Scelta multipla', value: 'multi' },
                        { label: 'Testo libero', value: 'text' },
                        { label: 'Slider (numerico)', value: 'slider' },
                      ]}
                      value={step.type}
                      onChange={v => updateStep(idx, 'type', v)}
                    />

                    {(step.type === 'single' || step.type === 'multi') && (
                      <BlockStack gap="200">
                        <Text variant="bodySm" fontWeight="semibold">Opzioni di risposta</Text>
                        {(step.options || []).map((opt, optIdx) => (
                          <InlineStack key={optIdx} gap="200" blockAlign="center" wrap={false}>
                            <div style={{ flex: 1 }}>
                              <TextField
                                value={opt}
                                onChange={v => updateOption(idx, optIdx, v)}
                                autoComplete="off"
                              />
                            </div>
                            <Button size="slim" onClick={() => removeOption(idx, optIdx)}>✕</Button>
                          </InlineStack>
                        ))}
                        <Button size="slim" onClick={() => addOption(idx)}>+ Aggiungi opzione</Button>
                      </BlockStack>
                    )}

                    {step.type === 'text' && (
                      <TextField
                        label="Testo placeholder"
                        value={step.placeholder || ''}
                        onChange={v => updateStep(idx, 'placeholder', v)}
                      />
                    )}
                  </BlockStack>
                </div>
              ))}

              <Button onClick={addStep} variant="secondary">+ Aggiungi domanda</Button>
            </BlockStack>
          </Card>

        </BlockStack>
      </Page>
  );
}
