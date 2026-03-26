import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Page, Card, Text, BlockStack, InlineStack,
  TextField, Select, Button, Banner, Badge, Divider
} from '@shopify/polaris';
import { api, useShopData } from '../hooks/useShopData';

const FONTS = [
  { label: 'Cormorant Garamond — Luxury serif', value: 'Cormorant Garamond' },
  { label: 'Playfair Display — Editorial', value: 'Playfair Display' },
  { label: 'Fraunces — Organic serif', value: 'Fraunces' },
  { label: 'DM Sans — Clean modern', value: 'DM Sans' },
  { label: 'Syne — Bold geometric', value: 'Syne' },
  { label: 'Poppins — Friendly round', value: 'Poppins' },
  { label: 'Montserrat — Classic brand', value: 'Montserrat' },
  { label: 'Raleway — Elegant thin', value: 'Raleway' },
  { label: 'Inter — Neutral tech', value: 'Inter' },
  { label: 'Lato — Balanced neutral', value: 'Lato' },
];

const RADIUS_PRESETS = [
  { label: '⬛ Sharp — 0px', value: '0px' },
  { label: '🔲 Subtle — 4px', value: '4px' },
  { label: '◻️ Rounded — 8px', value: '8px' },
  { label: '🔵 Soft — 16px', value: '16px' },
  { label: '💊 Pill — 99px', value: '99px' },
];

const STYLE_PRESETS = [
  {
    label: '🖤 Editorial Dark',
    values: { primaryColor: '#0A0A0A', secondaryColor: '#C8A96E', bgColor: '#FAFAF8', textColor: '#0A0A0A', buttonColor: '#0A0A0A', buttonTextColor: '#FFFFFF', borderRadius: '0px', fontFamily: 'Cormorant Garamond' },
  },
  {
    label: '🌿 Natural Green',
    values: { primaryColor: '#2D5016', secondaryColor: '#7BAE37', bgColor: '#F5F7F2', textColor: '#1A2E0A', buttonColor: '#2D5016', buttonTextColor: '#FFFFFF', borderRadius: '8px', fontFamily: 'Fraunces' },
  },
  {
    label: '🌸 Soft Blush',
    values: { primaryColor: '#2C1810', secondaryColor: '#E8A598', bgColor: '#FDF6F5', textColor: '#2C1810', buttonColor: '#C4756A', buttonTextColor: '#FFFFFF', borderRadius: '12px', fontFamily: 'Playfair Display' },
  },
  {
    label: '🌊 Ocean Blue',
    values: { primaryColor: '#0D2B45', secondaryColor: '#2A9D8F', bgColor: '#F0F7FA', textColor: '#0D2B45', buttonColor: '#0D2B45', buttonTextColor: '#FFFFFF', borderRadius: '6px', fontFamily: 'DM Sans' },
  },
  {
    label: '⬜ Minimal White',
    values: { primaryColor: '#111111', secondaryColor: '#888888', bgColor: '#FFFFFF', textColor: '#111111', buttonColor: '#111111', buttonTextColor: '#FFFFFF', borderRadius: '4px', fontFamily: 'Syne' },
  },
  {
    label: '🖤 Midnight Premium',
    values: { primaryColor: '#F5F0E8', secondaryColor: '#D4AF7A', bgColor: '#0A0A0A', textColor: '#F5F0E8', buttonColor: '#D4AF7A', buttonTextColor: '#0A0A0A', borderRadius: '2px', fontFamily: 'Cormorant Garamond' },
  },
];

const COLOR_FIELDS = [
  { key: 'primaryColor',    label: 'Primary',         desc: 'Main brand color, headings, borders' },
  { key: 'secondaryColor',  label: 'Accent',          desc: 'Highlights, step labels, progress bar' },
  { key: 'bgColor',         label: 'Background',      desc: 'Widget background color' },
  { key: 'textColor',       label: 'Body text',       desc: 'Paragraphs and subtitles' },
  { key: 'buttonColor',     label: 'Button fill',     desc: 'CTA and primary button background' },
  { key: 'buttonTextColor', label: 'Button text',     desc: 'Text on primary buttons' },
];

