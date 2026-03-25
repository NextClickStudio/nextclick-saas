import React, { useEffect, useState } from 'react';
import {
  Page, Card, Text, BlockStack, InlineStack,
  Button, Banner, Spinner
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

export function Dashboard() {
  const [data,    setData]    = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview?days=30'),
      api.get('/billing/status'),
    ]).then(([analytics, bill]) => {
      setData(analytics.data);
      setBilling(bill.data);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Page title="Dashboard">
      <div style={{ padding: 80, textAlign: 'center' }}><Spinner /></div>
    </Page>
  );

  const percent = billing?.percentUsed || 0;

  return (
    <Page
      title="Dashboard"
      subtitle="Panoramica del tuo AI Advisor"
    >
      <BlockStack gap="500">

        {percent > 80 && (
          <Banner tone={percent >= 100 ? 'critical' : 'warning'} action={percent >= 100 ? { content: 'Aggiorna piano', url: '/billing' } : undefined}>
            <p>{percent >= 100
              ? '⛔ Limite generazioni raggiunto. Il widget è bloccato.'
              : `⚠️ Hai usato il ${percent}% delle generazioni disponibili.`}
            </p>
          </Banner>
        )}

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Generazioni (30gg)', value: data?.recentGenerations?.toLocaleString() || '0', icon: '⚡', color: '#006494' },
            { label: 'Click prodotti',     value: data?.totalClicks?.toLocaleString() || '0',       icon: '👆', color: '#1A7A4A' },
            { label: 'Click rate',         value: `${data?.clickRate || 0}%`,                        icon: '📊', color: '#8B2FC9' },
            { label: 'Tempo medio gen.',   value: `${((data?.avgDurationMs || 0) / 1000).toFixed(1)}s`, icon: '⏱️', color: '#C05717' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: '#fff', border: '1px solid #E4E5E7', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, color: '#6D7175', marginBottom: 8 }}>{kpi.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>{kpi.icon}</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: kpi.color }}>{kpi.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Generazioni */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd">Generazioni questo mese</Text>
              <div style={{
                background: '#F6F6F7', border: '1px solid #E4E5E7',
                borderRadius: 99, padding: '2px 12px', fontSize: 12, fontWeight: 600,
              }}>
                Piano {billing?.planName?.toUpperCase() || 'STARTER'}
              </div>
            </InlineStack>
            <div style={{ background: '#E4E5E7', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(percent, 100)}%`, height: '100%',
                background: percent > 80 ? '#D72C0D' : '#008060',
                transition: 'width .3s',
              }} />
            </div>
            <InlineStack align="space-between">
              <Text variant="bodySm" tone="subdued">{billing?.generationsUsed?.toLocaleString() || 0} usate</Text>
              <Text variant="bodySm" tone="subdued">{billing?.generationsLimit?.toLocaleString() || 0} totali</Text>
            </InlineStack>
            {billing?.planName !== 'scale' && (
              <Button size="slim" url="/billing">Aumenta limite →</Button>
            )}
          </BlockStack>
        </Card>

        {/* Azioni rapide */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">Azioni rapide</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {[
                { label: '🎨 Modifica design',   url: '/design'     },
                { label: '📦 Gestisci prodotti', url: '/products'   },
                { label: '✏️ Modifica testi',    url: '/copy'       },
                { label: '🤖 AI Persona',        url: '/ai-persona' },
              ].map(a => (
                <Button key={a.url} url={a.url}>{a.label}</Button>
              ))}
            </div>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}
