import React, { useState, useEffect } from 'react';
import { Page, Card, BlockStack, Text, TextField, Button, InlineStack, Select, Badge, Banner } from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const DEFAULT_FLOW = [
  { id: 'goal',     title: 'What is your main goal?',         type: 'multi',  options: ['Hydration','Anti-aging','Radiance','Imperfections','Soothing'] },
  { id: 'skintype', title: 'What is your skin type?',         type: 'single', options: ['Dry','Normal','Oily','Combination','Sensitive'] },
  { id: 'budget',   title: 'What is your budget per product?',type: 'single', options: ['Up to €20','€20–€40','€40–€60','Over €60'] },
  { id: 'notes',    title: 'Anything else to share?',         type: 'text',   placeholder: 'Allergies, preferences, specific concerns...' },
];

export function CopyEditor() {
  const [config, setConfig] = useState(null);
  const [flow, setFlow] = useState(DEFAULT_FLOW);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/config').then(({ data }) => {
      setConfig(data.config);
      if (data.config?.questionFlow && data.config.questionFlow.length > 0) setFlow(data.config.questionFlow);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/config', { heroTitle: config.heroTitle, heroSubtitle: config.heroSubtitle, ctaText: config.ctaText, loadingText: config.loadingText, questionFlow: flow });
      setToast('Texts saved!');
    } catch { setToast('Error saving'); } finally { setSaving(false); }
  }

  function updateConfig(key, val) { setConfig(c => ({ ...c, [key]: val })); }
  function updateStep(idx, key, val) { setFlow(f => f.map((s, i) => i === idx ? { ...s, [key]: val } : s)); }
  function updateOption(stepIdx, optIdx, val) { setFlow(f => f.map((s, i) => { if (i !== stepIdx) return s; const opts = [...s.options]; opts[optIdx] = val; return { ...s, options: opts }; })); }
  function addOption(stepIdx) { setFlow(f => f.map((s, i) => i === stepIdx ? { ...s, options: [...(s.options || []), 'New option'] } : s)); }
  function removeOption(stepIdx, optIdx) { setFlow(f => f.map((s, i) => { if (i !== stepIdx) return s; return { ...s, options: s.options.filter((_, j) => j !== optIdx) }; })); }
  function addStep() { setFlow(f => [...f, { id: `step_${Date.now()}`, title: 'New question', type: 'single', options: ['Option 1', 'Option 2'] }]); }
  function removeStep(idx) { setFlow(f => f.filter((_, i) => i !== idx)); }
  function moveStep(idx, dir) { setFlow(f => { const arr = [...f]; const newIdx = idx + dir; if (newIdx < 0 || newIdx >= arr.length) return arr; [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]; return arr; }); }

  if (!config) return null;

  return (
    <Page title="Texts & Questions" primaryAction={{ content: saving ? 'Saving...' : '💾 Save', onAction: handleSave, loading: saving }}>
      <BlockStack gap="500">
        {toast && <Banner tone="success" onDismiss={() => setToast('')}><p>{toast}</p></Banner>}

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">General texts</Text>
            <TextField label="Hero title" value={config.heroTitle || ''} onChange={v => updateConfig('heroTitle', v)} />
            <TextField label="Subtitle" value={config.heroSubtitle || ''} onChange={v => updateConfig('heroSubtitle', v)} />
            <TextField label="Main button text" value={config.ctaText || ''} onChange={v => updateConfig('ctaText', v)} />
            <TextField label="Loading message" value={config.loadingText || ''} onChange={v => updateConfig('loadingText', v)} helpText="Shown while the AI is generating the response" />
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingMd">Question flow</Text>
              <Badge>{flow.length} questions</Badge>
            </InlineStack>
            <Banner tone="info"><p>These are the questions shown to your customers. Order matters — use arrows to reorder.</p></Banner>

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
                  <TextField label="Question" value={step.title} onChange={v => updateStep(idx, 'title', v)} />
                  <Select label="Answer type" options={[{ label: 'Single choice', value: 'single' }, { label: 'Multiple choice', value: 'multi' }, { label: 'Free text', value: 'text' }, { label: 'Slider (numeric)', value: 'slider' }]} value={step.type} onChange={v => updateStep(idx, 'type', v)} />
                  {(step.type === 'single' || step.type === 'multi') && (
                    <BlockStack gap="200">
                      <Text variant="bodySm" fontWeight="semibold">Answer options</Text>
                      {(step.options || []).map((opt, optIdx) => (
                        <InlineStack key={optIdx} gap="200" blockAlign="center" wrap={false}>
                          <div style={{ flex: 1 }}><TextField value={opt} onChange={v => updateOption(idx, optIdx, v)} autoComplete="off" /></div>
                          <Button size="slim" onClick={() => removeOption(idx, optIdx)}>✕</Button>
                        </InlineStack>
                      ))}
                      <Button size="slim" onClick={() => addOption(idx)}>+ Add option</Button>
                    </BlockStack>
                  )}
                  {step.type === 'text' && <TextField label="Placeholder text" value={step.placeholder || ''} onChange={v => updateStep(idx, 'placeholder', v)} />}
                </BlockStack>
              </div>
            ))}
            <Button onClick={addStep} variant="secondary">+ Add question</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
