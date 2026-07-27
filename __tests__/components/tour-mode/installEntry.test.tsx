/**
 * T-D2 — persistent PWA install entry points. jsdom never fires
 * beforeinstallprompt, so the module test-seam injects the captured event;
 * the iOS path is driven by a UA override. Covers: self-hiding default,
 * native one-tap flow (event consumed → entries retire), the iOS share-sheet
 * guide, and the Settings tab carrying the card while the quick-reply
 * reminder card stays gone.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsTab from '@/components/tour-mode/SettingsTab';
import InstallCard from '@/components/tour-mode/InstallCard';
import { CUSTOMER_QUICK_REPLIES } from '@/lib/tour-room/quickReplies';
import {
  isIosSafariUa,
  __setInstallPromptStateForTests,
  type BeforeInstallPromptEvent,
} from '@/hooks/useInstallPrompt';

const realUserAgent = window.navigator.userAgent;

function setUserAgent(value: string): void {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

function fakePromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): BeforeInstallPromptEvent {
  return Object.assign(new Event('beforeinstallprompt'), {
    prompt: jest.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  }) as BeforeInstallPromptEvent;
}

afterEach(() => {
  __setInstallPromptStateForTests({ deferred: null, installed: false });
  setUserAgent(realUserAgent);
});

describe('isIosSafariUa', () => {
  it('matches iOS Safari and rejects iOS Chrome/Firefox and Android', () => {
    expect(
      isIosSafariUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Safari/604.1'),
    ).toBe(true);
    expect(isIosSafariUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) CriOS/125 Safari/604.1')).toBe(false);
    expect(isIosSafariUa('Mozilla/5.0 (Linux; Android 14) Chrome/125 Mobile Safari/537.36')).toBe(false);
  });
});

describe('InstallCard (T-D2)', () => {
  it('renders nothing when no install path exists (jsdom default)', () => {
    render(<InstallCard locale="en" />);
    expect(screen.queryByTestId('install-card')).not.toBeInTheDocument();
  });

  it('native mode: one-tap install consumes the event and the card retires', async () => {
    const event = fakePromptEvent('accepted');
    __setInstallPromptStateForTests({ deferred: event });
    render(<InstallCard locale="ko" />);
    expect(screen.getByTestId('install-card')).toHaveTextContent('홈 화면에 추가');
    fireEvent.click(screen.getByTestId('install-card-native'));
    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
    // consumed → mode returns to unavailable → the card self-hides
    await waitFor(() => expect(screen.queryByTestId('install-card')).not.toBeInTheDocument());
  });

  it('iOS Safari mode: shows the 2-step share-sheet guide instead of a button', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Safari/604.1');
    __setInstallPromptStateForTests({ deferred: null }); // re-emit so mode recomputes
    render(<InstallCard locale="en" />);
    expect(screen.getByTestId('install-card-ios')).toBeInTheDocument();
    expect(screen.queryByTestId('install-card-native')).not.toBeInTheDocument();
  });

  it('hides for good once appinstalled marked the session installed', () => {
    __setInstallPromptStateForTests({ deferred: fakePromptEvent(), installed: true });
    render(<InstallCard locale="en" />);
    expect(screen.queryByTestId('install-card')).not.toBeInTheDocument();
  });
});

describe('SettingsTab install slot (T-D1/T-D2)', () => {
  it('carries the install card when eligible and never the old quick-reply chips', () => {
    __setInstallPromptStateForTests({ deferred: fakePromptEvent() });
    render(<SettingsTab locale="ko" onLocaleChange={jest.fn()} />);
    expect(screen.getByTestId('install-card')).toBeInTheDocument();
    // T-D1 — the read-only quick-reply reminder card is gone from Settings
    // (the LIVE quick replies stay in the Composer, untouched).
    const firstPreset = CUSTOMER_QUICK_REPLIES[0];
    expect(screen.queryByText(new RegExp(firstPreset.text.ko))).not.toBeInTheDocument();
  });
});
