import React, { useEffect } from 'react';
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

// Safe redirect that works both inside and outside Shopify iframe
function redirectToAuth(shopParam) {
  const authUrl = '/api/auth?shop=' + shopParam;
  try {
    // Try top-level navigation first (works if not in iframe)
    if (window.top === window.self) {
      window.location.href = authUrl;
    } else {
      // Inside Shopify iframe — use postMessage to ask parent to navigate
      // This is what Shopify App Bridge does internally
      window.top.location.href = authUrl;
    }
  } catch (e) {
    // SecurityError: can't access window.top cross-origin
    // Use Shopify's redirect mechanism via the parent frame
    window.parent.postMessage(
      JSON.stringify({
        message: 'Shopify.API.remoteRedirect',
        data: { location: window.location.origin + authUrl },
      }),
      'https://admin.shopify.com'
    );
  }
}

function AppContent() {
  const { shop, loading, error } = useShopData();
  const params = new URLSearchParams(window.location.search);
  const shopParam = params.get('shop');

  useEffect(() => {
    if (!loading && error && shopParam) {
      redirectToAuth(shopParam);
    }
  }, [loading, error, shopParam]);

  if (loading) return <Loader />;

  if (error) {
    return <Loader text="Autenticazione in corso..." />;
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
