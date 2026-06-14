import { Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Building2, Settings, MessageCircle, Languages, Sun, Moon, Monitor } from 'lucide-react';
import DashboardPage from './pages/Dashboard';
import ReservationsPage from './pages/Reservations';
import InventoryPage from './pages/Inventory';
import SettingsPage from './pages/Settings';
import ConversationsPage from './pages/Conversations';
import { useI18n } from './lib/i18n';
import { useTheme, Theme } from './lib/theme';

const navItems = [
  { to: '/', key: 'nav_overview', icon: LayoutDashboard, exact: true },
  { to: '/conversations', key: 'nav_conversations', icon: MessageCircle },
  { to: '/reservations', key: 'nav_reservations', icon: CalendarDays },
  { to: '/inventory', key: 'nav_inventory', icon: Building2 },
  { to: '/settings', key: 'nav_settings', icon: Settings },
];

export default function App() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  const themeOptions: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: t('theme_light') },
    { value: 'dark', icon: Moon, label: t('theme_dark') },
    { value: 'system', icon: Monitor, label: t('theme_system') },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg text-app-text">
      {/* Sidebar */}
      <aside className="w-60 bg-app-surface border-r border-app-border flex flex-col shrink-0">
        {/* Brand header — WhatsApp green */}
        <div className="px-4 py-4 bg-wa-dark text-white flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <MessageCircle size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">{t('app_title')}</h1>
            <p className="text-[11px] text-white/70">{t('app_subtitle')}</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, key, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-wa/15 text-wa-dark dark:text-wa font-medium'
                    : 'text-app-muted hover:text-app-text hover:bg-app-elevated'
                }`
              }
            >
              <Icon size={16} />
              {t(key)}
            </NavLink>
          ))}
        </nav>

        {/* Theme switcher */}
        <div className="px-3 py-3 border-t border-app-border">
          <div className="flex items-center gap-2 mb-2 text-xs text-app-muted">
            <Sun size={13} /> {t('theme')}
          </div>
          <div className="flex gap-1">
            {themeOptions.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={label}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  theme === value ? 'bg-wa text-white' : 'bg-app-elevated text-app-muted hover:text-app-text'
                }`}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
        </div>

        {/* Language switcher */}
        <div className="px-3 py-3 border-t border-app-border">
          <div className="flex items-center gap-2 mb-2 text-xs text-app-muted">
            <Languages size={13} /> {t('language')}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setLang('es')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                lang === 'es' ? 'bg-wa text-white' : 'bg-app-elevated text-app-muted hover:text-app-text'
              }`}
            >
              Español
            </button>
            <button
              onClick={() => setLang('en')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                lang === 'en' ? 'bg-wa text-white' : 'bg-app-elevated text-app-muted hover:text-app-text'
              }`}
            >
              English
            </button>
          </div>
        </div>

        <div className="px-4 py-2 border-t border-app-border">
          <p className="text-xs text-app-muted/60">v1.0.0</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-app-bg">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
