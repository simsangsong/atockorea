import { render, screen } from '@testing-library/react';
import { AdminPageShell } from '@/components/admin/AdminPageShell';

describe('AdminPageShell (W1.3)', () => {
  it('renders the title and children', () => {
    render(
      <AdminPageShell title="주문">
        <div>본문</div>
      </AdminPageShell>,
    );
    expect(screen.getByRole('heading', { name: '주문' })).toBeInTheDocument();
    expect(screen.getByText('본문')).toBeInTheDocument();
  });

  it('omits the back link on list roots and renders it on detail pages', () => {
    const { rerender } = render(
      <AdminPageShell title="목록">
        <div />
      </AdminPageShell>,
    );
    expect(screen.queryByLabelText('뒤로')).not.toBeInTheDocument();

    rerender(
      <AdminPageShell title="상세" backHref="/admin/orders">
        <div />
      </AdminPageShell>,
    );
    const back = screen.getByLabelText('뒤로');
    expect(back).toBeInTheDocument();
    expect(back).toHaveAttribute('href', '/admin/orders');
  });

  it('renders actions, filter bar and a sticky footer when provided', () => {
    render(
      <AdminPageShell
        title="주문"
        description="전체 124건"
        actions={<button type="button">내보내기</button>}
        filterBar={<button type="button">전체</button>}
        footer={<button type="button">저장</button>}
      >
        <div>본문</div>
      </AdminPageShell>,
    );
    expect(screen.getByText('전체 124건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '내보내기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });
});
