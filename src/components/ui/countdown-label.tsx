"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

export interface CountdownLabelProps {
  /** ISO date string. Server is source of truth. */
  targetAt: string;
  /** Optional prefix, e.g. "Balance due in" */
  prefix?: string;
  /** Optional suffix when countdown has passed */
  expiredLabel?: string;
  className?: string;
}

function getTimeLeft(targetAt: string): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
} {
  const target = new Date(targetAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);
  const expired = diff === 0;

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);

  return { days, hours, minutes, seconds, expired };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Countdown display for balance deadline, refund cutoff, etc.
 * Uses tabular-nums for alignment. Target time is server-driven.
 */
export function CountdownLabel({
  targetAt,
  prefix,
  expiredLabel = "Passed",
  className,
}: CountdownLabelProps) {
  const [left, setLeft] = useState(() => getTimeLeft(targetAt));

  useEffect(() => {
    const t = setInterval(() => {
      setLeft(getTimeLeft(targetAt));
    }, 1000);
    return () => clearInterval(t);
  }, [targetAt]);

  if (left.expired) {
    return (
      <span className={clsx("tabular-nums", className)}>{expiredLabel}</span>
    );
  }

  const parts: string[] = [];
  if (left.days > 0) parts.push(`${left.days}d`);
  parts.push(`${pad(left.hours)}:${pad(left.minutes)}:${pad(left.seconds)}`);
  const text = parts.join(" ");

  return (
    <span className={clsx("tabular-nums", className)}>
      {prefix ? `${prefix} ${text}` : text}
    </span>
  );
}
