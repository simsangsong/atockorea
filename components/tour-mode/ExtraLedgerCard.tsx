'use client';

/**
 * W2.4 — the LEDGER capsule card (P-D2). Renders an extra_ledger feed
 * capsule: item + amount + cash-settlement note + status chip. On the newest
 * capsule of a still-`logged` extra, customers get the one-tap [confirm]
 * button (G2 guest ack). Settlement itself is cash-to-guide — this card is
 * the shared record, not a payment surface.
 */

import { useState } from 'react';
import { formatKrw } from '@/lib/tour-room/ledger';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  {
    title: string;
    cashNote: string;
    confirm: string;
    confirming: string;
    receipt: string;
    status: Record<string, string>;
    kind: Record<string, string>;
  }
> = {
  en: {
    title: 'Trip expense',
    cashNote: 'Cash settlement with your guide today',
    confirm: 'Confirm',
    confirming: 'Confirming…',
    receipt: 'View receipt',
    status: { logged: 'Awaiting your confirm', confirmed: 'Confirmed', settled: 'Settled in cash', voided: 'Cancelled' },
    kind: { advance: 'Paid on your behalf', ticket: 'Admission ticket', overtime: 'Overtime', extension: 'Extension', parking: 'Parking', pickup: 'Pickup fee', other: 'Expense' },
  },
  ko: {
    title: '여행 지출',
    cashNote: '당일 가이드에게 현금 정산',
    confirm: '확인',
    confirming: '확인 중…',
    receipt: '영수증 보기',
    status: { logged: '확인 대기', confirmed: '확인됨', settled: '현금 수취 완료', voided: '취소됨' },
    kind: { advance: '대납', ticket: '입장권', overtime: '초과근무', extension: '연장', parking: '주차', pickup: '픽업비', other: '지출' },
  },
  ja: {
    title: '旅行中の支出',
    cashNote: '当日ガイドへ現金精算',
    confirm: '確認',
    confirming: '確認中…',
    receipt: 'レシートを見る',
    status: { logged: 'ご確認待ち', confirmed: '確認済み', settled: '現金受領済み', voided: '取消' },
    kind: { advance: '立替', ticket: '入場券', overtime: '延長勤務', extension: '延長', parking: '駐車', pickup: '送迎料', other: '支出' },
  },
  es: {
    title: 'Gasto del viaje',
    cashNote: 'Se liquida hoy en efectivo con tu guía',
    confirm: 'Confirmar',
    confirming: 'Confirmando…',
    receipt: 'Ver recibo',
    status: { logged: 'Pendiente de confirmar', confirmed: 'Confirmado', settled: 'Liquidado en efectivo', voided: 'Cancelado' },
    kind: { advance: 'Pagado por ti', ticket: 'Entrada', overtime: 'Horas extra', extension: 'Extensión', parking: 'Parking', pickup: 'Recogida', other: 'Gasto' },
  },
  zh: {
    title: '行程支出',
    cashNote: '当日与导游现金结算',
    confirm: '确认',
    confirming: '确认中…',
    receipt: '查看收据',
    status: { logged: '待您确认', confirmed: '已确认', settled: '已现金结清', voided: '已取消' },
    kind: { advance: '代付', ticket: '门票', overtime: '超时', extension: '延长', parking: '停车', pickup: '接送费', other: '支出' },
  },
  fr: {
    title: 'Dépense du voyage',
    cashNote: 'Règlement en espèces avec votre guide aujourd’hui',
    confirm: 'Confirmer',
    confirming: 'Confirmation…',
    receipt: 'Voir le reçu',
    status: { logged: 'En attente de confirmation', confirmed: 'Confirmé', settled: 'Réglé en espèces', voided: 'Annulé' },
    kind: { advance: 'Avancé pour vous', ticket: 'Billet d’entrée', overtime: 'Heures sup.', extension: 'Prolongation', parking: 'Parking', pickup: 'Frais de prise en charge', other: 'Dépense' },
  },
  de: {
    title: 'Reiseausgabe',
    cashNote: 'Barzahlung heute an Ihren Guide',
    confirm: 'Bestätigen',
    confirming: 'Wird bestätigt…',
    receipt: 'Beleg ansehen',
    status: { logged: 'Wartet auf Ihre Bestätigung', confirmed: 'Bestätigt', settled: 'Bar beglichen', voided: 'Storniert' },
    kind: { advance: 'Für Sie ausgelegt', ticket: 'Eintrittskarte', overtime: 'Überstunden', extension: 'Verlängerung', parking: 'Parken', pickup: 'Abholgebühr', other: 'Ausgabe' },
  },
  ru: {
    title: 'Расход в поездке',
    cashNote: 'Наличный расчет с гидом в день тура',
    confirm: 'Подтвердить',
    confirming: 'Подтверждение…',
    receipt: 'Посмотреть чек',
    status: { logged: 'Ожидает вашего подтверждения', confirmed: 'Подтверждено', settled: 'Оплачено наличными', voided: 'Отменено' },
    kind: { advance: 'Оплачено за вас', ticket: 'Входной билет', overtime: 'Сверхурочные', extension: 'Продление', parking: 'Парковка', pickup: 'Плата за трансфер', other: 'Расход' },
  },
  it: {
    title: 'Spesa del viaggio',
    cashNote: 'Da saldare oggi in contanti con la tua guida',
    confirm: 'Conferma',
    confirming: 'Conferma in corso…',
    receipt: 'Vedi ricevuta',
    status: { logged: 'In attesa di conferma', confirmed: 'Confermato', settled: 'Saldato in contanti', voided: 'Annullato' },
    kind: { advance: 'Anticipato per te', ticket: 'Biglietto d’ingresso', overtime: 'Straordinario', extension: 'Prolungamento', parking: 'Parcheggio', pickup: 'Costo pick-up', other: 'Spesa' },
  },
};

