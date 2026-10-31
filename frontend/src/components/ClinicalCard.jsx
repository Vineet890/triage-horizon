import { cn } from '../lib/utils';

export default function ClinicalCard({ children, className = '', hoverEffect = false, ...rest }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-surface p-6 shadow-sm transition-all duration-200',
        hoverEffect && 'hover:border-brand/40 hover:shadow-md',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
