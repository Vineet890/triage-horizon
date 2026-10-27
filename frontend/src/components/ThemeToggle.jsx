import { Moon, Sun } from 'lucide-react';
import useTriageStore from '../store/useTriageStore';
import { cn } from '../lib/utils';

/**
 * Accessible theme control. `tone="forest"` sits on the deep forest chrome,
 * `tone="surface"` sits on warm paper cards and headers.
 */
export default function ThemeToggle({ tone = 'surface', className = '' }) {
  const theme = useTriageStore((state) => state.theme);
  const toggleTheme = useTriageStore((state) => state.toggleTheme);
  const isDark = theme === 'dark';
  const nextLabel = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextLabel} theme`}
      title={`Switch to ${nextLabel} theme`}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30',
        tone === 'forest'
          ? 'border-forest-border bg-white/5 text-forest-muted hover:bg-white/10 hover:text-forest-ink'
          : 'border-border bg-surface text-ink-secondary hover:bg-surface-muted hover:text-ink',
        className
      )}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Moon aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}
