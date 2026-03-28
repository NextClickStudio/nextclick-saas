import React, { useState, useEffect } from 'react';
import { Page, Card, BlockStack, InlineStack, Text, Button, Banner } from '@shopify/polaris';
import { api } from '../hooks/useShopData';

export function WidgetPage() {
  const [shop, setShop] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => { api.get('/shop').then(({ data }) => setShop(data.shop)); }, []);
  if (!shop) return null;

  const apiHost = import.meta.env.VITE_HOST || 'https://nextclick-saas-production.up.railway.app';
  const widgetUrl     = `${apiHost}/widget?shop=${shop.shopDomain}`;
  const widgetPreview = `${apiHost}/widget?shop=${shop.shopDomain}&preview=true`;

  function copy(text, label) { navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 2000); }
  function openPreview() { window.open(widgetPreview, '_blank', 'noopener,noreferrer'); }

  const isActive = shop.planStatus === 'active';

  return (
    <Page title="Install Widget" subtitle="Add the AI configurator to your Shopify store">
      <BlockStack gap="500">
        {!isActive && <Banner tone="warning" action={{ content: 'Activate plan', url: '/billing' }}><p>You need an active plan to install the widget.</p></Banner>}

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">👁️ Widget Preview</Text>
            <Text tone="subdued">See how the widget will appear to your customers. Opens in a new tab.</Text>
            <Button variant="primary" onClick={openPreview}>🚀 Open widget preview</Button>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">🔗 Widget URL</Text>
            <Text tone="subdued">Create a button in your Shopify theme that leads visitors to the AI widget. Copy the URL and use it as the button destination.</Text>
            <div style={{ background: '#F6F6F7', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>{widgetUrl}</div>
            <InlineStack gap="300">
              <Button onClick={() => copy(widgetUrl, 'url')} variant="primary">{copied === 'url' ? '✅ Copied!' : '📋 Copy URL'}</Button>
              <Button onClick={openPreview} variant="secondary">👁️ Open preview</Button>
            </InlineStack>
            <Banner tone="info"><p><strong>How to use:</strong> In your Shopify theme go to <strong>Online Store → Themes → Customize</strong>, add a button and paste the URL as destination.</p></Banner>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">🖼️ Embed as popup (optional)</Text>
            <Text tone="subdued">Alternatively, add this JS snippet to your Shopify theme to show the widget as a popup in the corner of the page.</Text>
            <div style={{ background: '#0A0A0A', color: '#00E676', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', lineHeight: 1.6 }}>
              {`<script src="${apiHost}/api/widget/embed.js?shop=${shop.shopDomain}" async></script>`}
            </div>
            <Button onClick={() => copy(`<script src="${apiHost}/api/widget/embed.js?shop=${shop.shopDomain}" async></script>`, 'embed')}>
              {copied === 'embed' ? '✅ Copied!' : '📋 Copy embed snippet'}
            </Button>
            <Banner tone="info"><p>Paste the snippet in <strong>Online Store → Themes → Edit code → theme.liquid</strong>, just before the <code>&lt;/body&gt;</code> tag.</p></Banner>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">✅ Post-installation checklist</Text>
            <BlockStack gap="200">
              {[
                'The widget opens correctly when clicking the link',
                'The form questions are the ones you configured',
                'AI generation returns real products from your catalog',
                'Product links go to the correct store pages',
                'The widget works correctly on mobile',
                'Product clicks are tracked in the dashboard',
              ].map((item, i) => <Text key={i} variant="bodySm">☐ {item}</Text>)}
            </BlockStack>
            <Button onClick={openPreview} variant="primary">🚀 Test the widget now</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
