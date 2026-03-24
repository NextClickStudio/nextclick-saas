import React, { useState, useEffect } from 'react';
import {
  Page, Card, BlockStack, InlineStack, Text, Button, Banner, Badge
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

export function WidgetPage() {
  const [shop, setShop] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.get('/shop').then(({ data }) => setShop(data.shop));
  }, []);

  if (!shop) return null;

  const apiHost = process.env.REACT_APP_HOST || 'https://api.nextclick.studio';
  const embedScript = `<!-- NextClick AI Advisor -->\n<script src="${apiHost}/api/widget/embed.js?shop=${shop.shopDomain}" async></script>`;
  const widgetUrl = `${apiHost}/widget?shop=${shop.shopDomain}`;

  function copy(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  const isActive = shop.planStatus === 'active';

  return (
    <Page
      title="Installa Widget"
      subtitle="Aggiungi il configuratore AI al tuo store Shopify"
    >
      <BlockStack gap="500">

        {!isActive && (
          <Banner tone="warning" action={{ content: 'Attiva piano', url: '/billing' }}>
            <p>Devi avere un piano attivo per installare il widget. Attiva un piano per continuare.</p>
          </Banner>
        )}

        {/* Method 1 - Script tag */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd">📦 Metodo 1 — Script tag (consigliato)</Text>
              <Badge tone="success">Più semplice</Badge>
            </InlineStack>
            <Text tone="subdued">
              Vai su <strong>Shopify Admin → Negozio online → Temi → Modifica codice → theme.liquid</strong>
              <br />Incolla il codice sotto prima del tag <code style={{ background: '#F1F1F1', padding: '2px 4px', borderRadius: 3 }}>&lt;/body&gt;</code>
            </Text>
            <div style={{
              background: '#1E1E2E', borderRadius: 8, padding: 16,
              fontFamily: 'monospace', fontSize: 13, color: '#A6E3A1',
              overflowX: 'auto', lineHeight: 1.7,
            }}>
              <pre style={{ margin: 0 }}>{embedScript}</pre>
            </div>
            <Button
              onClick={() => copy(embedScript, 'script')}
              variant={copied === 'script' ? 'secondary' : 'primary'}
            >
              {copied === 'script' ? '✅ Copiato!' : '📋 Copia codice'}
            </Button>
          </BlockStack>
        </Card>

        {/* Method 2 - Direct URL */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">🔗 Metodo 2 — Pagina standalone</Text>
            <Text tone="subdued">
              Puoi linkare direttamente al widget come pagina intera — utile come landing page o popup.
            </Text>
            <div style={{ background: '#F6F6F7', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
              {widgetUrl}
            </div>
            <InlineStack gap="300">
              <Button onClick={() => copy(widgetUrl, 'url')}>
                {copied === 'url' ? '✅ Copiato!' : '📋 Copia URL'}
              </Button>
              <Button onClick={() => window.open(widgetUrl, '_blank')} variant="secondary">
                👁️ Apri anteprima
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Checklist */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">✅ Checklist post-installazione</Text>
            <Text tone="subdued">Verifica questi punti dopo aver installato il widget:</Text>
            <BlockStack gap="200">
              {[
                'Il widget appare sul sito con il tuo brand e colori',
                'Le domande del form sono quelle che hai configurato',
                'La generazione AI restituisce prodotti reali del tuo catalogo',
                'I link prodotto portano alle pagine giuste dello store',
                'Il widget funziona correttamente da mobile',
                'I click sui prodotti vengono tracciati nella dashboard',
              ].map((item, i) => (
                <Text key={i} variant="bodySm">☐ {item}</Text>
              ))}
            </BlockStack>
            <Button onClick={() => window.open(widgetUrl, '_blank')} variant="primary">
              🚀 Testa il widget ora
            </Button>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}
