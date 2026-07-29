'use client';

/**
 * SG-7b — the D-1 onboarding, three cards (제로베이스 ⑨). The first card
 * says the WEAKNESS out loud — "your driver doesn't speak English, on
 * purpose" — because framed as a choice it reads as confidence, and hidden
 * it reads as a defect discovered mid-tour. The second card has the guest
 * actually PRESS a signal chip; the reply is a LOCAL ECHO (SG-D14 — a real
 * send at D-1 evening would page a driver at dinner; the demo renders a
 * real pre-translated preset so nothing about it is fake except the
 * network). The third card introduces the licensed coordinator — no
 * response-time promise, no hours (N-4·SG-D16), no years (N-3).
 *
 * Lobby + customer + D≤1 + once per booking (localStorage). Renders inside
 * the themed root like every overlay (the transparent-sheet incident).
 */
import { useEffect, useState } from 'react';
import { quickRepliesForRole } from '@/lib/tour-room/quickReplies';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const seenKey = (bookingId: string) => `tr-onboard:${bookingId}`;

const COPY: Record<
  RoomLocale,
  {
    step1Title: string;
    step1Body: (driver: string | null) => string;
    step2Title: string;
    step2Body: string;
    chipToilet: string;
    chipPhoto: string;
    step3Title: string;
    step3Body: string;
    next: string;
    start: string;
    skip: string;
  }