export interface ExtraLedgerMeta {
  extra_id?: string;
  item?: string;
  /** T2-2 — per-locale translated item (the operator typed it in Korean). */
  item_i18n?: Record<string, string>;
  amount_krw?: number;
  extra_kind?: string;
  status?: string;
  receipt_photo_url?: string;
}

export default function ExtraLedgerCard({
  meta,
  locale,
  canConfirm,
  onConfirm,
}: {
  meta: ExtraLedgerMeta;
  locale: RoomLocale;
  /** True only on the newest capsule of a logged extra, for customers. */
  canConfirm: boolean;
  onConfirm?: (extraId: string) => Promise<boolean>;
}) {
  const copy = COPY[locale];
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const status = state === 'done' ? 'confirmed' : (meta.status ?? 'logged');
  const settled = status === 'settled';
  const voided = status === 'voided';

  return (
    <div
      data-testid="extra-ledger-card"
      className={`tr-card mx-auto my-2 w-full max-w-[340px] px-4 py-3 ${voided ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="tr-meta font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">
          {copy.title} · {copy.kind[meta.extra_kind ?? 'other'] ?? copy.kind.other}
        </p>
        <span
          className={`tr-meta text-cjk-safe rounded-full px-2 py-0.5 font-bold ${
            settled
              ? 'bg-[var(--tr-safe)] text-white'
              : status === 'confirmed'
                ? 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]'
                : voided
                  ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]'
                  : 'bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]'
          }`}
        >
          {copy.status[status] ?? status}
        </span>
      </div>
      <p className={`tr-body mt-1.5 font-semibold text-[var(--tr-ink)] ${voided ? 'line-through' : ''}`}>
        {meta.item_i18n?.[locale] ?? meta.item ?? ''}
        <span className="tr-num ml-2 font-bold text-[var(--tr-accent-deep)]">{formatKrw(meta.amount_krw ?? 0)}</span>
      </p>
      {!voided && <p className="tr-meta mt-0.5 text-[var(--tr-ink-3)]">{copy.cashNote}</p>}
      {meta.receipt_photo_url && (
        <a
          href={meta.receipt_photo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="tr-meta mt-1.5 inline-flex items-center gap-1 font-semibold text-[var(--tr-accent-deep)] underline"
          data-testid="extra-receipt-link"
        >
          🧾 {copy.receipt}
        </a>
      )}
      {canConfirm && meta.extra_id && onConfirm && state !== 'done' && (
        <button
          type="button"
          disabled={state === 'busy'}
          onClick={() => {
            setState('busy');
            void onConfirm(meta.extra_id as string).then((ok) => setState(ok ? 'done' : 'idle'));
          }}
          className="tr-card-text mt-2.5 w-full rounded-xl bg-[var(--tr-accent)] py-2 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-50"
          data-testid="extra-confirm"
        >
          {state === 'busy' ? copy.confirming : copy.confirm}
        </button>
      )}
    </div>
  );
}
