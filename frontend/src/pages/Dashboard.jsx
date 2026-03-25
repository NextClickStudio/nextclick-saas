import React, { useEffect, useState } from 'react';
import {
  Page, Card, Grid, Text, BlockStack, InlineStack,
  ProgressBar, Badge, Button, DataTable, Banner, Spinner
} from '@shopify/polaris';
import { api } from '../hooks/useShopData';

export function Dashboard() {
  const [data, setData] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview?days=30'),
      api.get('/billing/status'),
    ]).then(([analytics, bill]) => {
      setData(analytics.data);
      setBilling(bill.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  const planColors = { starter: '#006494', pro: '#8B2FC9', scale: '#1A7A4A' };
  const planColor = planColors[billing?.planName] || '#006494';

  return (
    <Page
      title="Dashboard"
      subtitle="Panoramica del tuo AI Advisor"
      primaryAction={
        <Button variant="primary" url="/widget">
          📲 Installa Widget
        </Button>
      }
    >
      <BlockStack gap="500">

        {/* Generation limit warning */}
        {billing?.percentUsed > 80 && (
          <Banner
            tone={billing.percentUsed >= 100 ? 'critical' : 'warning'}
            action={billing.percentUsed >= 100 ? { content: 'Aggiorna piano', url: '/billing' } : undefined}
          >
            <p>
              {billing.percentUsed >= 100
                ? '⛔ Limite generazioni raggiunto. Il widget è bloccato fino al prossimo ciclo o aggiornamento piano.'
                : `⚠️ Hai usato l'${billing.percentUsed}% delle generazioni. Considera l'upgrade del piano.`}
            </p>
          </Banner>
        )}

        {/* KPI Cards */}
        <Grid columns={{ xs: 2, sm: 4 }} gap={{ xs: '300', sm: '400' }}>
          <KpiCard
            title="Generazioni (30gg)"
            value={data?.recentGenerations?.toLocaleString() || '0'}
            icon="⚡"
            color="#006494"
          />
          <KpiCard
            title="Click prodotti"
            value={data?.totalClicks?.toLocaleString() || '0'}
            icon="👆"
            color="#1A7A4A"
          />
          <KpiCard
            title="Click rate"
            value={`${data?.clickRate || 0}%`}
            icon="📊"
            color="#8B2FC9"
          />
          <KpiCard
            title="Tempo medio gen."
            value={`${((data?.avgDurationMs || 0) / 1000).toFixed(1)}s`}
            icon="⏱️"
            color="#C05717"
          />
        </Grid>

        {/* Generation Usage */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text variant="headingMd">Generazioni questo mese</Text>
              <Badge style={{ background: planColor, color: '#fff' }}>
                Piano {billing?.planName?.toUpperCase()}
              </Badge>
            </InlineStack>
            <ProgressBar
              progress={billing?.percentUsed || 0}
              tone={billing?.percentUsed > 80 ? 'critical' : 'highlight'}
            />
            <InlineStack align="space-between">
              <Text variant="bodySm" tone="subdued">
                {billing?.generationsUsed?.toLocaleString()} usate
              </Text>
              <Text variant="bodySm" tone="subdued">
                {billing?.generationsLimit?.toLocaleString()} totali
              </Text>
            </InlineStack>
            {billing?.planName !== 'scale' && (
              <Button size="slim" url="/billing">Aumenta limite →</Button>
            )}
          </BlockStack>
        </Card>

        {/* Top Products */}
        {data?.topProducts?.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd">Prodotti più cliccati (30gg)</Text>
              <DataTable
                columnContentTypes={['text', 'numeric']}
                headings={['Prodotto', 'Click']}
                rows={data.topProducts.map(p => [p.title, p.clicks])}
              />
            </BlockStack>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">Azioni rapide</Text>
            <InlineStack gap="300" wrap>
              <Button url="/design">🎨 Modifica design</Button>
              <Button url="/products">📦 Gestisci prodotti</Button>
              <Button url="/copy">✏️ Modifica testi</Button>
              <Button url="/ai-persona">🤖 AI Persona</Button>
            </InlineStack>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}

function KpiCard({ title, value, icon, color }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="bodySm" tone="subdued">{title}</Text>
        <InlineStack gap="200" blockAlign="center">
          <span style={{ fontSize: 24 }}>{icon}</span>
          <Text variant="heading2xl" as="p" fontWeight="bold" style={{ color }}>
            {value}
          </Text>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
