/**
 * ⌘K command palette — opens on the window event, filters nav items, and routes
 * on select. W4.4: also debounce-searches orders/merchants when `onSearch` is
 * wired, rendering hits under group headers.
 */
import { fireEvent, render, screen, act } from '@testing-library/react';
import { AdminCommandPalette } from '@/components/admin/AdminCommandPalette';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ITEMS = [
  { path: '/admin', label: '대시보드' },
  { path: '/admin/orders', label: '주문 관리' },
  { path: '/admin/merchants', label: '업체 관리' },
];

beforeEach(() => push.mockClear());

describe('AdminCommandPalette', () => {
  it('is closed until the open event, then lists all nav items', () => {
    render(<AdminCommandPalette items={ITEMS} />);
    expect(screen.queryByTestId('admin-cmdk')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('admin-cmdk-open'));
    });
    expect(screen.getByTestId('admin-cmdk')).toBeInTheDocument();
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('주문 관리')).toBeInTheDocument();
  });

  it('filters by query and routes on click', () => {
    render(<AdminCommandPalette items={ITEMS} />);
    act(() => {
      window.dispatchEvent(new Event('admin-cmdk-open'));
    });
    fireEvent.change(screen.getByLabelText('명령 검색'), { target: { value: '주문' } });
    expect(screen.queryByText('대시보드')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('주문 관리'));
    expect(push).toHaveBeenCalledWith('/admin/orders');
  });

  it('is nav-only (never calls a searcher) when onSearch is omitted', () => {
    render(<AdminCommandPalette items={ITEMS} />);
    act(() => {
      window.dispatchEvent(new Event('admin-cmdk-open'));
    });
    // No data groups render without a searcher.
    fireEvent.change(screen.getByLabelText('명령 검색'), { target: { value: 'jeju' } });
    expect(screen.queryByText('주문')).not.toBeInTheDocument();
    expect(screen.queryByText('업체')).not.toBeInTheDocument();
    expect(screen.getByText('결과 없음')).toBeInTheDocument();
  });

  it('debounce-searches data and routes to a hit', async () => {
    const onSearch = jest.fn(async () => [
      { group: 'order' as const, path: '/admin/orders/abc', label: 'ATOC-1024', sublabel: 'Jane · 2026-08-01' },
      { group: 'merchant' as const, path: '/admin/merchants/xyz', label: 'Jeju Tours', sublabel: 'Kim · approved' },
    ]);
    render(<AdminCommandPalette items={ITEMS} onSearch={onSearch} />);
    act(() => {
      window.dispatchEvent(new Event('admin-cmdk-open'));
    });
    fireEvent.change(screen.getByLabelText('명령 검색'), { target: { value: 'jeju' } });

    // Group headers + hits appear after the debounce resolves.
    expect(await screen.findByText('Jeju Tours')).toBeInTheDocument();
    expect(onSearch).toHaveBeenCalledWith('jeju');
    expect(screen.getByText('주문')).toBeInTheDocument();
    expect(screen.getByText('업체')).toBeInTheDocument();

    fireEvent.click(screen.getByText('ATOC-1024'));
    expect(push).toHaveBeenCalledWith('/admin/orders/abc');
  });

  it('does not search for queries below the minimum length', async () => {
    const onSearch = jest.fn(async () => []);
    render(<AdminCommandPalette items={ITEMS} onSearch={onSearch} />);
    act(() => {
      window.dispatchEvent(new Event('admin-cmdk-open'));
    });
    fireEvent.change(screen.getByLabelText('명령 검색'), { target: { value: 'j' } });
    // Give any (unexpected) debounce a chance to fire.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(onSearch).not.toHaveBeenCalled();
  });
});
