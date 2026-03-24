import React, { useState, useEffect } from 'react';
import {
  Page, Card, BlockStack, Text, TextField, Select,
  Button, Toast, InlineStack
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const EXAMPLES = [
  {
    label: '💄 Beauty / Dermatologo',
    text: 'Sei un dermatologo con 15 anni di esperienza. Parla con autorevolezza scientifica ma usa parole accessibili. Cita sempre ingredienti attivi specifici e spiega perché funzionano per il profilo di questa persona.',
  },
  {
    label: '💊 Nutrition / Nutrizionista',
    text: 'Sei un nutrizionista sportivo certificato. Sei pratico e motivante. Dai sempre indicazioni concrete su dosaggi e timing. Fai riferimento agli obiettivi fitness dichiarati.',
  },
  {
    label: '🐾 Pet / Veterinario',
    text: 'Sei un veterinario nutrizionista. Sei rassicurante e competente. Considera sempre età, razza e condizioni dell\'animale nelle raccomandazioni. Usa un tono caldo e professionale.',
  },
  {
    label: '👶 Baby / Pediatra',
    text: 'Sei un pediatra specializzato in nutrizione infantile. Sei rassicurante e preciso. Dai sempre priorità alla sicurezza e cita sempre l\'importanza di consultare il proprio pediatra per decisioni importanti.',
  },
];

export function AIPersona() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/config').then(({ data }) => setConfig(data.config));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/config', {
        aiPersona:  config.aiPersona,
        aiTone:     config.aiTone,
        aiLanguage: config.aiLanguage,
      });
      setToast('AI Persona salvata!');
    } catch {
      setToast('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  if (!config) return null;

  return (
      {toast && <Toast content={toast} onDismiss={() => setToast('')} />}
      <Page
        title="AI Persona"
        subtitle="Definisci come l'intelligenza artificiale parla con i tuoi clienti"
        primaryAction={{
          content: saving ? 'Salvataggio...' : '💾 Salva',
          onAction: handleSave,
          loading: saving,
        }}
      >
        <BlockStack gap="500">

          <Card>
            <BlockStack gap="400">
              <Select
                label="Tono di voce"
                options={[
                  { label: '👔 Professionale',          value: 'professionale' },
                  { label: '😊 Amichevole e informale', value: 'amichevole' },
                  { label: '🩺 Clinico / Scientifico',  value: 'medico' },
                  { label: '✨ Premium / Luxury',        value: 'luxury' },
                  { label: '💪 Energico / Motivazionale', value: 'energico' },
                ]}
                value={config.aiTone}
                onChange={v => setConfig(c => ({ ...c, aiTone: v }))}
              />
              <Select
                label="Lingua delle risposte"
                options={[
                  { label: '🇮🇹 Italiano', value: 'it' },
                  { label: '🇬🇧 Inglese',  value: 'en' },
                  { label: '🇩🇪 Tedesco',  value: 'de' },
                  { label: '🇫🇷 Francese', value: 'fr' },
                  { label: '🇪🇸 Spagnolo', value: 'es' },
                ]}
                value={config.aiLanguage}
                onChange={v => setConfig(c => ({ ...c, aiLanguage: v }))}
              />
              <TextField
                label="Istruzioni per l'AI"
                value={config.aiPersona}
                onChange={v => setConfig(c => ({ ...c, aiPersona: v }))}
                multiline={6}
                helpText="Descrivi il ruolo, il tono e le regole che l'AI deve seguire. Più sei preciso, più le risposte saranno in linea col tuo brand."
              />
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd">💡 Esempi pronti — clicca per usare</Text>
              {EXAMPLES.map(ex => (
                <div
                  key={ex.label}
                  style={{
                    background: '#F6F6F7', borderRadius: 8, padding: '12px 14px',
                    cursor: 'pointer', border: '1px solid #E4E5E7',
                  }}
                >
                  <BlockStack gap="100">
                    <Text variant="bodySm" fontWeight="semibold">{ex.label}</Text>
                    <Text variant="bodySm" tone="subdued">{ex.text}</Text>
                    <Button size="slim" onClick={() => setConfig(c => ({ ...c, aiPersona: ex.text }))}>
                      Usa questo →
                    </Button>
                  </BlockStack>
                </div>
              ))}
            </BlockStack>
          </Card>

        </BlockStack>
      </Page>
  );
}
