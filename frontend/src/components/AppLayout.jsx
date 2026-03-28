import React, { useState, useCallback } from 'react';
import { Frame, Navigation, TopBar, Text } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';

const makeIcon = (emoji) => {
  const Icon = () => (
    <span role="img" aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, display: 'block' }}>
      {emoji}
    </span>
  );
  Icon.displayName = `Icon_${emoji}`;
  return Icon;
};

const IconHome     = makeIcon('🏠');
const IconDesign   = makeIcon('🎨');
const IconCopy     = makeIcon('✏️');
const IconProducts = makeIcon('📦');
const IconAI       = makeIcon('🤖');
const IconWidget   = makeIcon('💻');
const IconBilling  = makeIcon('💳');

export function AppLayout({ shop, children }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const handleNavToggle = useCallback(() => setMobileNavOpen(v => !v), []);
  const isActive = (path) => location.pathname === path;
  const generationsPercent = shop ? Math.round((shop.generationsUsed / shop.generationsLimit) * 100) : 0;

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        title="NextClick Studio"
        items={[{
          label: 'Dashboard', icon: IconHome, selected: isActive('/'),
          onClick: () => { navigate('/'); setMobileNavOpen(false); },
        }]}
      />
      <Navigation.Section
        title="Customization"
        items={[
          { label: 'Design', icon: IconDesign, selected: isActive('/design'), onClick: () => { navigate('/design'); setMobileNavOpen(false); } },
          { label: 'Texts & Questions', icon: IconCopy, selected: isActive('/copy'), onClick: () => { navigate('/copy'); setMobileNavOpen(false); } },
          { label: 'Products', icon: IconProducts, selected: isActive('/products'), onClick: () => { navigate('/products'); setMobileNavOpen(false); }, badge: shop?.config?.products?.length > 0 ? null : 'Setup' },
          { label: 'AI Persona', icon: IconAI, selected: isActive('/ai-persona'), onClick: () => { navigate('/ai-persona'); setMobileNavOpen(false); } },
        ]}
      />
      <Navigation.Section
        title="Widget"
        items={[{ label: 'Install Widget', icon: IconWidget, selected: isActive('/widget'), onClick: () => { navigate('/widget'); setMobileNavOpen(false); } }]}
      />
      <Navigation.Section
        title="Plan"
        items={[{
          label: `Plan ${shop?.planName || 'Starter'}`, icon: IconBilling, selected: isActive('/billing'),
          onClick: () => { navigate('/billing'); setMobileNavOpen(false); },
          badge: generationsPercent > 80 ? `${generationsPercent}%` : null,
        }]}
      />
    </Navigation>
  );

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      onNavigationToggle={handleNavToggle}
      userMenu={
        <TopBar.UserMenu
          actions={[]} name={shop?.ownerName || 'Merchant'} detail={shop?.shopDomain}
          initials={(shop?.ownerName || 'M')[0].toUpperCase()} open={false} onToggle={() => {}}
        />
      }
    />
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Frame navigation={navigationMarkup} topBar={topBarMarkup} showMobileNavigation={mobileNavOpen} onNavigationDismiss={handleNavToggle}>
        <div style={{ minHeight: '100%', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {children}
        </div>
      </Frame>
    </div>
  );
}
