import React, { useState, useEffect } from 'react';
import {
  Page, Card, Text, BlockStack, InlineStack,
  TextField, Select, Button, Banner
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const FONTS = ['Inter','Poppins','Playfair Display','Fraunces','DM Sans','Syne','Montserrat','Raleway','Nunito','Lato'];

const COLOR_FIELDS = [
  { key: 'primaryColor',    label: 'Colore Primario' },
  { key: 'secondaryColor',  label: 'Accento / Link' },
  { key: 'bgColor',         label: 'Sfondo' },
  { key: 'textColor',       label: 'Testo' },
  { key: 'buttonColor',     label: 'Sfondo Pulsante' },
  { key: 'buttonTextColor', label: 'Testo Pulsante' },
];

export function DesignEditor() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState('');

  useEffect(() => {
    api.get('/config').then(({ data }) => setConfig(data.config));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/config', config);
      setToast('✅ Design salvato!');
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast('❌ Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  function update(key, val) {
    setConfig(c => ({ ...c, [key]: val }));
  }

  if (!config) return null;

  return (
    <Page
      title="Design & Colori"
      primaryAction={{ content: saving ? 'Salvataggio...' : '💾 Salva', onAction: handleSave, loading: saving }}
      secondaryActions={[{ content: '👁️ Anteprima widget', onAction: () => window.open(`/widget?shop=${new URLSearchParams(location.search).get('shop')}`, '_blank') }]}
    >
      <BlockStack gap="500">

        {toast && <Banner tone={toast.startsWith('✅') ? 'success' : 'critical'} onDismiss={() => setToast('')}><p>{toast}</p></Banner>}

        {/* Brand */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Brand</Text>
            <TextField label="Nome Brand" value={config.brandName || ''} onChange={v => update('brandName', v)} />
            <TextField
              label="URL Logo"
              value={config.logoUrl || ''}
              onChange={v => update('logoUrl', v)}
              placeholder="https://..."
              helpText="Carica su Shopify > Content > Files, poi incolla URL"
            />
            {config.logoUrl && (
              <img src={config.logoUrl} alt="Logo" style={{ maxHeight: 60, objectFit: 'contain', borderRadius: 4 }} />
            )}
          </BlockStack>
        </Card>

        {/* Colori */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Colori</Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {COLOR_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#202223' }}>{label}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={config[key] || '#000000'}
                      onChange={e => update(key, e.target.value)}
                      style={{ width: 42, height: 38, border: '1px solid #C9CCCF', cursor: 'pointer', borderRadius: 6, padding: 2, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <TextField value={config[key] || ''} onChange={v => update(key, v)} monospaced autoComplete="off" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </BlockStack>
        </Card>

        {/* Tipografia */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Tipografia & Stile</Text>
            <Select
              label="Font"
              options={FONTS.map(f => ({ label: f, value: f }))}
              value={config.fontFamily || 'Inter'}
              onChange={v => update('fontFamily', v)}
            />
            <div style={{
              fontFamily: config.fontFamily,
              fontSize: 18,
              padding: 16,
              color: config.textColor,
              background: config.bgColor,
              borderRadius: 8,
              border: '1px solid #E4E5E7',
            }}>
              Anteprima font: Il tuo brand advisor AI
            </div>
            <Select
              label="Bordi arrotondati"
              options={[
                { label: 'Nessuno (0px)',      value: '0px'   },
                { label: 'Leggero (4px)',       value: '4px'   },
                { label: 'Medio (8px)',          value: '8px'   },
                { label: 'Grande (16px)',        value: '16px'  },
                { label: 'Pillola (999px)',      value: '999px' },
              ]}
              value={config.borderRadius || '8px'}
              onChange={v => update('borderRadius', v)}
            />
          </BlockStack>
        </Card>

        {/* Live preview */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">Anteprima live</Text>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <WidgetPreview config={config} />
            </div>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}

function WidgetPreview({ config }) {
  return (
    <div style={{
      background: config.bgColor || '#fff',
      fontFamily: config.fontFamily || 'Inter',
      color: config.textColor || '#0A0A0A',
      borderRadius: config.borderRadius || '8px',
      padding: 24,
      border: `1px solid ${config.primaryColor || '#0A0A0A'}22`,
      width: '100%',
      maxWidth: 340,
    }}>
      {config.logoUrl && (
        <img src={config.logoUrl} alt="logo" style={{ height: 36, marginBottom: 16, objectFit: 'contain', display: 'block' }} />
      )}
      <div style={{ fontSize: 22, fontWeight: 700, color: config.primaryColor, marginBottom: 6 }}>
        {config.brandName || 'Il tuo Brand'}
      </div>
      <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 20 }}>
        {config.heroSubtitle || "Personalizzata per te dall'AI"}
      </div>
      {['Idratazione intensa', 'Anti-età', 'Pelle luminosa'].map(opt => (
        <div key={opt} style={{
          border: `1px solid ${config.primaryColor || '#0A0A0A'}44`,
          borderRadius: config.borderRadius,
          padding: '10px 14px',
          marginBottom: 8,
          fontSize: 13,
        }}>{opt}</div>
      ))}
      <button style={{
        background: config.buttonColor || '#0A0A0A',
        color: config.buttonTextColor || '#fff',
        border: 'none',
        borderRadius: config.borderRadius,
        padding: '12px 24px',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        width: '100%',
        marginTop: 8,
      }}>
        {config.ctaText || 'Inizia ora'} →
      </button>
    </div>
  );
}
