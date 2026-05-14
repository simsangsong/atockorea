'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Plus,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

type Props = {
  items: FAQItem[];
  onChange: (next: FAQItem[]) => void;
};

/**
 * FAQ editor — accordion-style sortable list of Q&A pairs. Each card is
 * collapsed by default (question only); click to expand and edit answer.
 */
export function FAQSection({ items, onChange }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => items.map((i) => i.id), [items]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  const updateItem = (id: string, patch: Partial<FAQItem>) => {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const addItem = () => {
    const id = `faq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onChange([...items, { id, question: '', answer: '' }]);
    setExpanded((e) => ({ ...e, [id]: true }));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <HelpCircle className="size-4 text-blue-600" />
            FAQ
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            자주 묻는 질문 · 드래그로 순서 변경 · 클릭으로 답변 펼치기
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500">{items.length}개 질문</span>
      </div>

      <div className="p-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <SortableFAQCard
                  key={item.id}
                  index={idx}
                  item={item}
                  expanded={!!expanded[item.id]}
                  onToggle={() =>
                    setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))
                  }
                  onChange={(patch) => updateItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={addItem}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-dashed border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus className="size-4" />
          질문 추가
        </button>

        {items.length === 0 && (
          <p className="mt-2 text-xs text-slate-400 text-center">
            FAQ가 비어 있습니다. 첫 질문을 추가하세요.
          </p>
        )}
      </div>
    </div>
  );
}

function SortableFAQCard({
  index,
  item,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  index: number;
  item: FAQItem;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<FAQItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg overflow-hidden ${
        isDragging ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex-shrink-0 w-7 flex items-center justify-center bg-slate-50 hover:bg-slate-100 cursor-grab active:cursor-grabbing border-r border-slate-200 text-slate-400"
          aria-label="드래그하여 순서 변경"
        >
          <GripVertical className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 px-3 py-2.5 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors"
        >
          <span className="w-5 h-5 flex-shrink-0 inline-flex items-center justify-center rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
            Q{index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">
              {item.question || <span className="text-slate-400 italic">질문 없음</span>}
            </div>
            {!expanded && item.answer && (
              <div className="text-[11px] text-slate-500 truncate mt-0.5">{item.answer}</div>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="size-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="size-4 text-slate-400 flex-shrink-0" />
          )}
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="px-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="삭제"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2.5">
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-600 mb-0.5">질문</span>
            <input
              type="text"
              value={item.question}
              onChange={(e) => onChange({ question: e.target.value })}
              placeholder="예: 차량은 어떤 차종인가요?"
              className="w-full h-8 px-2 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-600 mb-0.5">답변</span>
            <textarea
              rows={5}
              value={item.answer}
              onChange={(e) => onChange({ answer: e.target.value })}
              placeholder="답변 내용을 입력하세요..."
              className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none resize-y"
            />
          </label>
        </div>
      )}
    </div>
  );
}
