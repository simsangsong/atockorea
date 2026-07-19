/**
 * Phase 1 (input-pipeline fix) — MicPrime + useMicPermission.
 *
 * The preemptive mic-permission affordance: it shows an "allow" button when a
 * prompt is possible, guidance when hard-denied, and nothing once granted or
 * when the device can't record at all (text path covers that).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MicPrime from '@/components/tour-mode/MicPrime';

jest.mock('@/lib/tour-room/recorder', () => ({
  isVoiceRecordingSupported: jest.fn(() => true),
}));

const recorderMock = jest.requireMock('@/lib/tour-room/recorder');

interface StatusStub {
  state: PermissionState;
  onchange: (() => void) | null;
}

function mockPermissions(state: PermissionState | null): StatusStub | null {
  const status: StatusStub | null = state ? { state, onchange: null } : null;
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: status ? { query: jest.fn(async () => status) } : { query: jest.fn(async () => { throw new Error('unsupported'); }) },
  });
  return status;
}

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: jest.fn(impl) },
  });
}

const fakeStream = () => ({ getTracks: () => [{ stop: jest.fn() }] }) as unknown as MediaStream;

beforeEach(() => {
  jest.clearAllMocks();
  (recorderMock.isVoiceRecordingSupported as jest.Mock).mockReturnValue(true);
  mockGetUserMedia(async () => fakeStream());
});

describe('MicPrime / useMicPermission', () => {
  it('renders nothing when recording is unsupported (text path covers it)', async () => {
    (recorderMock.isVoiceRecordingSupported as jest.Mock).mockReturnValue(false);
    mockPermissions('granted');
    const { container } = render(<MicPrime variant="light" locale="ko" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing once the mic is already granted', async () => {
    mockPermissions('granted');
    render(<MicPrime variant="dark" locale="ko" />);
    await waitFor(() => expect(screen.queryByTestId('mic-prime-prompt')).not.toBeInTheDocument());
    expect(screen.queryByTestId('mic-prime-denied')).not.toBeInTheDocument();
  });

  it('shows the allow button on prompt, and hides after a successful grant', async () => {
    mockPermissions('prompt');
    render(<MicPrime variant="light" locale="ko" />);
    const prompt = await screen.findByTestId('mic-prime-prompt');
    expect(prompt).toHaveTextContent('마이크 허용');

    fireEvent.click(screen.getByRole('button', { name: /마이크 허용/ }));
    await waitFor(() => expect(screen.queryByTestId('mic-prime-prompt')).not.toBeInTheDocument());
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it('shows denied guidance when the prompt is rejected (NotAllowedError)', async () => {
    mockPermissions('prompt');
    mockGetUserMedia(async () => {
      throw new DOMException('blocked', 'NotAllowedError');
    });
    render(<MicPrime variant="light" locale="ko" />);
    fireEvent.click(await screen.findByRole('button', { name: /마이크 허용/ }));
    await waitFor(() => expect(screen.getByTestId('mic-prime-denied')).toBeInTheDocument());
    expect(screen.getByTestId('mic-prime-denied')).toHaveTextContent('마이크가 차단');
  });

  it('reflects a pre-existing hard-denied permission state', async () => {
    mockPermissions('denied');
    render(<MicPrime variant="dark" locale="en" />);
    const denied = await screen.findByTestId('mic-prime-denied');
    expect(denied).toHaveTextContent('Microphone is blocked');
  });

  it('falls back to a prompt affordance when permissions.query is unsupported', async () => {
    mockPermissions(null); // query throws
    render(<MicPrime variant="light" locale="ko" />);
    expect(await screen.findByTestId('mic-prime-prompt')).toBeInTheDocument();
  });
});
