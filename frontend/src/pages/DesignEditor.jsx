import React, { useState, useEffect } from 'react';
import {
  Page, Card, Grid, Text, BlockStack, InlineStack,
  TextField, Select, Button, Banner
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const FONTS = ['Inter','Poppins','Playfair Display','Fraunces','DM Sans','Syne','Montserrat','Raleway','Nunito','Lato'];

export function DesignEditor() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/config').then(({ data }) => setConfig(data.config));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/config', config);
      setToast('Design salvato!');
    } catch {
      setToast('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  function update(key, val) {
    setConfig(c => ({ ...c, [key]: val }));
  }

  if (!config) return null;

  const colorFields = [
    { key: 'primaryColor',     label: 'Colore Primario' },
    { key: 'secondaryColor',   label: 'Accento / Link' },
    { key: 'bgColor',          label: 'Sfondo' },
    { key: 'textColor',        label: 'Testo' },
    { key: 'buttonColor',      label: 'Sfondo Pulsante' },
    { key: 'buttonTextColor',  label: 'Testo Pulsante' },
  ];

  return (
      <Page
        title="Design & Colori"
        primaryAction={{ content: saving ? 'Salvataggio...' : '💾 Salva', onAction: handleSave, loading: saving }}
        secondaryActions={[{ content: '👁️ Anteprima', url: '/widget' }]}
      >
        <Grid columns={{ xs: 1, sm: 2 }} gap={{ xs: '400', sm: '600' }}>

          {/* LEFT — Controls */}
          <BlockStack gap="400">
        {toast && <Banner tone="success" onDismiss={() => setToast("")}><p>{toast}</p></Banner>}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd">Brand</Text>
                <TextField label="Nome Brand" value={config.brandName} onChange={v => update('brandName', v)} />
                <TextField
                  label="URL Logo"
                  value={config.logoUrl || ''}
                  onChange={v => update('logoUrl', v)}
                  placeholder="https://..."
                  helpText="Carica su Shopify > Content > Files, poi incolla URL"
                />
                {config.logoUrl && (
                  <img src={config.logoUrl} alt="Logo" style={{ maxHeight: 60, objectFit: 'contain' }} />
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Colori</Text>
                <Grid columns={{ xs: 2 }} gap={{ xs: '300' }}>
                  {colorFields.map(({ key, label }) => (
                    <div key={key}>
                      <Text variant="bodySm" fontWeight="semibold">{label}</Text>
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <input
                          type="color"
                          value={config[key] || '#000000'}
                          onChange={e => update(key, e.target.value)}
                          style={{ width: 38, height: 34, border: 'none', cursor: 'pointer', borderRadius: 4, flexShrink: 0 }}
                        />
                        <TextField
                          value={config[key] || ''}
                          onChange={v => update(key, v)}
                          monospaced
                          autoComplete="off"
                        />
                      </InlineStack>
                    </div>
                  ))}
                </Grid>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Tipografia</Text>
                <Select
                  label="Font"
                  options={FONTS.map(f => ({ label: f, value: f }))}
                  value={config.fontFamily}
                  onChange={v => update('fontFamily', v)}
                />
                <div style={{ fontFamily: config.fontFamily, fontSize: 18, padding: 12, color: config.textColor, background: config.bgColor, borderRadius: 6 }}>
                  Anteprima font: Il tuo brand advisor
                </div>
                <Select
                  label="Bordi arrotondati"
                  options={[
                    { label: 'Nessuno', value: '0px' },
                    { label: 'Leggero (4px)', value: '4px' },
                    { label: 'Medio (8px)', value: '8px' },
                    { label: 'Grande (16px)', value: '16px' },
                    { label: 'Pillola', value: '999px' },
                  ]}
                  value={config.borderRadius}
                  onChange={v => update('borderRadius', v)}
                />
              </BlockStack>
            </Card>
          </BlockStack>

          {/* RIGHT — Live Preview */}
          <div style={{ position: 'sticky', top: 80 }}>
            <Card>
              <Text variant="headingMd">Anteprima live</Text>
              <div style={{ marginTop: 12 }}>
                <WidgetPreview config={config} />
              </div>
            </Card>
          </div>

        </Grid>
      </Page>
  );
}

function WidgetPreview({ config }) {
  const s = {
    wrapper: {
      background: config.bgColor,
      fontFamily: config.fontFamily,
      color: config.textColor,
      borderRadius: config.borderRadius,
      padding: 24,
      border: `1px solid ${config.primaryColor}22`,
      maxWidth: 340,
      margin: '0 auto',
    },
    title: { fontSize: 22, fontWeight: 700, color: config.primaryColor, marginBottom: 6 },
    subtitle: { fontSize: 13, color: config.textColor + '99', marginBottom: 20 },
    btn: {
      background: config.buttonColor,
      color: config.buttonTextColor,
      border: 'none',
      borderRadius: config.borderRadius,
      padding: '12px 24px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      width: '100%',
    },
    option: {
      border: `1px solid ${config.primaryColor}44`,
      borderRadius: config.borderRadius,
      padding: '10px 14px',
      marginBottom: 8,
      cursor: 'pointer',
      fontSize: 13,
    },
  };

  return (
    <div style={s.wrapper}>
      {config.logoUrl && (
        <img src={config.logoUrl} alt="logo" style={{ height: 36, marginBottom: 16, objectFit: 'contain' }} />
      )}
      <div style={s.title}>{config.brandName || 'Il tuo Brand'}</div>
      <div style={s.subtitle}>{config.heroSubtitle || 'Personalizzata per te dall\'AI'}</div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: config.primaryColor }}>Cosa cerchi?</div>
        {['Idratazione intensa', 'Anti-età', 'Pelle luminosa'].map(opt => (
          <div key={opt} style={s.option}>{opt}</div>
        ))}
      </div>
      <button style={s.btn}>{config.ctaText || 'Inizia ora'} →</button>
    </div>
  );
}
