import clsx from 'clsx';

export function Badge({
  label,
  tone = 'neutral'
}: {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
        tone === 'success' && 'bg-emerald-100 text-emerald-700',
        tone === 'warning' && 'bg-amber-100 text-amber-700',
        tone === 'danger' && 'bg-rose-100 text-rose-700',
        tone === 'neutral' && 'bg-slate-100 text-slate-700'
      )}
    >
      {label}
    </span>
  );
}
