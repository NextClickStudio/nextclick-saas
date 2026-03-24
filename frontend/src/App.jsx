import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

import { AppLayout } from './components/AppLayout';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { Dashboard } from './pages/Dashboard';
import { DesignEditor } from './pages/DesignEditor';
import { CopyEditor } from './pages/CopyEditor';
import { ProductsManager } from './pages/ProductsManager';
import { AIPersona } from './pages/AIPersona';
import { BillingPage } from './pages/BillingPage';
import { WidgetPage } from './pages/WidgetPage';
import { useShopData } from './hooks/useShopData';

function AppContent() {
  const { shop, loading, error } = useShopData();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16, background: '#F6F6F7',
      }}>
        <div style={{ fontSize: 40 }}>⚡</div>
        <div style={{ fontSize: 16, color: '#6D7175', fontFamily: 'Inter, sans-serif' }}>
          Caricamento NextClick Studio...
        </div>
      </div>
    );
  }

  if (error && (error.includes('Unauthorized') || error.includes('reinstall'))) {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop');
    if (shop) window.top.location.href = `/api/auth?shop=${shop}`;
    return null;
  }

  if (!shop || shop.planStatus === 'pending') {
    return <OnboardingWizard shop={shop} />;
  }

  return (
    <AppLayout shop={shop}>
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/design"     element={<DesignEditor />} />
        <Route path="/copy"       element={<CopyEditor />} />
        <Route path="/products"   element={<ProductsManager />} />
        <Route path="/ai-persona" element={<AIPersona />} />
        <Route path="/widget"     element={<WidgetPage />} />
        <Route path="/billing"    element={<BillingPage />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const host = params.get('host') || '';
  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY || '';

  // AppProvider in Polaris v13 handles AppBridge internally via appBridgeConfig
  return (
    <AppProvider
      i18n={enTranslations}
      apiKey={apiKey}
      host={host}
      forceRedirect={true}
    >
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  );
}