> = {
  en: {
    step1Title: 'Your driver doesn’t speak English',
    step1Body: (d) =>
      `That’s on purpose — we hire the drivers who know Jeju best${d ? `, like ${d}` : ''}, not the ones who happen to know English. This app is their voice.`,
    step2Title: 'This is how you talk to them',
    step2Body: 'Tap once — it arrives in Korean, the answer comes back in your language. Try it (nothing is sent today):',
    chipToilet: 'Toilet',
    chipPhoto: 'Photo',
    step3Title: 'And a licensed guide is on call',
    step3Body: 'A national licensed tour guide (English · Chinese) watches the tour and steps in whenever you need a person.',
    next: 'Next',
    start: 'Got it',
    skip: 'Skip',
  },
  ko: {
    step1Title: '기사님은 영어를 하지 않습니다',
    step1Body: (d) =>
      `의도된 것입니다 — 영어를 하는 기사가 아니라 제주를 가장 잘 아는 기사${d ? ` ${d}님` : ''}를 모십니다. 이 앱이 기사님의 언어입니다.`,
    step2Title: '기사님과는 이렇게 대화해요',
    step2Body: '한 번 탭하면 한국어로 전달되고, 답은 내 언어로 옵니다. 눌러보세요 (지금은 전송되지 않아요):',
    chipToilet: '화장실',
    chipPhoto: '사진',
    step3Title: '유자격 가이드가 대기합니다',
    step3Body: '관광통역안내사(영어·중국어)가 투어를 지켜보다 사람이 필요한 순간 개입합니다.',
    next: '다음',
    start: '알겠어요',
    skip: '건너뛰기',
  },
  ja: {
    step1Title: 'ドライバーは英語を話しません',
    step1Body: (d) =>
      `意図的な選択です — 英語ができる運転手ではなく、済州を最もよく知る運転手${d ? `（${d}さん）` : ''}をお迎えしています。このアプリが彼らの言葉です。`,
    step2Title: 'ドライバーとの会話はこちら',
    step2Body: 'ワンタップで韓国語で伝わり、返事はあなたの言語で届きます。試してみてください（今日は送信されません）：',
    chipToilet: 'トイレ',
    chipPhoto: '写真',
    step3Title: '有資格ガイドが待機しています',
    step3Body: '国家資格の観光通訳ガイド（英語・中国語）がツアーを見守り、人が必要な瞬間に介入します。',
    next: '次へ',
    start: 'わかりました',
    skip: 'スキップ',
  },
  zh: {
    step1Title: '司机不会说英语',
    step1Body: (d) =>
      `这是我们的选择——我们聘请最了解济州的司机${d ? `（${d}）` : ''}，而不是恰好会英语的司机。这个应用就是他们的语言。`,
    step2Title: '这样与司机沟通',
    step2Body: '轻点一下，以韩语传达，回复会以您的语言送达。试试看（今天不会真正发送）：',
    chipToilet: '洗手间',
    chipPhoto: '拍照',
    step3Title: '持证导游随时待命',
    step3Body: '国家认证的旅游翻译导游（英语·中文）关注着行程，需要真人时随时介入。',
    next: '下一步',
    start: '知道了',
    skip: '跳过',
  },
  'zh-TW': {
    step1Title: '司機不會說英語',
    step1Body: (d) =>
      `這是我們的選擇——我們聘請最了解濟州的司機${d ? `（${d}）` : ''}，而不是恰好會英語的司機。這個應用就是他們的語言。`,
    step2Title: '這樣與司機溝通',
    step2Body: '輕觸一下，以韓語傳達，回覆會以您的語言送達。試試看（今天不會真正發送）：',
    chipToilet: '洗手間',
    chipPhoto: '拍照',
    step3Title: '持證導遊隨時待命',
    step3Body: '國家認證的旅遊翻譯導遊（英語·中文）關注著行程，需要真人時隨時介入。',
    next: '下一步',
    start: '知道了',
    skip: '跳過',
  },
  es: {
    step1Title: 'Su conductor no habla inglés',
    step1Body: (d) =>
      `Es a propósito: contratamos a los conductores que mejor conocen Jeju${d ? `, como ${d}` : ''}, no a los que casualmente hablan inglés. Esta app es su voz.`,
    step2Title: 'Así se habla con él',
    step2Body: 'Un toque: llega en coreano y la respuesta vuelve en su idioma. Pruébelo (hoy no se envía nada):',
    chipToilet: 'Aseo',
    chipPhoto: 'Foto',
    step3Title: 'Y un guía titulado está de guardia',
    step3Body: 'Un guía turístico titulado (inglés · chino) sigue el tour e interviene cuando necesita a una persona.',
    next: 'Siguiente',
    start: 'Entendido',
    skip: 'Omitir',
  },
  fr: {
    step1Title: 'Votre chauffeur ne parle pas anglais',
    step1Body: (d) =>
      `C’est voulu : nous recrutons les chauffeurs qui connaissent le mieux Jeju${d ? `, comme ${d}` : ''}, pas ceux qui parlent anglais par hasard. Cette app est leur voix.`,
    step2Title: 'Voici comment lui parler',
    step2Body: 'Un seul geste : transmis en coréen, la réponse revient dans votre langue. Essayez (rien n’est envoyé aujourd’hui) :',
    chipToilet: 'Toilettes',
    chipPhoto: 'Photo',
    step3Title: 'Et un guide diplômé veille',
    step3Body: 'Un guide-interprète diplômé d’État (anglais · chinois) suit le tour et intervient dès qu’il vous faut une personne.',
    next: 'Suivant',
    start: 'Compris',
    skip: 'Passer',
  },
  de: {
    step1Title: 'Ihr Fahrer spricht kein Englisch',
    step1Body: (d) =>
      `Das ist Absicht — wir engagieren die Fahrer, die Jeju am besten kennen${d ? `, wie ${d}` : ''}, nicht die, die zufällig Englisch können. Diese App ist ihre Stimme.`,
    step2Title: 'So sprechen Sie mit ihm',
    step2Body: 'Ein Tipp — es kommt auf Koreanisch an, die Antwort in Ihrer Sprache zurück. Probieren Sie es (heute wird nichts gesendet):',
    chipToilet: 'Toilette',
    chipPhoto: 'Foto',
    step3Title: 'Und ein lizenzierter Guide ist auf Abruf',
    step3Body: 'Ein staatlich lizenzierter Reiseleiter (Englisch · Chinesisch) begleitet die Tour und greift ein, wenn Sie einen Menschen brauchen.',
    next: 'Weiter',
    start: 'Verstanden',
    skip: 'Überspringen',
  },
  ru: {
    step1Title: 'Ваш водитель не говорит по-английски',
    step1Body: (d) =>
      `Это осознанный выбор: мы нанимаем водителей, которые лучше всех знают Чеджу${d ? `, таких как ${d}` : ''}, а не тех, кто случайно знает английский. Это приложение — их голос.`,
    step2Title: 'Вот как с ним говорить',
    step2Body: 'Одно касание — сообщение уходит по-корейски, ответ приходит на вашем языке. Попробуйте (сегодня ничего не отправится):',
    chipToilet: 'Туалет',
    chipPhoto: 'Фото',
    step3Title: 'И лицензированный гид на связи',
    step3Body: 'Гид с государственной лицензией (английский · китайский) следит за туром и подключается, когда нужен человек.',
    next: 'Далее',
    start: 'Понятно',
    skip: 'Пропустить',
  },
  it: {
    step1Title: 'Il suo autista non parla inglese',
    step1Body: (d) =>
      `È una scelta: assumiamo gli autisti che conoscono meglio Jeju${d ? `, come ${d}` : ''}, non quelli che per caso sanno l’inglese. Questa app è la loro voce.`,
    step2Title: 'Ecco come parlargli',
    step2Body: 'Un tocco: arriva in coreano, la risposta torna nella sua lingua. Provi (oggi non viene inviato nulla):',
    chipToilet: 'Bagno',
    chipPhoto: 'Foto',
    step3Title: 'E una guida abilitata è di turno',
    step3Body: 'Una guida turistica abilitata (inglese · cinese) segue il tour e interviene quando serve una persona.',
    next: 'Avanti',
    start: 'Capito',
    skip: 'Salta',
  },
};

