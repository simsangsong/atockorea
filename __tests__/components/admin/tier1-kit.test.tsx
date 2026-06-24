import { render, screen } from '@testing-library/react';
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard';
import { FilterBar, FilterChip } from '@/components/admin/FilterBar';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { BookingStatusBadge } from '@/components/admin/BookingStatusBadge';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';

describe('Tier1 component kit (W1.7)', () => {
  it('StatCard shows label, value, sublabel; skeleton renders', () => {
    render(<StatCard label="매출" value="₩1,200,000" sublabel="지난 7일" />);
    expect(screen.getByText('매출')).toBeInTheDocument();
    expect(screen.getByText('₩1,200,000')).toBeInTheDocument();
    expect(screen.getByText('지난 7일')).toBeInTheDocument();
    const { container } = render(<StatCardSkeleton />);
    expect(container.querySelector('.admin-shimmer')).toBeTruthy();
  });

  it('FilterChip reflects active state via aria-pressed and shows count', () => {
    render(
      <FilterBar>
        <FilterChip active count={12}>
          전체
        </FilterChip>
        <FilterChip>대기</FilterChip>
      </FilterBar>,
    );
    expect(screen.getByRole('button', { name: /전체/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '대기' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('AdminPageHeader renders title + actions', () => {
    render(<AdminPageHeader title="주문" actions={<button type="button">내보내기</button>} />);
    expect(screen.getByRole('heading', { name: '주문' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '내보내기' })).toBeInTheDocument();
  });

  it('BookingStatusBadge renders icon + label and falls back for unknown status', () => {
    render(<BookingStatusBadge status="confirmed" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    render(<BookingStatusBadge status="weird_status" />);
    expect(screen.getByText('weird_status')).toBeInTheDocument();
  });

  it('DataTable renders both desktop rows and mobile cards, and empty state', () => {
    type Row = { id: string; name: string; total: number };
    const columns: DataTableColumn<Row>[] = [
      { key: 'name', header: '이름', cell: (r) => r.name },
      { key: 'total', header: '합계', align: 'right', cell: (r) => r.total.toLocaleString() },
    ];
    const rows: Row[] = [
      { id: 'a', name: '김철수', total: 1000 },
      { id: 'b', name: '이영희', total: 2500 },
    ];
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    // name appears in both the table and the mobile card → 2 occurrences
    expect(screen.getAllByText('김철수').length).toBe(2);

    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.id}
        empty={<div>데이터 없음</div>}
      />,
    );
    expect(screen.getByText('데이터 없음')).toBeInTheDocument();
  });
});
