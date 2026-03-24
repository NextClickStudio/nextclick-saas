import React from 'react';
import { Frame, Navigation, TopBar, Icon, Badge } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon, PaintBrushIcon, TypeIcon, ProductIcon,
  ChatIcon, CodeIcon, CreditCardIcon
} from '@shopify/polaris-icons';

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
            icon: HomeIcon,
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
            icon: PaintBrushIcon,
            selected: isActive('/design'),
            onClick: () => navigate('/design'),
          },
          {
            label: 'Testi & Domande',
            icon: TypeIcon,
            selected: isActive('/copy'),
            onClick: () => navigate('/copy'),
          },
          {
            label: 'Prodotti',
            icon: ProductIcon,
            selected: isActive('/products'),
            onClick: () => navigate('/products'),
            badge: shop?.config?.products?.length > 0 ? null : 'Setup',
          },
          {
            label: 'AI Persona',
            icon: ChatIcon,
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
            icon: CodeIcon,
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
            icon: CreditCardIcon,
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
