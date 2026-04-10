"use client";

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

type IngredientUnitOption = {
  id: string;
  name: string;
};

type IngredientUnitSelectProps = {
  label: string;
  value: string;
  options: IngredientUnitOption[];
  error?: string;
  createError?: string;
  disabled?: boolean;
  isCreating?: boolean;
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<void>;
};

const formatUnitName = (value: string) => value.trim().replace(/\s+/g, ' ');

export function IngredientUnitSelect({
  label,
  value,
  options,
  error,
  createError,
  disabled,
  isCreating,
  onChange,
  onCreate
}: IngredientUnitSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
        setNewUnitName('');
        setLocalError('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((option) => option.name === value)?.name ?? value;
  const helperMessage = createError ?? localError;

  const handleCreate = async () => {
    const formattedValue = formatUnitName(newUnitName);
    if (!formattedValue) {
      setLocalError('Vui lòng nhập đơn vị mới');
      return;
    }

    setLocalError('');

    try {
      await onCreate(formattedValue);
      setNewUnitName('');
      setIsAdding(false);
      setIsOpen(false);
    } catch {
      // The parent mutation exposes the API error.
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <span className="block text-sm font-medium text-brand-900">{label}</span>
      <div className="relative">
        <button
          type="button"
          className={clsx(
            'flex w-full items-center justify-between rounded-xl border border-brand-100 bg-white px-4 py-3 text-left text-sm text-brand-900 shadow-sm outline-none transition focus:border-brand-500',
            (error || createError || localError) && 'border-danger',
            disabled && 'cursor-not-allowed bg-slate-50 text-slate-400'
          )}
          onClick={() => {
            if (!disabled) {
              setIsOpen((current) => !current);
            }
          }}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          disabled={disabled}
        >
          <span className={value ? 'text-brand-900' : 'text-slate-400'}>
            {selectedLabel || 'Chọn đơn vị'}
          </span>
          <ChevronDown className={clsx('h-4 w-4 transition', isOpen && 'rotate-180')} />
        </button>

        {isOpen ? (
          <div className="absolute z-20 mt-2 w-full rounded-2xl border border-brand-100 bg-white p-2 shadow-xl">
            <div className="max-h-72 space-y-1 overflow-y-auto" role="listbox">
              {options.length > 0 ? (
                options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={clsx(
                      'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition',
                      option.name === value
                        ? 'bg-brand-50 font-semibold text-brand-900'
                        : 'text-slate-700 hover:bg-brand-50'
                    )}
                    onClick={() => {
                      onChange(option.name);
                      setIsOpen(false);
                      setIsAdding(false);
                      setNewUnitName('');
                      setLocalError('');
                    }}
                  >
                    {option.name}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-slate-500">
                  Chưa có đơn vị nào, bạn có thể thêm mới ngay tại đây.
                </p>
              )}
            </div>

            <div className="mt-2 border-t border-brand-50 pt-2">
              {!isAdding ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                  onClick={() => {
                    setIsAdding(true);
                    setLocalError('');
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Thêm đơn vị
                </button>
              ) : (
                <div className="space-y-2 px-1 pb-1">
                  <input
                    value={newUnitName}
                    onChange={(event) => {
                      setNewUnitName(event.target.value);
                      setLocalError('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleCreate();
                      }

                      if (event.key === 'Escape') {
                        setIsAdding(false);
                        setNewUnitName('');
                        setLocalError('');
                      }
                    }}
                    autoFocus
                    placeholder="Nhập đơn vị mới"
                    className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900 outline-none placeholder:text-slate-400 focus:border-brand-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => void handleCreate()}
                      disabled={isCreating}
                    >
                      {isCreating ? 'Đang lưu...' : 'Lưu đơn vị'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setIsAdding(false);
                        setNewUnitName('');
                        setLocalError('');
                      }}
                      disabled={isCreating}
                    >
                      Hủy
                    </Button>
                  </div>
                  <p className={clsx('text-xs', helperMessage ? 'text-danger' : 'text-slate-500')}>
                    {helperMessage ?? 'Đơn vị mới sẽ được lưu lại và xuất hiện trong danh sách này.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
