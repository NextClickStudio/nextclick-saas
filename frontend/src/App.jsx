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
  const { shop, loading } = useShopData();

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize: 32 }}>⚡</div>
        <div style={{ fontSize: 16, color: '#6D7175' }}>Caricamento NextClick Studio...</div>
      </div>
    );
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

  const appBridgeConfig = {
    apiKey: process.env.REACT_APP_SHOPIFY_API_KEY || '',
    host,
    forceRedirect: true,
  };

  return (
    <AppProvider i18n={enTranslations} appBridgeConfig={appBridgeConfig}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  );
}
