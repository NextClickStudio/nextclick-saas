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

  const apiHost = import.meta.env.VITE_HOST || 
    (typeof process !== 'undefined' && process.env?.REACT_APP_HOST) ||
    'https://nextclick-saas-production.up.railway.app';
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
            <p>Devi avere un piano attivo per installare il widget.</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">🔗 Installa tramite link esterno</Text>
            <Text tone="subdued">
              Crea un bottone nel tuo sito (o nel tema Shopify) che porta i visitatori direttamente al widget AI. 
              Copia l&apos;URL qui sotto e usalo come destinazione del bottone.
            </Text>
            <div style={{ background: '#F6F6F7', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
              {widgetUrl}
            </div>
            <InlineStack gap="300">
              <Button variant="primary" onClick={() => copy(widgetUrl, 'url')}>
                {copied === 'url' ? '✅ Copiato!' : '📋 Copia URL'}
              </Button>
              <Button onClick={() => (window.top || window).open(widgetUrl, '_blank')} variant="secondary">
                👁️ Apri anteprima
              </Button>
            </InlineStack>
            <Banner tone="info">
              <p>
                <strong>Come usarlo:</strong> Nel tuo tema Shopify vai su <strong>Negozio online → Temi → Personalizza</strong>, 
                aggiungi un bottone o un link e incolla l&apos;URL copiato come destinazione. I clienti cliccheranno il bottone 
                e verranno portati direttamente al configuratore AI.
              </p>
            </Banner>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">✅ Checklist post-installazione</Text>
            <BlockStack gap="200">
              {[
                'Il widget si apre correttamente cliccando il link',
                'Le domande del form sono quelle che hai configurato',
                'La generazione AI restituisce prodotti reali del tuo catalogo',
                'I link prodotto portano alle pagine giuste dello store',
                'Il widget funziona correttamente da mobile',
                'I click sui prodotti vengono tracciati nella dashboard',
              ].map((item, i) => (
                <Text key={i} variant="bodySm">☐ {item}</Text>
              ))}
            </BlockStack>
            <Button onClick={() => (window.top || window).open(widgetUrl, '_blank')} variant="primary">
              🚀 Testa il widget ora
            </Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
