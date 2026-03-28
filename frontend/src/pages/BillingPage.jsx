import React, { useState, useEffect } from 'react';
import { Page, Card, BlockStack, InlineStack, Text, Button, Badge, Banner } from '@shopify/polaris';
import { api } from '../hooks/useShopData';

const PLANS = [
  { key: 'starter', name: 'Starter', price: '$49',  period: '/mo', gen: '1,000',   color: '#006494', features: ['Product recommendations','Embeddable widget','Basic analytics','7-day free trial'], missing: ['Full routine','PDF download','AI auto-tagging'] },
  { key: 'pro',     name: 'Pro',     price: '$199', period: '/mo', gen: '10,000',  color: '#8B2FC9', recommended: true, features: ['Full routine + products','PDF download','AI auto-tagging','Custom AI Persona','Advanced analytics','7-day free trial'], missing: [] },
  { key: 'scale',   name: 'Scale',   price: '$499', period: '/mo', gen: '100,000', color: '#1A7A4A', features: ['Everything in Pro','100k generations/mo','Priority support','CSV data export'], missing: [] },
];

export function BillingPage() {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(null);

  useEffect(() => { api.get('/billing/status').then(({ data }) => setBilling(data)); }, []);

  async function handleUpgrade(planKey) {
    setLoading(planKey);
    try {
      const { data } = await api.post('/billing/subscribe', { planName: planKey });
      window.top.location.href = data.confirmationUrl;
    } catch (err) { alert(err.response?.data?.error || 'Error during subscription'); setLoading(null); }
  }

  return (
    <Page title="Plan & Generations">
      <BlockStack gap="500">
        {billing && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd">Current plan</Text>
                <Badge tone={billing.planStatus === 'active' ? 'success' : 'warning'}>
                  {billing.planName?.toUpperCase()} — {billing.planStatus}
                </Badge>
              </InlineStack>
              <InlineStack align="space-between">
                <Text variant="bodySm" tone="subdued">Generations used this month</Text>
                <Text variant="bodySm" fontWeight="semibold">{billing.generationsUsed?.toLocaleString()} / {billing.generationsLimit?.toLocaleString()}</Text>
              </InlineStack>
              <div style={{ background: '#E4E5E7', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: (billing.percentUsed || 0) + '%', height: '100%', background: billing.percentUsed > 80 ? '#D72C0D' : '#008060', transition: 'width .3s' }} />
              </div>
              {billing.percentUsed > 80 && (
                <Banner tone="warning"><p>You are using <strong>{billing.percentUsed}%</strong> of your generations. Consider upgrading to avoid blocking the widget.</p></Banner>
              )}
            </BlockStack>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {PLANS.map(plan => {
            const isCurrent = billing?.planName === plan.key;
            return (
              <div key={plan.key} style={{ border: '2px solid ' + (isCurrent ? plan.color : '#E4E5E7'), borderRadius: 12, padding: 20, background: isCurrent ? plan.color + '10' : '#fff', position: 'relative' }}>
                {plan.recommended && <div style={{ position: 'absolute', top: -12, right: 16, background: '#008060', color: '#fff', borderRadius: 99, padding: '2px 12px', fontSize: 11, fontWeight: 700 }}>⭐ Recommended</div>}
                <BlockStack gap="200">
                  <Text variant="headingLg" fontWeight="bold">{plan.name}</Text>
                  <div><span style={{ fontSize: 28, fontWeight: 800, color: plan.color }}>{plan.price}</span><span style={{ fontSize: 13, color: '#6D7175' }}>{plan.period}</span></div>
                  <Text variant="bodySm" tone="subdued">{plan.gen} generations/month</Text>
                  <div style={{ borderTop: '1px solid #E4E5E7', paddingTop: 12, marginTop: 4 }}>
                    <BlockStack gap="100">
                      {plan.features.map(f => <Text key={f} variant="bodySm" as="p">✅ {f}</Text>)}
                      {plan.missing.map(f => <Text key={f} variant="bodySm" tone="subdued" as="p">❌ {f}</Text>)}
                    </BlockStack>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {isCurrent ? <Badge tone="success">✓ Active plan</Badge>
                      : <Button variant="primary" onClick={() => handleUpgrade(plan.key)} loading={loading === plan.key} fullWidth>Select {plan.name}</Button>}
                  </div>
                </BlockStack>
              </div>
            );
          })}
        </div>

        <Card>
          <Text variant="bodySm" tone="subdued">💳 Payment is handled via Shopify Billing. You get a 7-day free trial on every plan. The generation limit resets automatically every 30 days.</Text>
        </Card>
      </BlockStack>
    </Page>
  );
}
