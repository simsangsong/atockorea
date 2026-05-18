"use client";

import { useEffect, useState } from "react";

type DetectInput = {
  userAgent: string;
  isStandalone: boolean;
  maxTouchPoints: number;
};

const IOS_DEVICE_PATTERN = /iPhone|iPad|iPod/;
const IPAD_MASQUERADE_PATTERN = /Macintosh/;
const IN_APP_BROWSER_PATTERN =
  /KAKAOTALK[/\s]|Instagram[/\s]|FBAN\/FBIOS|FBAV\/|NAVER\(inapp|Line[/\s]|KAKAOSTORY[/\s]|daumapps[/\s]/i;

export function detectIosBackbar({
  userAgent,
  isStandalone,
  maxTouchPoints,
}: DetectInput): boolean {
  const isIosDevice =
    IOS_DEVICE_PATTERN.test(userAgent) ||
    (IPAD_MASQUERADE_PATTERN.test(userAgent) && maxTouchPoints > 1);

  if (!isIosDevice) return false;

  const isInAppBrowser = IN_APP_BROWSER_PATTERN.test(userAgent);
  return isStandalone || isInAppBrowser;
}

export function useIosBackbar(): boolean {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const compute = () => {
      const standaloneFlag =
        (navigator as Navigator & { standalone?: boolean }).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      setShouldShow(
        detectIosBackbar({
          userAgent: navigator.userAgent,
          isStandalone: standaloneFlag,
          maxTouchPoints: navigator.maxTouchPoints ?? 0,
        })
      );
    };

    compute();

    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => compute();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return shouldShow;
}
