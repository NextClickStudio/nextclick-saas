import React, { useState, useEffect } from 'react';
import {
  Page, Card, DataTable, TextField, Button, Badge,
  BlockStack, InlineStack, Text, Spinner, Banner, Thumbnail
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

export function ProductsManager() {
  const [products, setProducts] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [syncing,  setSyncing]  = useState(false);
  const [aiTagging,setAiTagging]= useState(false);
  const [search,   setSearch]   = useState('');
  const [toast,     setToast]     = useState('');
  const [toastErr,  setToastErr]  = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/products?limit=50&search=' + encodeURIComponent(search));
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (err) {
      setToastErr(err.response?.data?.error || 'Errore caricamento prodotti');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search]);

  async function handleImportUrl() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setToast('');
    setToastErr('');
    try {
      const { data } = await api.post('/products/import-url', { url: importUrl.trim() });
      setToast('✅ Prodotto importato: ' + data.product.title);
      setImportUrl('');
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'Errore importazione';
      if (err.response?.status === 401) {
        setToastErr('❌ Token non valido. Vai su Impostazioni → Reinstalla l\'app per aggiornare i permessi.');
      } else {
        setToastErr(msg);
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setToast('');
    setToastErr('');
    try {
      const { data } = await api.post('/products/sync');
      setToast('✅ ' + data.synced + ' prodotti sincronizzati');
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'Errore sincronizzazione';
      if (err.response?.status === 401) {
        setToastErr('❌ Token non valido. Vai su Impostazioni → Reinstalla l\'app per aggiornare i permessi Shopify.');
      } else {
        setToastErr(msg);
      }
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
      setToastErr(err.response?.data?.error || 'Errore (disponibile da piano Pro)');
    } finally {
      setAiTagging(false);
    }
  }

  async function toggleProduct(id, isActive) {
    try {
      await api.patch('/products/' + id, { isActive });
      load();
    } catch (err) {
      setToastErr('Errore aggiornamento prodotto');
    }
  }

  const rows = products.map(p => [
    <InlineStack gap="200" blockAlign="center" wrap={false} key={p.id}>
      {p.imageUrl
        ? <Thumbnail source={p.imageUrl} size="small" alt={p.title} />
        : <div style={{ width: 40, height: 40, background: '#F1F1F1', borderRadius: 4 }} />
      }
      <Text variant="bodySm" fontWeight="semibold">{p.title.slice(0, 40)}</Text>
    </InlineStack>,
    p.price ? '€' + Number(p.price).toFixed(2) : '—',
    p.category || '—',
    p.goals?.length > 0 ? p.goals.slice(0, 2).join(', ') : '—',
    <Badge tone={p.isActive ? 'success' : 'default'}>{p.isActive ? 'Attivo' : 'Off'}</Badge>,
    <Button size="slim" onClick={() => toggleProduct(p.id, !p.isActive)}>
      {p.isActive ? 'Disattiva' : 'Attiva'}
    </Button>,
  ]);

  return (
    <Page
      title={`Prodotti (${total})`}
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

        {toast    && <Banner tone="success" onDismiss={() => setToast('')}><p>{toast}</p></Banner>}
        {toastErr && (
          <Banner tone="critical" onDismiss={() => setToastErr('')}>
            <p>{toastErr}</p>
            {toastErr.includes('Token non valido') && (
              <p style={{ marginTop: 8 }}>
                <strong>Soluzione:</strong> Vai su{' '}
                <a href="https://admin.shopify.com" target="_blank" rel="noopener noreferrer">
                  Shopify Admin
                </a>{' '}
                → App → Prova Skincare → e reinstalla l&apos;app per aggiornare i permessi.
              </p>
            )}
          </Banner>
        )}

        <Banner tone="info">
          <p>I prodotti vengono importati dal tuo store Shopify. Puoi attivarli/disattivarli per controllare cosa consiglia l&apos;AI.</p>
        </Banner>

        <Card>
          <BlockStack gap="200">
            <Text variant="headingMd">📎 Importa prodotto manualmente</Text>
            <Text tone="subdued" variant="bodySm">
              In alternativa alla sincronizzazione, incolla direttamente l&apos;URL di un prodotto Shopify (es. https://tuo-store.myshopify.com/products/nome-prodotto)
            </Text>
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              <div style={{ flex: 1 }}>
                <TextField
                  placeholder="https://tuo-store.myshopify.com/products/nome-prodotto"
                  value={importUrl}
                  onChange={setImportUrl}
                  clearButton
                  onClearButtonClick={() => setImportUrl('')}
                />
              </div>
              <Button
                variant="primary"
                onClick={handleImportUrl}
                loading={importing}
                disabled={!importUrl.trim()}
              >
                Importa
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

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
                  footerContent={`${products.length} di ${total} prodotti`}
                />
              : <div style={{ textAlign: 'center', padding: 40 }}>
                  <Text tone="subdued">Nessun prodotto. Clicca &quot;Sincronizza da Shopify&quot; per importarli.</Text>
                </div>
          }
        </Card>

      </BlockStack>
    </Page>
  );
}
