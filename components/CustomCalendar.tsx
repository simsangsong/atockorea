'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface CustomCalendarProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  placeholder?: string;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CustomCalendar({ value, onChange, min, placeholder = 'Year-Month-Day' }: CustomCalendarProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const initDate = value ? new Date(value + 'T12:00:00') : today;
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T12:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const minDate = min ? new Date(min + 'T00:00:00') : null;

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { date: Date; current: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(viewYear, viewMonth - 1, daysInPrev - i), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(viewYear, viewMonth, d), current: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(viewYear, viewMonth + 1, cells.length - daysInMonth - firstDay + 1), current: false });
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDate = (date: Date) => {
    if (minDate && date < minDate) return;
    onChange(toYMD(date));
    setOpen(false);
  };

  const isSelected = (date: Date) => value === toYMD(date);
  const isToday = (date: Date) => toYMD(date) === toYMD(today);
  const isDisabled = (date: Date) => !!(minDate && date < minDate);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* trigger */}
      <div
        className="cyber-input-container flex items-center justify-between gap-2 cursor-pointer w-full"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm pointer-events-none select-none" style={{ color: value ? '#fff' : 'rgb(107 114 128)' }}>
          {value || placeholder}
        </span>
        <Calendar size={14} className="text-[#00f0ff] shrink-0 pointer-events-none" aria-hidden />
      </div>

      {/* popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute left-0 z-[9999] mt-2 w-72 rounded-xl overflow-hidden"
            style={{
              background: 'rgba(5, 11, 28, 0.97)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,240,255,0.08)',
              backdropFilter: 'blur(16px)',
              bottom: '110%',
            }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,240,255,0.12)]">
              <button onClick={prevMonth} className="p-1 rounded hover:bg-[rgba(0,240,255,0.1)] text-[#00f0ff] transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold text-[#00f0ff]" style={{ textShadow: '0 0 8px rgba(0,240,255,0.5)' }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className="p-1 rounded hover:bg-[rgba(0,240,255,0.1)] text-[#00f0ff] transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* day names */}
            <div className="grid grid-cols-7 px-2 pt-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-[rgba(0,240,255,0.5)] pb-1">{d}</div>
              ))}
            </div>

            {/* dates */}
            <div className="grid grid-cols-7 px-2 pb-3 gap-y-0.5">
              {cells.map(({ date, current }, i) => {
                const sel = isSelected(date);
                const tod = isToday(date);
                const dis = isDisabled(date);
                return (
                  <button
                    key={i}
                    onClick={() => !dis && selectDate(date)}
                    disabled={dis}
                    className="relative flex items-center justify-center h-8 w-full rounded-lg text-xs font-medium transition-all duration-150"
                    style={{
                      color: dis ? 'rgba(255,255,255,0.18)' : sel ? '#050B18' : current ? '#e5e7eb' : 'rgba(255,255,255,0.25)',
                      background: sel ? '#00f0ff' : tod && !sel ? 'rgba(0,240,255,0.12)' : 'transparent',
                      boxShadow: sel ? '0 0 12px rgba(0,240,255,0.6)' : undefined,
                      cursor: dis ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={e => { if (!dis && !sel) (e.currentTarget as HTMLElement).style.background = 'rgba(0,240,255,0.15)'; }}
                    onMouseLeave={e => { if (!dis && !sel) (e.currentTarget as HTMLElement).style.background = tod ? 'rgba(0,240,255,0.12)' : 'transparent'; }}
                  >
                    {tod && !sel && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#00f0ff]" />
                    )}
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* footer */}
            <div className="flex justify-between px-4 pb-3 text-[11px]">
              <button onClick={() => { onChange(''); setOpen(false); }} className="text-[rgba(0,240,255,0.6)] hover:text-[#00f0ff] transition-colors">Clear</button>
              <button onClick={() => { onChange(toYMD(today)); setOpen(false); }} className="text-[rgba(0,240,255,0.6)] hover:text-[#00f0ff] transition-colors">Today</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
