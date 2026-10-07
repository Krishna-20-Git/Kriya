import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { RequireAdmin } from './guards';

const authState = vi.hoisted(() => ({ user: null as null | { role: 'USER' | 'ADMIN' } }));
vi.mock('./AuthProvider', () => ({ useAuth: () => authState }));

const renderGuarded = () =>
  render(
    <MemoryRouter>
      <RequireAdmin>
        <p>Admin content</p>
      </RequireAdmin>
    </MemoryRouter>,
  );

describe('RequireAdmin', () => {
  it('shows the page to admins', () => {
    authState.user = { role: 'ADMIN' };
    renderGuarded();
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('shows "not found" to regular users, without revealing the admin page exists', () => {
    authState.user = { role: 'USER' };
    renderGuarded();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /not found|doesn.t exist|404/i })).toBeInTheDocument();
  });
});
