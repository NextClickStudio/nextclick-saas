import React, { useState, useEffect } from 'react';
import {
  Page, Card, DataTable, TextField, Button, Badge,
  BlockStack, InlineStack, Text, Spinner, Banner, Thumbnail,
  Modal, FormLayout, Select, ProgressBar
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const EMPTY_FORM = {
  title: '', price: '', comparePrice: '', url: '',
  imageUrl: '', category: '', description: '',
};

const CATEGORY_OPTIONS = [
  { label: 'No category', value: '' },
  { label: 'Beauty',      value: 'beauty' },
  { label: 'Skincare',    value: 'skincare' },
  { label: 'Haircare',    value: 'haircare' },
  { label: 'Makeup',      value: 'makeup' },
  { label: 'Fragrance',   value: 'fragrance' },
  { label: 'Nutrition',   value: 'nutrition' },
  { label: 'Wellness',    value: 'wellness' },
  { label: 'Other',       value: 'other' },
];

export function ProductsManager() {
  const [products,   setProducts]   = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [toast,      setToast]      = useState('');
  const [toastErr,   setToastErr]   = useState('');
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);

  // Selezione multipla
  const [selectedIds, setSelectedIds] = useState([]);

  // Shopify sync state
  const [syncing, setSyncing] = useState(false);

  // AI Tag state
  const [aiTagging,    setAiTagging]    = useState(false);
  const [aiTagResult,  setAiTagResult]  = useState(null);
  const [aiTagProgress,setAiTagProgress]= useState(0);

  // Bulk import state
  const [importOpen,    setImportOpen]    = useState(false);
  const [importUrls,    setImportUrls]    = useState('');
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState(null);
  const [importProgress,setImportProgress]= useState(0);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/products?limit=100&search=' + encodeURIComponent(search));
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (err) {
      setToastErr(err.response?.data?.error || 'Error loading products');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [search]);

  function openNew()    { setForm(EMPTY_FORM); setEditingId(null); setModalOpen(true); }
  function openEdit(p)  {
    setForm({
      title: p.title || '', price: p.price != null ? String(p.price) : '',
      comparePrice: p.comparePrice != null ? String(p.comparePrice) : '',
      url: p.url || '', imageUrl: p.imageUrl || '',
      category: p.category || '', description: p.description || '',
    });
    setEditingId(p.id); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); }
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.title.trim()) { setToastErr('Product name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        price: form.price ? parseFloat(form.price) : null,
        comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : null,
        url: form.url.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
      };
      if (editingId) { await api.patch('/products/' + editingId, payload); setToast('Product updated'); }
      else           { await api.post('/products/manual', payload);        setToast('Product added'); }
      closeModal(); load();
    } catch (err) { setToastErr(err.response?.data?.error || 'Error saving'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this product?')) return;
    setDeleting(id);
    try { await api.delete('/products/' + id); setToast('Product deleted'); load(); }
    catch { setToastErr('Error deleting product'); }
    finally { setDeleting(null); }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected products?`)) return;
    try {
      await Promise.all(selectedIds.map(id => api.delete('/products/' + id)));
      setToast(`🗑️ ${selectedIds.length} products deleted`);
      setSelectedIds([]);
      load();
    } catch {
      setToastErr('Error deleting products');
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleSelectAll() {
    setSelectedIds(prev => prev.length === products.length ? [] : products.map(p => p.id));
  }

  async function toggleProduct(id, isActive) {
    try { await api.patch('/products/' + id, { isActive }); load(); }
    catch { setToastErr('Error updating product'); }
  }

  // ── BULK IMPORT ──
  function openImport() { setImportOpen(true); setImportUrls(''); setImportResult(null); setImportProgress(0); }
  function closeImport() { setImportOpen(false); if (importResult?.imported > 0) load(); }

  async function handleSync() {
    setSyncing(true);
    try {
      const { data } = await api.post('/products/sync');
      setToast(`✅ ${data.synced} prodotti sincronizzati da Shopify`);
      load();
    } catch (err) {
      setToastErr(err.response?.data?.error || 'Errore sincronizzazione — reinstalla l\'app');
    } finally {
      setSyncing(false);
    }
  }

  async function handleAiTag() {
    setAiTagging(true);
    setAiTagResult(null);
    setAiTagProgress(0);

    // Simula progresso mentre attende
    const interval = setInterval(() => {
      setAiTagProgress(p => Math.min(p + 3, 90));
    }, 600);

    try {
      const { data } = await api.post('/products/ai-tag');
      clearInterval(interval);
      setAiTagProgress(100);
      setAiTagResult(data);
      setToast(`🤖 ${data.tagged} prodotti taggati con AI`);
      load();
    } catch (err) {
      clearInterval(interval);
      setToastErr(err.response?.data?.error || 'Errore AI tagging');
    } finally {
      setAiTagging(false);
    }
  }

  async function handleImport() {
    const urls = importUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) { setToastErr('Insert at least one valid URL (must start with http)'); return; }
    if (urls.length > 50)  { setToastErr('Max 50 URLs per import'); return; }

    setImporting(true); setImportResult(null); setImportProgress(0);

    // Simulate progress while waiting
    const progressInterval = setInterval(() => {
      setImportProgress(p => Math.min(p + (100 / (urls.length * 3)), 92));
    }, 800);

    try {
      const { data } = await api.post('/products/bulk-import', { urls });
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(data);
      if (data.imported > 0) setToast(`✅ ${data.imported} products imported successfully`);
    } catch (err) {
      clearInterval(progressInterval);
      setToastErr(err.response?.data?.error || 'Import error');
    } finally { setImporting(false); }
  }

  const allSelected = products.length > 0 && selectedIds.length === products.length;
  const someSelected = selectedIds.length > 0;

  const rows = products.map(p => [
    <InlineStack gap="200" blockAlign="center" wrap={false} key={p.id}>
      <input
        type="checkbox"
        checked={selectedIds.includes(p.id)}
        onChange={() => toggleSelect(p.id)}
        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#008060', flexShrink: 0 }}
      />
      {p.imageUrl
        ? <Thumbnail source={p.imageUrl} size="small" alt={p.title} />
        : <div style={{ width: 40, height: 40, background: '#F1F1F1', borderRadius: 4 }} />
      }
      <BlockStack gap="0">
        <Text variant="bodySm" fontWeight="semibold">{p.title.slice(0, 35)}</Text>
        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2C6ECB', fontSize: 11 }}>View product ↗</a>}
        {(p.goals?.length > 0) && <Text variant="bodySm" tone="subdued">{p.goals.slice(0, 3).join(' · ')}</Text>}
      </BlockStack>
    </InlineStack>,
    p.price != null ? '€' + Number(p.price).toFixed(2) : '—',
    p.category || '—',
    <Badge tone={p.isActive ? 'success' : 'default'}>{p.isActive ? 'Active' : 'Off'}</Badge>,
    <InlineStack gap="100">
      <Button size="slim" onClick={() => openEdit(p)}>✏️ Edit</Button>
      <Button size="slim" onClick={() => toggleProduct(p.id, !p.isActive)}>{p.isActive ? 'Disable' : 'Enable'}</Button>
      <Button size="slim" tone="critical" loading={deleting === p.id} onClick={() => handleDelete(p.id)}>🗑️</Button>
    </InlineStack>,
  ]);

  return (
    <Page
      title={`Products (${total})`}
      primaryAction={{ content: '+ Add product', onAction: openNew }}
      secondaryActions={[{ content: syncing ? 'Sincronizzando...' : '🔄 Sincronizza da Shopify', onAction: handleSync, loading: syncing }, { content: aiTagging ? 'AI sta analizzando...' : '🤖 Assegna tag con AI', onAction: handleAiTag, loading: aiTagging }]}
    >
      <BlockStack gap="400">
        {toast    && <Banner tone="success"  onDismiss={() => setToast('')}><p>{toast}</p></Banner>}
        {toastErr && <Banner tone="critical" onDismiss={() => setToastErr('')}><p>{toastErr}</p></Banner>}

        {aiTagging && (
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingMd">🤖 AI sta analizzando i prodotti...</Text>
                <Text variant="bodySm" tone="subdued">{aiTagProgress}%</Text>
              </InlineStack>
              <div style={{ background: '#E4E5E7', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: aiTagProgress + '%', height: '100%', background: '#008060', transition: 'width .4s ease' }} />
              </div>
              <Text variant="bodySm" tone="subdued">Assegnando goals, tipo pelle, allergie e ingredienti chiave a ogni prodotto...</Text>
            </BlockStack>
          </Card>
        )}

        {aiTagResult && !aiTagging && (
          <Banner tone="success" onDismiss={() => setAiTagResult(null)}>
            <p>✅ <strong>{aiTagResult.tagged}</strong> prodotti taggati su {aiTagResult.total}.
            {aiTagResult.errors?.length > 0 && ` ${aiTagResult.errors.length} prodotti saltati.`}
            I tag vengono ora usati dall'AI per raccomandazioni più precise.</p>
          </Banner>
        )}

        <Banner tone="info">
          <p>Sincronizza i prodotti da Shopify con un click, poi usa <strong>Assegna tag con AI</strong> per far analizzare automaticamente ogni prodotto — goals, tipo pelle, allergie e ingredienti chiave vengono estratti dalla descrizione.</p>
        </Banner>

        <Card>
          <TextField placeholder="Search product..." value={search} onChange={setSearch}
            clearButton onClearButtonClick={() => setSearch('')} />
        </Card>

        <Card>
          {loading
            ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
            : rows.length > 0
              ? <>
                  {someSelected && (
                    <div style={{ padding: '10px 16px', background: '#FFF3CD', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text variant="bodySm" fontWeight="semibold">{selectedIds.length} product{selectedIds.length > 1 ? 's' : ''} selected</Text>
                      <InlineStack gap="200">
                        <Button size="slim" onClick={() => setSelectedIds([])}>Deselect all</Button>
                        <Button size="slim" tone="critical" onClick={handleBulkDelete}>🗑️ Delete selected</Button>
                      </InlineStack>
                    </div>
                  )}
                  <DataTable
                    columnContentTypes={['text','text','text','text','text']}
                    headings={[
                      <InlineStack gap="100" blockAlign="center">
                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#008060' }} />
                        <span>Product</span>
                      </InlineStack>,
                      'Price','Category','Status','Actions'
                    ]}
                    rows={rows}
                    footerContent={`${products.length} of ${total} products`}
                  />
                </>
              : <div style={{ textAlign: 'center', padding: 40 }}>
                  <BlockStack gap="300" inlineAlign="center">
                    <Text tone="subdued">No products yet.</Text>
                    <InlineStack gap="200">
                      <Button variant="primary" onClick={openNew}>+ Aggiungi manualmente</Button>
                      <Button onClick={handleSync} loading={syncing}>🔄 Sincronizza da Shopify</Button>
                    </InlineStack>
                  </BlockStack>
                </div>
          }
        </Card>
      </BlockStack>

      {/* ── BULK IMPORT MODAL ── */}
      <Modal
        open={importOpen}
        onClose={closeImport}
        title="🔗 Import products from URLs"
        primaryAction={importing ? undefined : { content: importResult ? 'Close' : `Import ${importUrls.split('\n').filter(u=>u.trim().startsWith('http')).length} products`, onAction: importResult ? closeImport : handleImport }}
        secondaryActions={importing ? [] : [{ content: 'Cancel', onAction: closeImport }]}
        large
      >
        <Modal.Section>
          <BlockStack gap="400">
            {aiTagging && (
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingMd">🤖 AI sta analizzando i prodotti...</Text>
                <Text variant="bodySm" tone="subdued">{aiTagProgress}%</Text>
              </InlineStack>
              <div style={{ background: '#E4E5E7', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: aiTagProgress + '%', height: '100%', background: '#008060', transition: 'width .4s ease' }} />
              </div>
              <Text variant="bodySm" tone="subdued">Assegnando goals, tipo pelle, allergie e ingredienti chiave a ogni prodotto...</Text>
            </BlockStack>
          </Card>
        )}

        {aiTagResult && !aiTagging && (
          <Banner tone="success" onDismiss={() => setAiTagResult(null)}>
            <p>✅ <strong>{aiTagResult.tagged}</strong> prodotti taggati su {aiTagResult.total}.
            {aiTagResult.errors?.length > 0 && ` ${aiTagResult.errors.length} prodotti saltati.`}
            I tag vengono ora usati dall'AI per raccomandazioni più precise.</p>
          </Banner>
        )}

        <Banner tone="info">
              <p>Paste one product URL per line. AI will visit each page and automatically extract: <strong>title, price, images, description, goals, and skin types</strong>. No Shopify API needed — works with any website.</p>
            </Banner>

            {!importResult && (
              <>
                <TextField
                  label="Product URLs (one per line, max 50)"
                  value={importUrls}
                  onChange={setImportUrls}
                  multiline={10}
                  placeholder={`https://yourstore.com/products/moisturizing-cream\nhttps://yourstore.com/products/vitamin-c-serum\nhttps://yourstore.com/products/spf-50-sunscreen`}
                  helpText={`${importUrls.split('\n').filter(u=>u.trim().startsWith('http')).length} valid URLs detected`}
                  disabled={importing}
                />

                {importing && (
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">AI is analyzing pages... this may take a minute.</Text>
                    <ProgressBar progress={importProgress} size="small" />
                  </BlockStack>
                )}
              </>
            )}

            {importResult && (
              <BlockStack gap="300">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div style={{ background: '#F1F8F5', border: '1px solid #B5E3C4', borderRadius: 8, padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#1A7A4A' }}>{importResult.imported}</div>
                    <div style={{ fontSize: 13, color: '#1A7A4A', marginTop: 4 }}>Imported successfully</div>
                  </div>
                  <div style={{ background: importResult.failed > 0 ? '#FFF4F4' : '#F6F6F7', border: `1px solid ${importResult.failed > 0 ? '#FFCDC8' : '#E4E5E7'}`, borderRadius: 8, padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: importResult.failed > 0 ? '#D72C0D' : '#6D7175' }}>{importResult.failed}</div>
                    <div style={{ fontSize: 13, color: importResult.failed > 0 ? '#D72C0D' : '#6D7175', marginTop: 4 }}>Failed</div>
                  </div>
                </div>

                {importResult.errors?.length > 0 && (
                  <BlockStack gap="100">
                    <Text variant="bodySm" fontWeight="semibold" tone="critical">Failed URLs:</Text>
                    {importResult.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#D72C0D', background: '#FFF4F4', padding: '6px 10px', borderRadius: 4 }}>
                        <strong>{e.url?.slice(0, 60)}...</strong><br/>{e.error}
                      </div>
                    ))}
                  </BlockStack>
                )}

                {importResult.imported > 0 && (
                  <Banner tone="success">
                    <p>Products imported and tagged by AI. Go to the product list to review and activate them.</p>
                  </Banner>
                )}
              </BlockStack>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ── MANUAL ADD/EDIT MODAL ── */}
      <Modal
        open={modalOpen} onClose={closeModal}
        title={editingId ? 'Edit product' : 'Add product'}
        primaryAction={{ content: saving ? 'Saving...' : 'Save', onAction: handleSave, loading: saving }}
        secondaryActions={[{ content: 'Cancel', onAction: closeModal }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Product name *" value={form.title} onChange={v => setField('title', v)} placeholder="e.g. Intensive Moisturizing Cream" autoComplete="off" />
            <FormLayout.Group>
              <TextField label="Price (€)" value={form.price} onChange={v => setField('price', v)} placeholder="29.90" type="number" autoComplete="off" />
              <TextField label="Original price (€)" value={form.comparePrice} onChange={v => setField('comparePrice', v)} placeholder="39.90" type="number" autoComplete="off" helpText="Leave empty if no discount" />
            </FormLayout.Group>
            <TextField label="Product URL" value={form.url} onChange={v => setField('url', v)} placeholder="https://your-store.com/products/name" autoComplete="off" />
            <TextField label="Image URL" value={form.imageUrl} onChange={v => setField('imageUrl', v)} placeholder="https://cdn.example.com/image.jpg" autoComplete="off" helpText="Paste the direct image link" />
            <Select label="Category" options={CATEGORY_OPTIONS} value={form.category} onChange={v => setField('category', v)} />
            <TextField label="Description" value={form.description} onChange={v => setField('description', v)} placeholder="Short product description and benefits..." multiline={3} autoComplete="off" />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
