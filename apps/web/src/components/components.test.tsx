import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { PriorityBadge, ProgressBar, StatusBadge } from './Badges';
import { EMPTY_TASK_FILTERS, TaskFilters } from './TaskFilters';
import { ErrorState } from './ui/States';

describe('ErrorState', () => {
  it('explains a server connection failure and offers a retry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError(0, 'NETWORK_ERROR', 'x')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to connect to the server');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says "No internet connection" when the browser is offline', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<ErrorState error={new ApiError(0, 'NETWORK_ERROR', 'x')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No internet connection');
    spy.mockRestore();
  });

  it('shows the API message for other errors', () => {
    render(<ErrorState error={new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });
});

describe('badges', () => {
  it('always pair colour with a text label', () => {
    render(
      <>
        <StatusBadge status="IN_PROGRESS" />
        <PriorityBadge priority="HIGH" />
      </>,
    );
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('exposes progress to assistive technology', () => {
    render(<ProgressBar done={2} total={8} />);
    const bar = screen.getByRole('progressbar', { name: '2 of 8 tasks completed' });
    expect(bar).toHaveAttribute('aria-valuenow', '25');
  });
});

describe('TaskFilters', () => {
  it('reports filter changes and can clear them', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<TaskFilters value={EMPTY_TASK_FILTERS} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by priority' }), 'HIGH');
    expect(onChange).toHaveBeenLastCalledWith({ search: '', status: '', priority: 'HIGH' });

    rerender(<TaskFilters value={{ search: 'login', status: 'PENDING', priority: 'HIGH' }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenLastCalledWith(EMPTY_TASK_FILTERS);
  });
});
