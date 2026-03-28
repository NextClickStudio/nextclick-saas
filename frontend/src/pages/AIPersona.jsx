import React, { useState, useEffect } from 'react';
import { Page, Card, BlockStack, Text, TextField, Select, Button, InlineStack, Banner } from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const EXAMPLES = [
  { label: '💄 Beauty / Dermatologist', text: 'You are a dermatologist with 15 years of experience. Speak with scientific authority but use accessible language. Always cite specific active ingredients and explain why they work for this person\'s profile.' },
  { label: '💊 Nutrition / Nutritionist', text: 'You are a certified sports nutritionist. Be practical and motivating. Always give concrete guidance on dosages and timing. Reference the stated fitness goals.' },
  { label: '🐾 Pet / Veterinarian', text: 'You are a veterinary nutritionist. Be reassuring and knowledgeable. Always consider the animal\'s age, breed and conditions in your recommendations. Use a warm and professional tone.' },
  { label: '👶 Baby / Pediatrician', text: 'You are a pediatrician specialized in infant nutrition. Be reassuring and precise. Always prioritize safety and remind users to consult their own pediatrician for important decisions.' },
];

export function AIPersona() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { api.get('/config').then(({ data }) => setConfig(data.config)); }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/config', { aiPersona: config.aiPersona, aiTone: config.aiTone, aiLanguage: config.aiLanguage });
      setToast('AI Persona saved!');
    } catch { setToast('Error saving'); } finally { setSaving(false); }
  }

  if (!config) return null;

  return (
    <Page title="AI Persona" subtitle="Define how the AI talks to your customers"
      primaryAction={{ content: saving ? 'Saving...' : '💾 Save', onAction: handleSave, loading: saving }}>
      <BlockStack gap="500">
        {toast && <Banner tone="success" onDismiss={() => setToast('')}><p>{toast}</p></Banner>}

        <Card>
          <BlockStack gap="400">
            <Select label="Tone of voice" options={[
              { label: '👔 Professional',         value: 'professionale' },
              { label: '😊 Friendly & informal',  value: 'amichevole' },
              { label: '🩺 Clinical / Scientific', value: 'medico' },
              { label: '✨ Premium / Luxury',      value: 'luxury' },
              { label: '💪 Energetic / Motivational', value: 'energico' },
            ]} value={config.aiTone} onChange={v => setConfig(c => ({ ...c, aiTone: v }))} />

            <Select label="Response language" options={[
              { label: '🇮🇹 Italian',  value: 'it' },
              { label: '🇬🇧 English',  value: 'en' },
              { label: '🇩🇪 German',   value: 'de' },
              { label: '🇫🇷 French',   value: 'fr' },
              { label: '🇪🇸 Spanish',  value: 'es' },
            ]} value={config.aiLanguage} onChange={v => setConfig(c => ({ ...c, aiLanguage: v }))} />

            <TextField label="AI Instructions" value={config.aiPersona} onChange={v => setConfig(c => ({ ...c, aiPersona: v }))} multiline={6}
              helpText="Describe the role, tone and rules the AI must follow. The more precise you are, the more on-brand the responses will be." />
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">💡 Ready-made examples — click to use</Text>
            {EXAMPLES.map(ex => (
              <div key={ex.label} style={{ background: '#F6F6F7', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', border: '1px solid #E4E5E7' }}>
                <BlockStack gap="100">
                  <Text variant="bodySm" fontWeight="semibold">{ex.label}</Text>
                  <Text variant="bodySm" tone="subdued">{ex.text}</Text>
                  <Button size="slim" onClick={() => setConfig(c => ({ ...c, aiPersona: ex.text }))}>Use this →</Button>
                </BlockStack>
              </div>
            ))}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
