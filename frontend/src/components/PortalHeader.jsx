import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useTriageStore from '../store/useTriageStore';
import { cn } from '../lib/utils';
import { BrandLockup } from './Brand';
import ThemeToggle from './ThemeToggle';

export default function PortalHeader({
  roleLabel = '',
  userName = '',
  homePath = '/',
  children = null,
}) {
  const navigate = useNavigate();
  const socketConnected = useTriageStore((state) => state.socketConnected);

  const handleSignOut = () => {
    // /logout clears the session from a public route, then returns home.
    navigate('/logout', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-forest-border bg-forest text-forest-ink">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLockup to={homePath} light />

          {roleLabel && (
            <span className="hidden rounded-[4px] border border-forest-border bg-white/5 px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-forest-muted lg:inline-flex">
              {roleLabel}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 text-xs font-medium text-forest-muted sm:flex">
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 rounded-[1px]',
                socketConnected ? 'bg-signal-success' : 'bg-signal-amber'
              )}
            />
            {socketConnected ? 'Live updates' : 'Reconnecting'}
          </span>

          {userName && (
            <span className="hidden max-w-[180px] truncate text-xs font-medium text-forest-muted md:inline">
              {userName}
            </span>
          )}

          {children}

          <ThemeToggle tone="forest" />

          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-forest-border bg-white/5 px-2.5 text-sm font-medium text-forest-ink transition-colors duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand/30 sm:px-3"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
