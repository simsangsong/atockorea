/**
 * Device-native STT (Web Speech) — UA gate + one-shot recognition lifecycle.
 */
import { deviceSttUsable, isDeviceSttSupported, startDeviceStt } from '@/lib/tour-room/deviceStt';

const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';
const SAMSUNG_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121 Mobile Safari/537.36';
const KAKAO_UA = 'Mozilla/5.0 (Linux; Android 14) ... KAKAOTALK/10.5.0';

describe('deviceSttUsable (pure UA/ctor gate)', () => {
  it('allows Chrome/Android when the constructor exists', () => {
    expect(deviceSttUsable(true, CHROME_UA)).toBe(true);
  });
  it('rejects when no SpeechRecognition constructor exists', () => {
    expect(deviceSttUsable(false, CHROME_UA)).toBe(false);
  });
  it('excludes Samsung Internet (exposes but does not honour the API)', () => {
    expect(deviceSttUsable(true, SAMSUNG_UA)).toBe(false);
  });
  it('excludes in-app webviews (KakaoTalk)', () => {
    expect(deviceSttUsable(true, KAKAO_UA)).toBe(false);
  });
});

class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
  onerror: ((e: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  aborted = false;
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.(); // engines fire onend on stop
  }
  abort() {
    this.aborted = true;
  }
  emit(text: string, isFinal: boolean) {
    this.onresult?.({ results: [{ isFinal, 0: { transcript: text } }] });
  }
}

describe('startDeviceStt (one-shot recognition)', () => {
  let inst: FakeRecognition;
  const w = window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown };

  beforeEach(() => {
    inst = new FakeRecognition();
    w.webkitSpeechRecognition = function () {
      return inst;
    } as unknown;
    delete w.SpeechRecognition;
  });
  afterEach(() => {
    delete w.webkitSpeechRecognition;
  });

  it('streams interim words and resolves the trimmed final transcript on stop', () => {
    const onFinal = jest.fn();
    const onPartial = jest.fn();
    const handle = startDeviceStt({ lang: 'ko-KR', onFinal, onPartial });
    expect(inst.started).toBe(true);
    expect(inst.lang).toBe('ko-KR');

    inst.emit('안녕', false);
    expect(onPartial).toHaveBeenCalledWith('안녕');
    inst.emit('안녕하세요 여기예요 ', true);

    handle.stop(); // → onend → settle
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('안녕하세요 여기예요');
  });

  it('settles once with the empty string when nothing was recognized', () => {
    const onFinal = jest.fn();
    startDeviceStt({ lang: 'en-US', onFinal });
    inst.onend?.();
    inst.onend?.(); // a second natural end must not double-fire
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('');
  });

  it('cancel() aborts and never fires onFinal', () => {
    const onFinal = jest.fn();
    const handle = startDeviceStt({ lang: 'en-US', onFinal });
    handle.cancel();
    expect(inst.aborted).toBe(true);
    inst.onend?.(); // even if the engine ends afterwards
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('reports an error to the caller and still settles', () => {
    const onFinal = jest.fn();
    const onError = jest.fn();
    startDeviceStt({ lang: 'ko-KR', onFinal, onError });
    inst.onerror?.({ error: 'no-speech' });
    expect(onError).toHaveBeenCalledWith('no-speech');
    expect(onFinal).toHaveBeenCalledWith('');
  });

  it('with no constructor, immediately settles empty (caller falls back to server)', () => {
    delete w.webkitSpeechRecognition;
    const onFinal = jest.fn();
    const onError = jest.fn();
    startDeviceStt({ lang: 'ko-KR', onFinal, onError });
    expect(onError).toHaveBeenCalledWith('unsupported');
    expect(onFinal).toHaveBeenCalledWith('');
    expect(isDeviceSttSupported()).toBe(false);
  });
});