export function DesignEditor() {
  const { shop } = useShopData();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [livePreview, setLivePreview] = useState(true);
  const iframeRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get('/config').then(({ data }) => setConfig(data.config));
  }, []);

  const apiHost = import.meta.env.VITE_HOST || 'https://nextclick-saas-production.up.railway.app';

  // Send live theme update to iframe via postMessage
  const sendLiveTheme = useCallback((cfg) => {
    if (!livePreview || !iframeRef.current) return;
    try {
      iframeRef.current.contentWindow?.postMessage(
        { type: 'NEXTCLICK_THEME', config: cfg },
        '*'
      );
    } catch (e) {}
  }, [livePreview]);

  // Debounced live preview update on every config change
  useEffect(() => {
    if (!config) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      sendLiveTheme(config);
    }, 80);
    return () => clearTimeout(debounceRef.current);
  }, [config, sendLiveTheme]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/config', config);
      setToast('✅ Design saved!');
      setPreviewKey(k => k + 1);
      setTimeout(() => setToast(''), 3000);
    } catch { setToast('❌ Error saving'); } finally { setSaving(false); }
  }

  function update(key, val) {
    setConfig(c => ({ ...c, [key]: val }));
  }

  function applyPreset(preset) {
    setConfig(c => ({ ...c, ...preset.values }));
  }

  function openPreview() {
    (window.top || window).open(`${apiHost}/widget?shop=${shop?.shopDomain || ''}`, '_blank');
  }

  if (!config) return null;

  const previewUrl = `${apiHost}/widget?shop=${shop?.shopDomain || ''}&preview=true`;

  return (
    <Page
      title="Design & Style"
      subtitle="Customize how the widget looks for your customers"
      primaryAction={{ content: saving ? 'Saving...' : '💾 Save design', onAction: handleSave, loading: saving }}
      secondaryActions={[{ content: '👁️ Open full preview', onAction: openPreview }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Controls */}
        <BlockStack gap="500">
          {toast && <Banner tone={toast.startsWith('✅') ? 'success' : 'critical'} onDismiss={() => setToast('')}><p>{toast}</p></Banner>}

          {/* Style Presets */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd">Style Presets</Text>
                <Badge>One-click themes</Badge>
              </InlineStack>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {STYLE_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    style={{
                      padding: '12px 14px',
                      background: preset.values.bgColor,
                      border: `2px solid ${preset.values.primaryColor}22`,
                      borderRadius: parseInt(preset.values.borderRadius) > 8 ? '8px' : preset.values.borderRadius,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color .15s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = preset.values.primaryColor}
                    onMouseLeave={e => e.currentTarget.style.borderColor = `${preset.values.primaryColor}22`}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: preset.values.textColor, marginBottom: 4 }}>{preset.label}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[preset.values.primaryColor, preset.values.secondaryColor, preset.values.buttonColor].map((c, i) => (
                        <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,.1)' }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </BlockStack>
          </Card>

          {/* Brand */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Brand identity</Text>
              <TextField label="Brand name" value={config.brandName || ''} onChange={v => update('brandName', v)} />
              <TextField
                label="Logo URL"
                value={config.logoUrl || ''}
                onChange={v => update('logoUrl', v)}
                placeholder="https://cdn.shopify.com/..."
                helpText="Upload to Shopify → Content → Files, then paste the CDN URL here"
              />
              {config.logoUrl && (
                <div style={{ padding: 12, background: config.bgColor || '#F7F5F2', borderRadius: 6, display: 'inline-flex' }}>
                  <img src={config.logoUrl} alt="Logo preview" style={{ maxHeight: 48, objectFit: 'contain' }} />
                </div>
              )}
            </BlockStack>
          </Card>

          {/* Colors */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Colors</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {COLOR_FIELDS.map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#202223', marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: '#6D7175', marginBottom: 8 }}>{f.desc}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={config[f.key] || '#000000'}
                        onChange={e => update(f.key, e.target.value)}
                        style={{ width: 36, height: 36, border: '1px solid #C9CCCF', borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }}
                      />
                      <input
                        type="text"
                        value={config[f.key] || ''}
                        onChange={e => update(f.key, e.target.value)}
                        style={{ flex: 1, padding: '7px 10px', border: '1px solid #C9CCCF', borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </BlockStack>
          </Card>

          {/* Typography & Shape */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Typography & Shape</Text>
              <Select
                label="Font family"
                options={FONTS.map(f => ({ label: f.label, value: f.value }))}
                value={config.fontFamily || 'Cormorant Garamond'}
                onChange={v => update('fontFamily', v)}
                helpText="The font used throughout the widget"
              />
              <div>
                <Text variant="bodySm" fontWeight="semibold">Border radius (box shape)</Text>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {RADIUS_PRESETS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => update('borderRadius', r.value)}
                      style={{
                        padding: '7px 14px', fontSize: 12, fontWeight: 500,
                        border: `2px solid ${config.borderRadius === r.value ? '#0A0A0A' : '#E4E5E7'}`,
                        background: config.borderRadius === r.value ? '#0A0A0A' : '#fff',
                        color: config.borderRadius === r.value ? '#fff' : '#202223',
                        borderRadius: 6, cursor: 'pointer', transition: '.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </BlockStack>
          </Card>

        </BlockStack>

        {/* RIGHT — Live Preview */}
        <div style={{ position: 'sticky', top: 20 }}>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd">Live Preview</Text>
                <InlineStack gap="200">
                  <button
                    onClick={() => setLivePreview(v => !v)}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 500,
                      border: '1px solid #E4E5E7',
                      background: livePreview ? '#0A0A0A' : '#fff',
                      color: livePreview ? '#fff' : '#6D7175',
                      borderRadius: 6, cursor: 'pointer', transition: '.15s',
                      fontFamily: 'inherit',
                    }}
                    title={livePreview ? 'Live preview ON' : 'Live preview OFF'}
                  >
                    {livePreview ? '⚡ Live' : '○ Live'}
                  </button>
                  <Button size="slim" onClick={() => setPreviewKey(k => k + 1)}>↺</Button>
                </InlineStack>
              </InlineStack>
              {livePreview
                ? <Text variant="bodySm" tone="subdued">Changes reflected instantly in the preview.</Text>
                : <Text variant="bodySm" tone="subdued">Save first to see your changes reflected.</Text>
              }
              <div style={{
                borderRadius: 8, overflow: 'hidden',
                border: '1px solid #E4E5E7',
                height: 560,
                background: '#F6F6F7',
              }}>
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  src={previewUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Widget Preview"
                  onLoad={() => {
                    // Send current theme immediately on load
                    setTimeout(() => sendLiveTheme(config), 300);
                  }}
                />
              </div>

              {/* Dark/Light preset quick toggle */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => applyPreset(STYLE_PRESETS.find(p => p.label.includes('Midnight')))}
                  style={{ flex: 1, padding: '8px', fontSize: 11, fontWeight: 500, border: '1px solid #E4E5E7', background: '#0A0A0A', color: '#F5F0E8', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  🌙 Dark mode
                </button>
                <button
                  onClick={() => applyPreset(STYLE_PRESETS.find(p => p.label.includes('Minimal White')))}
                  style={{ flex: 1, padding: '8px', fontSize: 11, fontWeight: 500, border: '1px solid #E4E5E7', background: '#fff', color: '#111', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ☀️ Light mode
                </button>
              </div>

            </BlockStack>
          </Card>
        </div>

      </div>
    </Page>
  );
}
