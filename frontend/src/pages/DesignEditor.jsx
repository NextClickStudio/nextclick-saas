import React, { useState, useEffect } from 'react';
import { Page, Card, Text, BlockStack, InlineStack, TextField, Select, Button, Banner } from '@shopify/polaris';
import { api, useShopData } from '../hooks/useShopData';

const FONTS = ['Inter','Poppins','Playfair Display','Fraunces','DM Sans','Syne','Montserrat','Raleway','Nunito','Lato'];

const COLOR_FIELDS = [
  { key: 'primaryColor',    label: 'Primary Color' },
  { key: 'secondaryColor',  label: 'Accent / Link' },
  { key: 'bgColor',         label: 'Background' },
  { key: 'textColor',       label: 'Text' },
  { key: 'buttonColor',     label: 'Button Background' },
  { key: 'buttonTextColor', label: 'Button Text' },
];

export function DesignEditor() {
  const { shop } = useShopData();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { api.get('/config').then(({ data }) => setConfig(data.config)); }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/config', config);
      setToast('✅ Design saved!');
      setTimeout(() => setToast(''), 3000);
    } catch { setToast('❌ Error saving'); } finally { setSaving(false); }
  }

  function update(key, val) { setConfig(c => ({ ...c, [key]: val })); }

  if (!config) return null;

  return (
    <Page
      title="Design & Colors"
      primaryAction={{ content: saving ? 'Saving...' : '💾 Save', onAction: handleSave, loading: saving }}
      secondaryActions={[{ content: '👁️ Preview widget', onAction: () => (window.top || window).open(`${import.meta.env.VITE_HOST || 'https://nextclick-saas-production.up.railway.app'}/widget?shop=${shop?.shopDomain || ''}`, '_blank') }]}
    >
      <BlockStack gap="500">
        {toast && <Banner tone={toast.startsWith('✅') ? 'success' : 'critical'} onDismiss={() => setToast('')}><p>{toast}</p></Banner>}

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Brand</Text>
            <TextField label="Brand Name" value={config.brandName || ''} onChange={v => update('brandName', v)} />
            <TextField label="Logo URL" value={config.logoUrl || ''} onChange={v => update('logoUrl', v)} placeholder="https://..." helpText="Upload to Shopify → Content → Files, then paste the URL" />
            {config.logoUrl && <img src={config.logoUrl} alt="Logo" style={{ maxHeight: 60, objectFit: 'contain', borderRadius: 4 }} />}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Colors</Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {COLOR_FIELDS.map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#202223' }}>{f.label}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={config[f.key] || '#000000'} onChange={e => update(f.key, e.target.value)}
                      style={{ width: 40, height: 36, border: '1px solid #C9CCCF', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                    <TextField value={config[f.key] || ''} onChange={v => update(f.key, v)} autoComplete="off" />
                  </div>
                </div>
              ))}
            </div>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Typography</Text>
            <Select label="Font" options={FONTS.map(f => ({ label: f, value: f }))} value={config.fontFamily || 'Inter'} onChange={v => update('fontFamily', v)} />
            <TextField label="Border Radius" value={config.borderRadius || '8px'} onChange={v => update('borderRadius', v)} helpText="e.g. 0px for sharp, 8px for rounded, 99px for pill" />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
