import { render, screen, fireEvent } from '@testing-library/react';
import { DataCard } from '@/components/admin/DataCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { ActivityRow } from '@/components/admin/ActivityRow';
import { ConfirmSheet } from '@/components/admin/ConfirmSheet';

describe('Tier2 component kit (W1.8)', () => {
  it('DataCard renders title, secondary, meta, metric and action; click fires', () => {
    const onClick = jest.fn();
    render(
      <DataCard
        title="제주 동부 투어"
        status={<span>confirmed</span>}
        secondary="김철수 · 2명"
        meta="2026-07-01 · 제주공항"
        metric="₩240,000"
        action={<button type="button">보기</button>}
        onClick={onClick}
      />,
    );
    expect(screen.getByRole('heading', { name: '제주 동부 투어' })).toBeInTheDocument();
    expect(screen.getByText('김철수 · 2명')).toBeInTheDocument();
    expect(screen.getByText('₩240,000')).toBeInTheDocument();
    fireEvent.click(screen.getByText('제주 동부 투어'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('EmptyState shows title, description and action', () => {
    render(
      <EmptyState
        title="결과 없음"
        description="필터를 조정해 보세요"
        action={<button type="button">초기화</button>}
      />,
    );
    expect(screen.getByText('결과 없음')).toBeInTheDocument();
    expect(screen.getByText('필터를 조정해 보세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '초기화' })).toBeInTheDocument();
  });

  it('ActivityRow shows title, description and timestamp', () => {
    render(<ActivityRow title="새 예약" description="제주 동부" timestamp="3분 전" />);
    expect(screen.getByText('새 예약')).toBeInTheDocument();
    expect(screen.getByText('3분 전')).toBeInTheDocument();
  });

  it('ConfirmSheet renders amount + confirm; confirm fires onConfirm', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmSheet
        open
        onOpenChange={() => {}}
        title="노쇼 위약금 청구"
        amount="₩60,000"
        onConfirm={onConfirm}
        confirmLabel="청구"
      />,
    );
    expect(screen.getByText('₩60,000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '청구' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
