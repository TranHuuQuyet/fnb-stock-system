"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { IngredientUnitOption } from '@/services/admin/ingredients';

type IngredientUnitDropdownProps = {
  label: string;
  value: string;
  options: IngredientUnitOption[];
  error?: string;
  actionError?: string;
  disabled?: boolean;
  isCreating?: boolean;
  updatingUnitId?: string | null;
  deletingUnitId?: string | null;
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClearActionError?: () => void;
};

const formatUnitName = (value: string) => value.trim().replace(/\s+/g, ' ');

export function IngredientUnitDropdown({
  label,
  value,
  options,
  error,
  actionError,
  disabled,
  isCreating,
  updatingUnitId,
  deletingUnitId,
  onChange,
  onCreate,
  onUpdate,
  onDelete,
  onClearActionError
}: IngredientUnitDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [newUnitName, setNewUnitName] = useState('');
  const [editingName, setEditingName] = useState('');
  const [localError, setLocalError] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const availableBelow = viewportHeight - rect.bottom - 12;
      const availableAbove = rect.top - 12;
      const openAbove = availableBelow < 260 && availableAbove > availableBelow;
      const panelMaxHeight = Math.max(
        180,
        Math.min(360, openAbove ? availableAbove - 8 : availableBelow - 8)
      );
      const width = Math.min(rect.width, viewportWidth - 16);
      const left = Math.min(Math.max(8, rect.left), viewportWidth - width - 8);

      setDropdownStyle({
        position: 'fixed',
        top: openAbove ? Math.max(8, rect.top - panelMaxHeight - 8) : rect.bottom + 8,
        left,
        width,
        maxHeight: panelMaxHeight
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
      setIsAdding(false);
      setEditingUnitId(null);
      setNewUnitName('');
      setEditingName('');
      setLocalError('');
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsAdding(false);
        setEditingUnitId(null);
        setNewUnitName('');
        setEditingName('');
        setLocalError('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selectedLabel = options.find((option) => option.name === value)?.name ?? value;
  const helperMessage = actionError ?? localError;
  const emptyMessage = useMemo(
    () => 'Chưa có đơn vị nào, bạn có thể thêm mới ngay tại đây.',
    []
  );

  const resetInlineStates = () => {
    setIsAdding(false);
    setEditingUnitId(null);
    setNewUnitName('');
    setEditingName('');
    setLocalError('');
    onClearActionError?.();
  };

  const handleCreate = async () => {
    const formattedValue = formatUnitName(newUnitName);
    if (!formattedValue) {
      setLocalError('Vui lòng nhập đơn vị mới');
      return;
    }

    setLocalError('');
    onClearActionError?.();

    try {
      await onCreate(formattedValue);
      setNewUnitName('');
      setIsAdding(false);
      setIsOpen(false);
    } catch {
      // Parent mutation exposes the API error.
    }
  };

  const handleUpdate = async (option: IngredientUnitOption) => {
    const formattedValue = formatUnitName(editingName);
    if (!formattedValue) {
      setLocalError('Vui lòng nhập tên đơn vị');
      return;
    }

    setLocalError('');
    onClearActionError?.();

    try {
      await onUpdate(option.id, formattedValue);
      if (value === option.name) {
        onChange(formattedValue);
      }
      setEditingUnitId(null);
      setEditingName('');
    } catch {
      // Parent mutation exposes the API error.
    }
  };

  const handleDelete = async (option: IngredientUnitOption) => {
    onClearActionError?.();
    setLocalError('');

    const confirmed = window.confirm(`Xóa đơn vị "${option.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await onDelete(option.id);
      if (value === option.name) {
        onChange('');
      }
    } catch {
      // Parent mutation exposes the API error.
    }
  };

  const dropdown = isMounted && isOpen && dropdownStyle
    ? createPortal(
        <div className="fixed inset-0 z-[1200]">
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-2xl"
          >
            <div className="max-h-full overflow-y-auto p-2">
              <div className="space-y-1" role="listbox">
                {options.length > 0 ? (
                  options.map((option) =>
                    editingUnitId === option.id ? (
                      <div key={option.id} className="rounded-xl bg-brand-50 p-3">
                        <input
                          value={editingName}
                          onChange={(event) => {
                            setEditingName(event.target.value);
                            setLocalError('');
                            onClearActionError?.();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleUpdate(option);
                            }
                          }}
                          autoFocus
                          placeholder="Nhập tên đơn vị"
                          className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900 outline-none placeholder:text-slate-400 focus:border-brand-500"
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            className="flex-1 px-3 py-2 text-xs"
                            disabled={updatingUnitId === option.id}
                            onClick={() => void handleUpdate(option)}
                          >
                            {updatingUnitId === option.id ? 'Đang lưu...' : 'Lưu'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-2 text-xs"
                            disabled={updatingUnitId === option.id}
                            onClick={resetInlineStates}
                          >
                            Hủy
                          </Button>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Đang dùng bởi {option.usageCount} nguyên liệu.
                        </p>
                      </div>
                    ) : (
                      <div
                        key={option.id}
                        className={clsx(
                          'flex items-center gap-2 rounded-xl px-2 py-1 transition',
                          option.name === value && 'bg-brand-50'
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 rounded-xl px-2 py-2 text-left text-sm text-brand-900 hover:bg-brand-50"
                          onClick={() => {
                            onChange(option.name);
                            setIsOpen(false);
                            resetInlineStates();
                          }}
                        >
                          <span className={clsx(option.name === value && 'font-semibold')}>
                            {option.name}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">
                            {option.usageCount} nguyên liệu
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 py-2"
                          onClick={() => {
                            setEditingUnitId(option.id);
                            setEditingName(option.name);
                            setIsAdding(false);
                            setLocalError('');
                            onClearActionError?.();
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className={clsx(
                            'px-2 py-2',
                            option.usageCount > 0 && 'cursor-not-allowed text-slate-300 hover:bg-transparent'
                          )}
                          disabled={option.usageCount > 0 || deletingUnitId === option.id}
                          title={
                            option.usageCount > 0
                              ? 'Đơn vị đang được dùng nên chưa thể xóa'
                              : 'Xóa đơn vị'
                          }
                          onClick={() => void handleDelete(option)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  )
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-500">{emptyMessage}</p>
                )}
              </div>

              <div className="mt-2 border-t border-brand-50 pt-2">
                {!isAdding ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                    onClick={() => {
                      setIsAdding(true);
                      setEditingUnitId(null);
                      setEditingName('');
                      setLocalError('');
                      onClearActionError?.();
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
                        onClearActionError?.();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleCreate();
                        }
                      }}
                      autoFocus
                      placeholder="Nhập đơn vị mới"
                      className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900 outline-none placeholder:text-slate-400 focus:border-brand-500"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="flex-1 px-3 py-2 text-xs"
                        onClick={() => void handleCreate()}
                        disabled={isCreating}
                      >
                        {isCreating ? 'Đang lưu...' : 'Lưu đơn vị'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={resetInlineStates}
                        disabled={isCreating}
                      >
                        Hủy
                      </Button>
                    </div>
                  </div>
                )}

                <p className={clsx('px-2 pt-2 text-xs', helperMessage ? 'text-danger' : 'text-slate-500')}>
                  {helperMessage ?? 'Đơn vị mới sẽ được lưu lại và hiển thị ở danh sách này.'}
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-brand-900">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={clsx(
          'flex w-full items-center justify-between rounded-xl border border-brand-100 bg-white px-4 py-3 text-left text-sm text-brand-900 shadow-sm outline-none transition focus:border-brand-500',
          (error || actionError || localError) && 'border-danger',
          disabled && 'cursor-not-allowed bg-slate-50 text-slate-400'
        )}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
            onClearActionError?.();
            setLocalError('');
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
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {dropdown}
    </div>
  );
}
