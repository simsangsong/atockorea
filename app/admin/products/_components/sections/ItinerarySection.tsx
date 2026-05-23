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
  MapPin,
  Clock,
  ListChecks,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type ItineraryStop = {
  id: string; // stable client-side id
  number: number;
  time: string;
  duration: string;
  name: string;
  category: string;
  description: string;
  image?: string;
};

type Props = {
  stops: ItineraryStop[];
  onChange: (next: ItineraryStop[]) => void;
};

/**
 * Itinerary editor — sortable list of stops (time, duration, name, category,
 * description). Renumbering happens automatically on reorder/delete/add so the
 * `#1, #2, ...` labels stay correct without manual editing.
 */
export function ItinerarySection({ stops, onChange }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => stops.map((s) => s.id), [stops]);

  const renumber = (list: ItineraryStop[]): ItineraryStop[] =>
    list.map((s, i) => ({ ...s, number: i + 1 }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = stops.findIndex((s) => s.id === active.id);
    const newIndex = stops.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(renumber(arrayMove(stops, oldIndex, newIndex)));
  };

  const updateStop = (id: string, patch: Partial<ItineraryStop>) => {
    onChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addStop = () => {
    const id = `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onChange(
      renumber([
        ...stops,
        {
          id,
          number: stops.length + 1,
          time: '',
          duration: '',
          name: '',
          category: '',
          description: '',
        },
      ]),
    );
    setExpanded((e) => ({ ...e, [id]: true }));
  };

  const removeStop = (id: string) => {
    onChange(renumber(stops.filter((s) => s.id !== id)));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ListChecks className="size-4 text-blue-600" />
            일정 (Itinerary)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            드래그로 순서 변경 · 카드를 펼쳐서 시간/장소/설명 편집
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500">{stops.length}개 스톱</span>
      </div>

      <div className="p-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {stops.map((stop) => (
                <SortableStopCard
                  key={stop.id}
                  stop={stop}
                  expanded={!!expanded[stop.id]}
                  onToggle={() =>
                    setExpanded((e) => ({ ...e, [stop.id]: !e[stop.id] }))
                  }
                  onChange={(patch) => updateStop(stop.id, patch)}
                  onRemove={() => removeStop(stop.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={addStop}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-dashed border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus className="size-4" />
          스톱 추가
        </button>

        {stops.length === 0 && (
          <p className="mt-2 text-xs text-slate-400 text-center">
            일정이 비어 있습니다. 위 버튼으로 첫 스톱을 추가하세요.
          </p>
        )}
      </div>
    </div>
  );
}

function SortableStopCard({
  stop,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  stop: ItineraryStop;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ItineraryStop>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });
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
      {/* Header (always visible) */}
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
          <span className="w-6 h-6 flex-shrink-0 inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
            {stop.number}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {stop.name || <span className="text-slate-400 italic">제목 없음</span>}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
              {stop.time && (
                <span className="inline-flex items-center gap-0.5">
                  <Clock className="size-2.5" /> {stop.time}
                </span>
              )}
              {stop.duration && <span>· {stop.duration}</span>}
              {stop.category && (
                <span className="inline-flex items-center gap-0.5 truncate">
                  · <MapPin className="size-2.5" /> {stop.category}
                </span>
              )}
            </div>
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

      {/* Body (expanded only) */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Field label="시작 시간">
              <input
                type="text"
                value={stop.time}
                onChange={(e) => onChange({ time: e.target.value })}
                placeholder="10:30"
                className="w-full h-8 px-2 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
              />
            </Field>
            <Field label="머무는 시간">
              <input
                type="text"
                value={stop.duration}
                onChange={(e) => onChange({ duration: e.target.value })}
                placeholder="90분"
                className="w-full h-8 px-2 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
              />
            </Field>
          </div>
          <Field label="장소명">
            <input
              type="text"
              value={stop.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="산정호수"
              className="w-full h-8 px-2 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </Field>
          <Field label="한 줄 카테고리 (장소 아래 라벨)">
            <input
              type="text"
              value={stop.category}
              onChange={(e) => onChange({ category: e.target.value })}
              placeholder="산으로 둘러싸인 호숫가 산책"
              className="w-full h-8 px-2 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </Field>
          <Field label="상세 설명">
            <textarea
              rows={4}
              value={stop.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="이 스톱의 매력, 동선, 팁 등 설명..."
              className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none resize-y"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-600 mb-0.5">{label}</span>
      {children}
    </label>
  );
}
