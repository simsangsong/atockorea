/**
 * ⌘K command palette — opens on the window event, filters nav items, and routes
 * on select.
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
});
