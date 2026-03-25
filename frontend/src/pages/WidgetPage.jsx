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
    'https://nextclick-saas-production.up.railway.app';

  const widgetUrl     = `${apiHost}/widget?shop=${shop.shopDomain}`;
  const widgetPreview = `${apiHost}/widget?shop=${shop.shopDomain}&preview=true`;

  function copy(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  // ✅ FIX: use window.open() directly — never window.top.open() inside Shopify iframe
  function openPreview() {
    window.open(widgetPreview, '_blank', 'noopener,noreferrer');
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

        {/* ✅ ANTEPRIMA DIRETTA */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">👁️ Anteprima Widget</Text>
            <Text tone="subdued">
              Visualizza come apparirà il widget ai tuoi clienti. Si apre in una nuova scheda.
            </Text>
            <Button variant="primary" onClick={openPreview}>
              🚀 Apri anteprima widget
            </Button>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">🔗 URL del Widget</Text>
            <Text tone="subdued">
              Crea un bottone nel tuo sito o nel tema Shopify che porta i visitatori al widget AI.
              Copia l&apos;URL e usalo come destinazione del bottone.
            </Text>
            <div style={{
              background: '#F6F6F7', borderRadius: 8, padding: 12,
              fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all'
            }}>
              {widgetUrl}
            </div>
            <InlineStack gap="300">
              <Button onClick={() => copy(widgetUrl, 'url')} variant="primary">
                {copied === 'url' ? '✅ Copiato!' : '📋 Copia URL'}
              </Button>
              <Button onClick={openPreview} variant="secondary">
                👁️ Apri anteprima
              </Button>
            </InlineStack>
            <Banner tone="info">
              <p>
                <strong>Come usarlo:</strong> Nel tuo tema Shopify vai su{' '}
                <strong>Negozio online → Temi → Personalizza</strong>,
                aggiungi un bottone e incolla l&apos;URL come destinazione.
              </p>
            </Banner>
          </BlockStack>
        </Card>

        {/* Codice embed iframe opzionale */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">🖼️ Embed come popup (opzionale)</Text>
            <Text tone="subdued">
              In alternativa, puoi aggiungere questo snippet JS al tuo tema Shopify per mostrare
              il widget come popup nell&apos;angolo della pagina.
            </Text>
            <div style={{
              background: '#0A0A0A', color: '#00E676', borderRadius: 8, padding: 14,
              fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', lineHeight: 1.6
            }}>
              {`<script src="${apiHost}/api/widget/embed.js?shop=${shop.shopDomain}" async></script>`}
            </div>
            <Button onClick={() => copy(
              `<script src="${apiHost}/api/widget/embed.js?shop=${shop.shopDomain}" async></script>`,
              'embed'
            )}>
              {copied === 'embed' ? '✅ Copiato!' : '📋 Copia snippet embed'}
            </Button>
            <Banner tone="info">
              <p>
                Incolla lo snippet in <strong>Negozio online → Temi → Modifica codice → theme.liquid</strong>,
                subito prima del tag <code>&lt;/body&gt;</code>.
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
            <Button onClick={openPreview} variant="primary">
              🚀 Testa il widget ora
            </Button>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}
