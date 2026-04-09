import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-black/5 backdrop-blur',
        className
      )}
      {...props}
    />
  );
}
