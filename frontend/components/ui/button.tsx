import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
};

export function Button({
  className,
  variant = 'primary',
  fullWidth,
  ...props
}: Props) {
  return (
    <button
      className={clsx(
        'rounded-xl px-4 py-3 text-sm font-semibold transition',
        fullWidth && 'w-full',
        variant === 'primary' && 'bg-brand-700 text-white hover:bg-brand-900',
        variant === 'secondary' && 'bg-white text-brand-900 ring-1 ring-brand-100 hover:bg-brand-50',
        variant === 'danger' && 'bg-danger text-white hover:opacity-90',
        variant === 'ghost' && 'bg-transparent text-brand-900 hover:bg-brand-50',
        className
      )}
      {...props}
    />
  );
}
