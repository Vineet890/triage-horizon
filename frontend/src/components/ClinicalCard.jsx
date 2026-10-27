import { cn } from '../lib/utils';

export default function ClinicalCard({ children, className = '', ...rest }) {
  return (
    <div
      className={cn(
        'rounded-[6px] border border-border bg-surface p-6',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
