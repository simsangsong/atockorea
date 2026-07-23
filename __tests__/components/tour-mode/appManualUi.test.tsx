/**
 * A4 (plan §11.A) — the Settings app-manual card is an accordion: icon +
 * title always visible, body collapsed by default, tap to expand/collapse.
 * The first-entry auto sheet (localStorage-gated) keeps its behavior.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import AppManual from '@/components/tour-mode/AppManual';
import { MANUAL_SEEN_KEY, MANUAL_TITLE, manualSections } from '@/lib/tour-room/appManual';

describe('AppManual inline accordion (A4)', () => {
  it('shows the icon+title header but keeps the body collapsed by default', () => {
    render(<AppManual variant="inline" kind="join" locale="ko" />);
    expect(screen.getByTestId('app-manual-inline')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(MANUAL_TITLE.ko))).toBeInTheDocument();
    expect(screen.queryByTestId('app-manual-body')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-manual-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands on tap (sections render) and collapses on a second tap', () => {
    render(<AppManual variant="inline" kind="join" locale="en" />);
    const toggle = screen.getByTestId('app-manual-toggle');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const body = screen.getByTestId('app-manual-body');
    const firstSection = manualSections('join')[0];
    expect(body).toHaveTextContent(firstSection.title.en);

    fireEvent.click(toggle);
    expect(screen.queryByTestId('app-manual-body')).not.toBeInTheDocument();
  });

  it('auto variant still opens the one-time sheet for a first-time guest', () => {
    window.localStorage.removeItem(MANUAL_SEEN_KEY);
    render(<AppManual variant="auto" kind="join" locale="ko" />);
    expect(screen.getByTestId('app-manual-auto')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('app-manual-dismiss'));
    expect(window.localStorage.getItem(MANUAL_SEEN_KEY)).toBeTruthy();
  });

  it('auto variant never re-opens once dismissed', () => {
    window.localStorage.setItem(MANUAL_SEEN_KEY, String(Date.now()));
    render(<AppManual variant="auto" kind="join" locale="ko" />);
    expect(screen.queryByTestId('app-manual-auto')).not.toBeInTheDocument();
  });
});
