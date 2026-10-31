import { Link, useNavigate } from 'react-router-dom';
import { LogOut, UserCircle } from 'lucide-react';
import useTriageStore from '../store/useTriageStore';
import { cn } from '../lib/utils';
import { BrandLockup } from './Brand';
import ThemeToggle from './ThemeToggle';

export default function PortalHeader({
  roleLabel = '',
  userName = '',
  homePath = '/',
  rightActions = null,
}) {
  const navigate = useNavigate();
  const socketConnected = useTriageStore((state) => state.socketConnected);
  const auth = useTriageStore((state) => state.auth);

  const handleSignOut = () => {
    navigate('/logout', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#2B4538] bg-[#162820]/95 text-white shadow-md backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <BrandLockup to={homePath} light />

          {/* Quick Role Switcher */}
          <nav aria-label="Portal Switcher" className="hidden md:flex items-center gap-1 rounded-full border border-[#2B4538] bg-[#0E1A15]/80 p-1">
            <Link
              to="/patient"
              className={cn(
                'rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all',
                auth?.role === 'PATIENT'
                  ? 'bg-[#82AF96] text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              )}
            >
              Patient
            </Link>
            <Link
              to="/doctor"
              className={cn(
                'rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all',
                auth?.role === 'DOCTOR'
                  ? 'bg-[#A3C9B4] text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              )}
            >
              Doctor
            </Link>
            <Link
              to="/admin"
              className={cn(
                'rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all',
                auth?.role === 'ADMIN'
                  ? 'bg-[#5E987E] text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              )}
            >
              Admin
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {rightActions}

          <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-300 sm:flex">
            <span className="relative flex h-2 w-2">
              {socketConnected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  socketConnected ? 'bg-emerald-500' : 'bg-amber-500'
                )}
              />
            </span>
            <span className="font-mono text-[10px] font-semibold text-slate-300">
              {socketConnected ? 'NETWORK LIVE' : 'RECONNECTING'}
            </span>
          </div>

          {userName && (
            <div className="hidden items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/40 py-1 pl-2 pr-3 text-xs font-medium text-slate-300 lg:inline-flex">
              <UserCircle className="h-4 w-4 text-teal-400" />
              <span className="max-w-[160px] truncate">{userName}</span>
            </div>
          )}

          <ThemeToggle tone="forest" />

          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-slate-600 hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          >
            <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
