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

const loaderStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: '100vh', flexDirection: 'column', gap: 16, background: '#F6F6F7',
};

function Loader({ text }) {
  return (
    <div style={loaderStyle}>
      <div style={{ fontSize: 40 }}>⚡</div>
      <div style={{ fontSize: 16, color: '#6D7175', fontFamily: 'Inter, sans-serif' }}>
        {text || 'Caricamento NextClick Studio...'}
      </div>
    </div>
  );
}

function AppContent() {
  const { shop, loading, error } = useShopData();

  if (loading) return <Loader />;

  // Any API error means session is invalid — redirect to OAuth
  if (error) {
    const p = new URLSearchParams(window.location.search);
    const shopParam = p.get('shop');
    if (shopParam) {
      window.top.location.href = '/api/auth?shop=' + shopParam;
      return <Loader text="Autenticazione in corso..." />;
    }
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#D72C0D' }}>Errore di autenticazione.</p>
        <p style={{ fontSize: 13, color: '#6D7175' }}>
          Reinstalla l&apos;app dal pannello Shopify.
        </p>
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
  return (
    <AppProvider i18n={enTranslations}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  );
}
