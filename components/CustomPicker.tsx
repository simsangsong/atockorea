'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown } from 'lucide-react';

const POPUP_VARIANTS = {
  initial: { opacity: 0, y: 8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit:    { opacity: 0, y: 6, scale: 0.97 },
};
const POPUP_TRANSITION = { duration: 0.2, ease: 'easeOut' };

const POPUP_STYLE: React.CSSProperties = {
  background: 'rgba(5, 11, 28, 0.97)',
  border: '1px solid rgba(0, 240, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,240,255,0.08)',
  backdropFilter: 'blur(16px)',
};

function useOutsideClose(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, ref, onClose]);
}

/* ─────────────────────────────────────────────
   Time Picker
───────────────────────────────────────────── */
interface TimePickerProps {
  value: string;           // "HH:MM"
  onChange: (v: string) => void;
  placeholder?: string;
  formatDisplay?: (v: string) => string;
}

export function CustomTimePicker({ value, onChange, placeholder = '09:00 AM', formatDisplay }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);

  const [h, m] = value ? value.split(':').map(Number) : [9, 0];
  const isPM = h >= 12;
  const hour12 = h % 12 === 0 ? 12 : h % 12;

  const setHour12 = (v: number) => {
    const h24 = isPM ? (v === 12 ? 12 : v + 12) : (v === 12 ? 0 : v);
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };
  const setMin = (v: number) => onChange(`${String(h).padStart(2, '0')}:${String(v).padStart(2, '0')}`);
  const toggleAMPM = (pm: boolean) => {
    const newH = pm ? (h < 12 ? h + 12 : h) : (h >= 12 ? h - 12 : h);
    onChange(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const mins  = Array.from({ length: 60 }, (_, i) => i);

  const displayText = value && formatDisplay ? formatDisplay(value) : value || placeholder;

  return (
    <div ref={ref} className="relative w-full">
      <div className="cyber-input-container flex items-center justify-between gap-2 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <span className="text-sm text-white select-none">{displayText}</span>
        <Clock size={14} className="text-[#00f0ff] shrink-0" aria-hidden />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={POPUP_VARIANTS} initial="initial" animate="animate" exit="exit"
            transition={POPUP_TRANSITION}
            className="absolute right-0 z-[9999] mt-2 rounded-xl overflow-hidden"
            style={{ ...POPUP_STYLE, bottom: '110%', width: '200px' }}
          >
            {/* selected display */}
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-b border-[rgba(0,240,255,0.12)]">
              <span className="text-lg font-bold text-[#00f0ff]" style={{ textShadow: '0 0 8px rgba(0,240,255,0.5)' }}>
                {String(hour12).padStart(2, '0')}:{String(m).padStart(2, '0')}
              </span>
              <div className="flex flex-col gap-0.5">
                {['AM', 'PM'].map(ap => (
                  <button key={ap} onClick={() => toggleAMPM(ap === 'PM')}
                    className="text-[10px] font-bold px-2 py-0.5 rounded transition-all"
                    style={{
                      background: (ap === 'AM' && !isPM) || (ap === 'PM' && isPM) ? '#00f0ff' : 'rgba(0,240,255,0.1)',
                      color: (ap === 'AM' && !isPM) || (ap === 'PM' && isPM) ? '#050B18' : 'rgba(0,240,255,0.7)',
                    }}>
                    {ap}
                  </button>
                ))}
              </div>
            </div>
            {/* scroll columns */}
            <div className="flex">
              {/* Hours */}
              <div className="flex-1 max-h-44 overflow-y-auto custom-scroll border-r border-[rgba(0,240,255,0.08)]">
                {hours.map(hv => (
                  <button key={hv} onClick={() => setHour12(hv)}
                    className="w-full text-center py-2 text-sm transition-all"
                    style={{
                      color: hv === hour12 ? '#050B18' : '#e5e7eb',
                      background: hv === hour12 ? '#00f0ff' : 'transparent',
                      fontWeight: hv === hour12 ? 700 : 400,
                    }}
                    onMouseEnter={e => { if (hv !== hour12) (e.currentTarget as HTMLElement).style.background = 'rgba(0,240,255,0.12)'; }}
                    onMouseLeave={e => { if (hv !== hour12) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >{String(hv).padStart(2, '0')}</button>
                ))}
              </div>
              {/* Minutes */}
              <div className="flex-1 max-h-44 overflow-y-auto custom-scroll">
                {mins.map(mv => (
                  <button key={mv} onClick={() => setMin(mv)}
                    className="w-full text-center py-2 text-sm transition-all"
                    style={{
                      color: mv === m ? '#050B18' : '#e5e7eb',
                      background: mv === m ? '#00f0ff' : 'transparent',
                      fontWeight: mv === m ? 700 : 400,
                    }}
                    onMouseEnter={e => { if (mv !== m) (e.currentTarget as HTMLElement).style.background = 'rgba(0,240,255,0.12)'; }}
                    onMouseLeave={e => { if (mv !== m) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >{String(mv).padStart(2, '0')}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Generic Select Picker (guide language / participants)
───────────────────────────────────────────── */
export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  align?: 'left' | 'right';
  className?: string;
}

export function CustomSelect({ value, onChange, options, placeholder, align = 'left', className = '' }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      <div className="cyber-input-container flex items-center justify-between gap-2 cursor-pointer min-h-[42px]" onClick={() => setOpen(o => !o)}>
        <span className="text-sm text-white select-none">{selected?.label ?? placeholder ?? ''}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-[#00f0ff] shrink-0" />
        </motion.div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={POPUP_VARIANTS} initial="initial" animate="animate" exit="exit"
            transition={POPUP_TRANSITION}
            className="absolute z-[9999] mt-2 rounded-xl overflow-hidden w-full"
            style={{ ...POPUP_STYLE, bottom: '110%', [align === 'right' ? 'right' : 'left']: 0 }}
          >
            {options.map(opt => {
              const isSel = opt.value === value;
              return (
                <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm transition-all"
                  style={{
                    color: isSel ? '#050B18' : '#e5e7eb',
                    background: isSel ? '#00f0ff' : 'transparent',
                    fontWeight: isSel ? 700 : 400,
                  }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(0,240,255,0.12)'; }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >{opt.label}</button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
