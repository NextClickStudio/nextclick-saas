import React from 'react';
import { Frame, Navigation, TopBar } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';

const makeIcon = (emoji) => () => (
  <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
);

const IconHome     = makeIcon('🏠');
const IconDesign   = makeIcon('🎨');
const IconCopy     = makeIcon('✏️');
const IconProducts = makeIcon('📦');
const IconAI       = makeIcon('🤖');
const IconWidget   = makeIcon('💻');
const IconBilling  = makeIcon('💳');

export function AppLayout({ shop, children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  const generationsPercent = shop
    ? Math.round((shop.generationsUsed / shop.generationsLimit) * 100)
    : 0;

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        title="NextClick Studio"
        items={[
          {
            label: 'Dashboard',
            icon: IconHome,
            selected: isActive('/'),
            onClick: () => navigate('/'),
          },
        ]}
      />
      <Navigation.Section
        title="Personalizzazione"
        items={[
          {
            label: 'Design',
            icon: IconDesign,
            selected: isActive('/design'),
            onClick: () => navigate('/design'),
          },
          {
            label: 'Testi & Domande',
            icon: IconCopy,
            selected: isActive('/copy'),
            onClick: () => navigate('/copy'),
          },
          {
            label: 'Prodotti',
            icon: IconProducts,
            selected: isActive('/products'),
            onClick: () => navigate('/products'),
            badge: shop?.config?.products?.length > 0 ? null : 'Setup',
          },
          {
            label: 'AI Persona',
            icon: IconAI,
            selected: isActive('/ai-persona'),
            onClick: () => navigate('/ai-persona'),
          },
        ]}
      />
      <Navigation.Section
        title="Widget"
        items={[
          {
            label: 'Installa Widget',
            icon: IconWidget,
            selected: isActive('/widget'),
            onClick: () => navigate('/widget'),
          },
        ]}
      />
      <Navigation.Section
        title="Piano"
        items={[
          {
            label: `Piano ${shop?.planName || 'Starter'}`,
            icon: IconBilling,
            selected: isActive('/billing'),
            onClick: () => navigate('/billing'),
            badge: generationsPercent > 80 ? `${generationsPercent}%` : null,
          },
        ]}
      />
    </Navigation>
  );

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      userMenu={
        <TopBar.UserMenu
          actions={[]}
          name={shop?.ownerName || 'Merchant'}
          detail={shop?.shopDomain}
          initials={(shop?.ownerName || 'M')[0].toUpperCase()}
        />
      }
    />
  );

  return (
    <Frame
      navigation={navigationMarkup}
      topBar={topBarMarkup}
      showMobileNavigation={false}
    >
      {children}
    </Frame>
  );
}
