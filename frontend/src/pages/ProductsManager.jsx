import React, { useState, useEffect } from 'react';
import {
  Page, Card, DataTable, TextField, Button, Badge,
  BlockStack, InlineStack, Text, Spinner, Banner, Thumbnail,
  Modal, FormLayout, Select
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const EMPTY_FORM = {
  title: '', price: '', comparePrice: '', url: '',
  imageUrl: '', category: '', description: '',
};

export function ProductsManager() {
  const [products,  setProducts]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [toast,     setToast]     = useState('');
  const [toastErr,  setToastErr]  = useState('');
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/products?limit=100&search=' + encodeURIComponent(search));
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (err) {
      setToastErr(err.response?.data?.error || 'Errore caricamento prodotti');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search]);

  function openNew() { setForm(EMPTY_FORM); setEditingId(null); setModalOpen(true); }

  function openEdit(p) {
    setForm({
      title:        p.title        || '',
      price:        p.price != null ? String(p.price) : '',
      comparePrice: p.comparePrice != null ? String(p.comparePrice) : '',
      url:          p.url          || '',
      imageUrl:     p.imageUrl     || '',
      category:     p.category     || '',
      description:  p.description  || '',
    });
    setEditingId(p.id);
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); }
  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.title.trim()) { setToastErr('Il nome del prodotto è obbligatorio'); return; }
    setSaving(true);
    try {
      const payload = {
        title:        form.title.trim(),
        price:        form.price        ? parseFloat(form.price)        : null,
        comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : null,
        url:          form.url.trim()      || null,
        imageUrl:     form.imageUrl.trim() || null,
        category:     form.category.trim() || null,
        description:  form.description.trim() || null,
      };
      if (editingId) {
        await api.patch('/products/' + editingId, payload);
        setToast('Prodotto aggiornato');
      } else {
        await api.post('/products/manual', payload);
        setToast('Prodotto aggiunto');
      }
      closeModal();
      load();
    } catch (err) {
      setToastErr(err.response?.data?.error || 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Eliminare questo prodotto?')) return;
    setDeleting(id);
    try {
      await api.delete('/products/' + id);
      setToast('Prodotto eliminato');
      load();
    } catch (err) {
      setToastErr(err.response?.data?.error || 'Errore eliminazione');
    } finally {
      setDeleting(null);
    }
  }

  async function toggleProduct(id, isActive) {
    try { await api.patch('/products/' + id, { isActive }); load(); }
    catch { setToastErr('Errore aggiornamento prodotto'); }
  }

  const categoryOptions = [
    { label: 'Nessuna categoria', value: '' },
    { label: 'Beauty',     value: 'beauty'    },
    { label: 'Skincare',   value: 'skincare'  },
    { label: 'Haircare',   value: 'haircare'  },
    { label: 'Makeup',     value: 'makeup'    },
    { label: 'Profumeria', value: 'fragrance' },
    { label: 'Altro',      value: 'other'     },
  ];

  const rows = products.map(p => [
    <InlineStack gap="200" blockAlign="center" wrap={false} key={p.id}>
      {p.imageUrl
        ? <Thumbnail source={p.imageUrl} size="small" alt={p.title} />
        : <div style={{ width: 40, height: 40, background: '#F1F1F1', borderRadius: 4 }} />
      }
      <BlockStack gap="0">
        <Text variant="bodySm" fontWeight="semibold">{p.title.slice(0, 35)}</Text>
        {p.url && (
          <a href={p.url} target="_blank" rel="noopener noreferrer"
             style={{ color: '#2C6ECB', fontSize: 11 }}>
            Vai al prodotto ↗
          </a>
        )}
      </BlockStack>
    </InlineStack>,
    p.price != null ? '€' + Number(p.price).toFixed(2) : '—',
    p.category || '—',
    <Badge tone={p.isActive ? 'success' : 'default'}>{p.isActive ? 'Attivo' : 'Off'}</Badge>,
    <InlineStack gap="100">
      <Button size="slim" onClick={() => openEdit(p)}>✏️ Modifica</Button>
      <Button size="slim" onClick={() => toggleProduct(p.id, !p.isActive)}>
        {p.isActive ? 'Disattiva' : 'Attiva'}
      </Button>
      <Button size="slim" tone="critical" loading={deleting === p.id}
              onClick={() => handleDelete(p.id)}>🗑️</Button>
    </InlineStack>,
  ]);

  return (
    <Page
      title={"Prodotti (" + total + ")"}
      primaryAction={{ content: '+ Aggiungi prodotto', onAction: openNew }}
    >
      <BlockStack gap="400">
        {toast    && <Banner tone="success"  onDismiss={() => setToast('')}><p>{toast}</p></Banner>}
        {toastErr && <Banner tone="critical" onDismiss={() => setToastErr('')}><p>{toastErr}</p></Banner>}

        <Banner tone="info">
          <p>Aggiungi i tuoi prodotti manualmente. L'AI li userà per fare raccomandazioni personalizzate ai clienti.</p>
        </Banner>

        <Card>
          <TextField placeholder="Cerca prodotto..." value={search} onChange={setSearch}
            clearButton onClearButtonClick={() => setSearch('')} />
        </Card>

        <Card>
          {loading
            ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
            : rows.length > 0
              ? <DataTable
                  columnContentTypes={['text','text','text','text','text']}
                  headings={['Prodotto','Prezzo','Categoria','Stato','Azioni']}
                  rows={rows}
                  footerContent={products.length + " di " + total + " prodotti"}
                />
              : <div style={{ textAlign: 'center', padding: 40 }}>
                  <BlockStack gap="200" inlineAlign="center">
                    <Text tone="subdued">Nessun prodotto ancora.</Text>
                    <Button variant="primary" onClick={openNew}>+ Aggiungi il primo prodotto</Button>
                  </BlockStack>
                </div>
          }
        </Card>
      </BlockStack>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Modifica prodotto' : 'Aggiungi prodotto'}
        primaryAction={{ content: saving ? 'Salvo...' : 'Salva', onAction: handleSave, loading: saving }}
        secondaryActions={[{ content: 'Annulla', onAction: closeModal }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Nome prodotto *" value={form.title} onChange={v => setField('title', v)}
              placeholder="es. Crema viso idratante" autoComplete="off" />
            <FormLayout.Group>
              <TextField label="Prezzo (€)" value={form.price} onChange={v => setField('price', v)}
                placeholder="29.90" type="number" autoComplete="off" />
              <TextField label="Prezzo originale (€)" value={form.comparePrice}
                onChange={v => setField('comparePrice', v)} placeholder="39.90" type="number"
                autoComplete="off" helpText="Lascia vuoto se non c'è sconto" />
            </FormLayout.Group>
            <TextField label="Link prodotto" value={form.url} onChange={v => setField('url', v)}
              placeholder="https://tuo-store.myshopify.com/products/nome" autoComplete="off" />
            <TextField label="URL immagine" value={form.imageUrl} onChange={v => setField('imageUrl', v)}
              placeholder="https://cdn.shopify.com/..." autoComplete="off"
              helpText="Incolla il link diretto all'immagine" />
            <Select label="Categoria" options={categoryOptions} value={form.category}
              onChange={v => setField('category', v)} />
            <TextField label="Descrizione" value={form.description}
              onChange={v => setField('description', v)}
              placeholder="Breve descrizione del prodotto e dei suoi benefici..."
              multiline={3} autoComplete="off" />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
