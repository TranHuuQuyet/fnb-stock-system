import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  listStores: vi.fn(),
  listUsers: vi.fn(),
  lockUser: vi.fn(),
  resetPassword: vi.fn(),
  unlockUser: vi.fn(),
  updateUser: vi.fn()
}));

vi.mock('@/components/layout/protected-page', () => ({
  ProtectedPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ui/table', () => ({
  SimpleTable: ({ rows }: { rows: React.ReactNode[][] }) => (
    <div>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex}>
          {row.map((cell, cellIndex) => (
            <div key={cellIndex}>{cell}</div>
          ))}
        </div>
      ))}
    </div>
  )
}));

vi.mock('@/hooks/use-resolved-session', () => ({
  useResolvedSession: () => ({
    session: {
      user: {
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
        permissions: []
      }
    }
  })
}));

vi.mock('@/services/admin/stores', () => ({
  listStores: mocks.listStores
}));

vi.mock('@/services/admin/users', () => ({
  createUser: mocks.createUser,
  listUsers: mocks.listUsers,
  lockUser: mocks.lockUser,
  resetPassword: mocks.resetPassword,
  unlockUser: mocks.unlockUser,
  updateUser: mocks.updateUser
}));

import AdminUsersPage from './page';

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      },
      mutations: {
        retry: false
      }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AdminUsersPage />
    </QueryClientProvider>
  );
};

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mocks.createUser.mockReset();
    mocks.listStores.mockReset();
    mocks.listUsers.mockReset();
    mocks.lockUser.mockReset();
    mocks.resetPassword.mockReset();
    mocks.unlockUser.mockReset();
    mocks.updateUser.mockReset();

    mocks.listStores.mockResolvedValue({
      data: [{ id: 'store-1', name: 'Chi nhanh 1' }]
    });
    mocks.listUsers.mockResolvedValue({
      data: [
        {
          id: 'admin-1',
          username: 'admin',
          fullName: 'Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
          permissions: [],
          store: null
        },
        {
          id: 'staff-1',
          username: 'staff1',
          fullName: 'Staff 1',
          role: 'STAFF',
          status: 'ACTIVE',
          permissions: [],
          store: { name: 'Chi nhanh 1' }
        }
      ]
    });
    mocks.lockUser.mockResolvedValue({ id: 'staff-1', status: 'LOCKED' });
  });

  afterEach(() => {
    cleanup();
  });

  it('disables only the current admin self-lock action', async () => {
    renderPage();

    const lockButtons = await screen.findAllByRole('button', { name: 'Khóa' });

    expect(lockButtons).toHaveLength(2);
    expect(lockButtons[0]).toBeDisabled();
    expect(lockButtons[0]).toHaveAttribute(
      'title',
      'Không thể tự khóa tài khoản đang đăng nhập'
    );
    expect(lockButtons[1]).toBeEnabled();

    fireEvent.click(lockButtons[0]);
    expect(mocks.lockUser).not.toHaveBeenCalled();

    fireEvent.click(lockButtons[1]);
    await waitFor(() => {
      expect(mocks.lockUser).toHaveBeenCalledWith('staff-1');
    });
  });
});