export default function OnboardingCards({
  bookingId,
  locale,
  driverName,
}: {
  bookingId: string;
  locale: RoomLocale;
  driverName?: string | null;
}) {
  const copy = COPY[locale];
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [echo, setEcho] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(seenKey(bookingId)) !== '1') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [bookingId]);

  const close = () => {
    try {
      window.localStorage.setItem(seenKey(bookingId), '1');
    } catch {
      /* remembered next time */
    }
    setOpen(false);
  };

  if (!open) return null;

  // LOCAL echo — a REAL pre-translated driver preset, zero network (SG-D14).
  const demo = () => {
    const preset = quickRepliesForRole('driver').find((p) => p.key === 'rest_stop');
    setEcho(preset ? preset.text[locale] : null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4" data-testid="onboarding">
      <div className="tr-card w-full max-w-md px-5 py-5">
        <p className="tr-meta tr-num font-bold text-[var(--tr-ink-3)]">{step + 1} / 3</p>
        {step === 0 && (
          <>
            <p className="tr-body-lg text-cjk-body mt-2 font-bold text-[var(--tr-ink)]">{copy.step1Title}</p>
            <p className="tr-card-text text-cjk-body mt-2 leading-relaxed text-[var(--tr-ink-2)]">
              {copy.step1Body(driverName ?? null)}
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <p className="tr-body-lg text-cjk-body mt-2 font-bold text-[var(--tr-ink)]">{copy.step2Title}</p>
            <p className="tr-card-text text-cjk-body mt-2 leading-relaxed text-[var(--tr-ink-2)]">{copy.step2Body}</p>
            <div className="text-cjk-safe mt-3 flex gap-2">
              <button
                type="button"
                data-testid="onboard-demo-chip"
                onClick={demo}
                className="tr-chip-tap tr-label text-cjk-safe flex h-10 flex-1 items-center justify-center rounded-full bg-[var(--tr-surface-2)] font-semibold text-[var(--tr-ink)]"
              >
                {copy.chipToilet}
              </button>
              <button
                type="button"
                onClick={demo}
                className="tr-chip-tap tr-label text-cjk-safe flex h-10 flex-1 items-center justify-center rounded-full bg-[var(--tr-surface-2)] font-semibold text-[var(--tr-ink)]"
              >
                {copy.chipPhoto}
              </button>
            </div>
            {echo && (
              <p
                data-testid="onboard-demo-echo"
                className="tr-card-text text-cjk-body mt-3 rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3 text-[var(--tr-ink)]"
              >
                {echo}
              </p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <p className="tr-body-lg text-cjk-body mt-2 font-bold text-[var(--tr-ink)]">{copy.step3Title}</p>
            <p className="tr-card-text text-cjk-body mt-2 leading-relaxed text-[var(--tr-ink-2)]">{copy.step3Body}</p>
          </>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="tr-label text-cjk-safe font-semibold text-[var(--tr-ink-3)]">
            {copy.skip}
          </button>
          <button
            type="button"
            data-testid="onboard-next"
            onClick={() => (step < 2 ? setStep(step + 1) : close())}
            className="tr-btn-physical text-cjk-safe min-h-[44px] rounded-full bg-[var(--tr-accent)] px-6 tr-label font-bold text-[var(--tr-on-accent)]"
          >
            {step < 2 ? copy.next : copy.start}
          </button>
        </div>
      </div>
    </div>
  );
}
