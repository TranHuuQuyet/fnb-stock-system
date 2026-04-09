import { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: Props) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-brand-900">{label}</span> : null}
      <input
        className={clsx(
          'w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-brand-500',
          error && 'border-danger',
          className
        )}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}
