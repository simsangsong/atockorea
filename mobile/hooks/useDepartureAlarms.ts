import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

interface ScheduleItem {
  time?: string;
  departure_time?: string;
  title?: string;
}

/**
 * Schedules 10 / 5 / 2 minute alerts before each bus departure_time on tour_date.
 * When onBus is true, does not fire any more alerts.
 */
export function useDepartureAlarms(
  schedule: ScheduleItem[],
  tourDate: string,
  onBus: boolean,
  enabled: boolean
) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !schedule?.length || !tourDate || onBus) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const now = Date.now();
    const today = tourDate; // YYYY-MM-DD

    const scheduleAlarm = (
      departureKey: string,
      delayMs: number,
      minutesBefore: number,
      message: string
    ) => {
      if (delayMs <= 0 || firedRef.current.has(departureKey + minutesBefore)) return;
      timeouts.push(
        setTimeout(() => {
          if (firedRef.current.has(departureKey + minutesBefore)) return;
          firedRef.current.add(departureKey + minutesBefore);
          Alert.alert('Bus departure', message);
        }, delayMs)
      );
    };

    schedule.forEach((item, index) => {
      const timeStr = item.departure_time ?? item.time;
      if (!timeStr) return;

      const [h, m] = timeStr.split(':').map(Number);
      const depMs = new Date(
        `${today}T${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00`
      ).getTime();
      const diffMs = depMs - now;
      const title = item.title ?? `Stop ${index + 1}`;
      const key = `${today}-${timeStr}`;

      if (diffMs > 10 * 60 * 1000) {
        scheduleAlarm(key, diffMs - 10 * 60 * 1000, 10, `Bus departs in 10 minutes: ${title}`);
        scheduleAlarm(key, diffMs - 5 * 60 * 1000, 5, `Bus departs in 5 minutes: ${title}`);
        scheduleAlarm(key, diffMs - 2 * 60 * 1000, 2, `Bus departs in 2 minutes: ${title}`);
      } else if (diffMs > 5 * 60 * 1000) {
        scheduleAlarm(key, diffMs - 5 * 60 * 1000, 5, `Bus departs in 5 minutes: ${title}`);
        scheduleAlarm(key, diffMs - 2 * 60 * 1000, 2, `Bus departs in 2 minutes: ${title}`);
      } else if (diffMs > 2 * 60 * 1000) {
        scheduleAlarm(key, diffMs - 2 * 60 * 1000, 2, `Bus departs in 2 minutes: ${title}`);
      }
    });

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [schedule, tourDate, onBus, enabled]);
}
