/**
 * AppLayout — ZelarSOAR admin shell (design.md §3).
 * Forest sidebar (240px, sticky ≥1024px / focus-trapped drawer below), top bar
 * with route-meta eyebrow + title, tenant switcher visual, FULL ACCESS pill,
 * AK avatar, <Outlet/>, ToastProvider (aria-live viewport included).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  Bell,
  Building2,
  ChevronDown,
  Flag,
  Globe,
  KeyRound,
  Layers,
  LayoutGrid,
  ListChecks,
  Menu,
  Palette,
  ShieldCheck,
  ShieldPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRouteMeta } from '@/lib/routes';
import GqlChip from './GqlChip';
import StatusPill from './StatusPill';
import { ToastProvider } from './Toast';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  badge?: { text: string; tone: 'brand' | 'neutral' };
  end?: boolean;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Main',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
      { to: '/alerts', label: 'AI Alerts', icon: Bell, badge: { text: '65,663', tone: 'brand' } },
      { to: '/incidents', label: 'Incidents', icon: Flag },
      { to: '/soar-policies', label: 'SOAR Policies', icon: ShieldPlus },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/tenants', label: 'Tenants', icon: Building2, badge: { text: '8', tone: 'neutral' } },
      { to: '/users-roles', label: 'Users & Roles', icon: UsersRound },
      { to: '/licensing', label: 'Licensing', icon: KeyRound },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/threat-map', label: 'Threat Map', icon: Globe },
      { to: '/audit-log', label: 'Audit Log', icon: ListChecks },
      { to: '/design-system', label: 'Design System', icon: Palette },
      { to: '/states', label: 'State Gallery', icon: Layers },
    ],
  },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Modules">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="nav-label">{group.label}</p>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cn('nav-item', isActive && 'active')}
                  onClick={onNavigate}
                >
                  <item.icon size={17} strokeWidth={1.7} aria-hidden="true" />
                  {item.label}
                  {item.badge && (
                    <StatusPill tone={item.badge.tone === 'brand' ? 'brand' : 'neutral'} className="ml-auto">
                      {item.badge.text}
                    </StatusPill>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="shrink-0 border-t border-white/10 p-4">
      <div className="rounded-[10px] border border-white/10 bg-white/5 p-3">
        <GqlChip kind="subscription" className="border-white/15 bg-white/10 text-[#F4F1E9]/80">
          subscription telemetryTick
        </GqlChip>
        <p className="mt-2 text-[11px] leading-snug text-[#F4F1E9]/50">
          Live regions powered by GraphQL subscriptions · Zelar Enterprise DS v1.0
        </p>
      </div>
    </div>
  );
}

function LogoBlock() {
  return (
    <span className="leading-tight">
      <span className="font-display block text-[15px] font-semibold tracking-tight text-[#F4F1E9]">ZelarSOAR</span>
      <span className="block text-[11px] text-[#F4F1E9]/50">Admin Portal</span>
    </span>
  );
}

function LogoTile() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-calm text-white" aria-hidden="true">
      <ShieldCheck size={18} strokeWidth={1.8} />
    </span>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const meta = getRouteMeta(location.pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuBtnRef.current?.focus();
  }, []);

  // ESC closes; simple focus trap while open.
  useEffect(() => {
    if (!drawerOpen) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeDrawer();
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [drawerOpen, closeDrawer]);

  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-[14px] focus:py-2 focus:text-[13px] focus:text-white"
      >
        Skip to main content
      </a>

      <div className="flex min-h-[100dvh]">
        {/* Persistent sidebar ≥1024px — sticky, in normal flow */}
        <aside
          className="sticky top-0 hidden h-[100dvh] w-[240px] shrink-0 flex-col bg-forest lg:flex"
          aria-label="Primary navigation"
        >
          <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
            <LogoTile />
            <LogoBlock />
          </div>
          <SidebarNav />
          <SidebarFooter />
        </aside>

        {/* Mobile drawer <1024px */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-[rgba(30,27,34,.35)] lg:hidden"
            aria-hidden="true"
            onClick={closeDrawer}
          />
        )}
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-forest transition-transform duration-200 lg:hidden',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
            <LogoTile />
            <LogoBlock />
            <button
              ref={closeBtnRef}
              type="button"
              className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-[#F4F1E9]/70 hover:bg-forest-2"
              aria-label="Close navigation"
              onClick={closeDrawer}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          <SidebarFooter />
        </div>

        {/* Content column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-[rgba(247,245,240,.9)] backdrop-blur-sm">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                ref={menuBtnRef}
                type="button"
                className="grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-line bg-white text-ink-2 hover:bg-[#FCFBF8] lg:hidden"
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
              >
                <Menu size={17} aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="eyebrow">
                  {meta.group} · {meta.section}
                </p>
                <h1 className="font-display truncate text-[17px] font-semibold leading-tight">{meta.title}</h1>
              </div>
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  className="hidden h-9 items-center gap-2 rounded-[10px] border border-line bg-white px-3 text-[12.5px] font-medium text-ink-2 hover:border-[#CFC8B8] md:flex"
                >
                  <Building2 size={14} strokeWidth={1.8} aria-hidden="true" />
                  Active tenant: <span className="font-semibold text-ink">Global (all 8)</span>
                  <ChevronDown size={12} aria-hidden="true" />
                </button>
                <StatusPill tone="calm">
                  <ShieldCheck size={11} strokeWidth={2.2} aria-hidden="true" />
                  FULL ACCESS
                </StatusPill>
                <span
                  className="font-display grid h-9 w-9 place-items-center rounded-full bg-brand-tint text-[12.5px] font-semibold text-brand-ink"
                  role="img"
                  aria-label="Signed in as Ana Kovač, platform admin"
                >
                  AK
                </span>
              </div>
            </div>
          </header>

          <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 space-y-5 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
