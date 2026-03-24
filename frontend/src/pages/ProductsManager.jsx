import React, { useState, useEffect } from 'react';
import {
  Page, Card, DataTable, TextField, Button, Badge,
  BlockStack, InlineStack, Text, Spinner, Banner, Thumbnail
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

export function ProductsManager() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [aiTagging, setAiTagging] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/products?limit=50&search=' + search);
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search]);

  async function handleSync() {
    setSyncing(true);
    try {
      const { data } = await api.post('/products/sync');
      setToast('✅ ' + data.synced + ' prodotti sincronizzati');
      load();
    } catch {
      setToast('Errore sincronizzazione');
    } finally {
      setSyncing(false);
    }
  }

  async function handleAiTag() {
    setAiTagging(true);
    try {
      const { data } = await api.post('/products/ai-tag');
      setToast('🤖 ' + data.tagged + ' prodotti taggati');
      load();
    } catch (err) {
      setToast(err.response?.data?.error || 'Errore (disponibile da piano Pro)');
    } finally {
      setAiTagging(false);
    }
  }

  async function toggleProduct(id, isActive) {
    await api.patch('/products/' + id, { isActive });
    load();
  }

  const rows = products.map(p => [
    <InlineStack gap="200" blockAlign="center" wrap={false}>
      {p.imageUrl
        ? <Thumbnail source={p.imageUrl} size="small" alt={p.title} />
        : <div style={{ width: 40, height: 40, background: '#F1F1F1', borderRadius: 4 }} />
      }
      <Text variant="bodySm" fontWeight="semibold">{p.title.slice(0, 42)}</Text>
    </InlineStack>,
    p.price ? '€' + Number(p.price).toFixed(2) : '—',
    p.category || '—',
    p.goals.length > 0 ? p.goals.slice(0, 2).join(', ') : '—',
    <Badge tone={p.isActive ? 'success' : 'default'}>{p.isActive ? 'Attivo' : 'Off'}</Badge>,
    <Button size="slim" onClick={() => toggleProduct(p.id, !p.isActive)}>
      {p.isActive ? 'Disattiva' : 'Attiva'}
    </Button>,
  ]);

  return (
      <Page
        title={'Prodotti (' + total + ')'}
        primaryAction={{
          content: syncing ? 'Sincronizzando...' : '🔄 Sincronizza da Shopify',
          onAction: handleSync,
          loading: syncing,
        }}
        secondaryActions={[{
          content: aiTagging ? 'AI tagging...' : '🤖 AI auto-tag (Pro)',
          onAction: handleAiTag,
          loading: aiTagging,
        }]}
      >
        <BlockStack gap="400">
        {toast && <Banner tone="success" onDismiss={() => setToast("")}><p>{toast}</p></Banner>}
          <Banner tone="info">
            <p>I prodotti vengono importati dal tuo store Shopify. Puoi attivarli/disattivarli per controllare cosa consiglia l'AI.</p>
          </Banner>
          <Card>
            <TextField
              placeholder="Cerca prodotto..."
              value={search}
              onChange={setSearch}
              clearButton
              onClearButtonClick={() => setSearch('')}
            />
          </Card>
          <Card>
            {loading
              ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
              : rows.length > 0
                ? <DataTable
                    columnContentTypes={['text','text','text','text','text','text']}
                    headings={['Prodotto','Prezzo','Categoria','Goals AI','Stato','Azione']}
                    rows={rows}
                    footerContent={products.length + ' di ' + total + ' prodotti'}
                  />
                : <div style={{ textAlign: 'center', padding: 40 }}>
                    <Text tone="subdued">Nessun prodotto. Clicca "Sincronizza da Shopify" per importarli.</Text>
                  </div>
            }
          </Card>
        </BlockStack>
      </Page>
  );
}
