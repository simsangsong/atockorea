// One-shot: insert `nav.tourRoom` + the `tourRoom` namespace into all 6 locale
// message files via *text insertion* (not JSON.parse → stringify), so the large
// existing files keep their formatting and the diff stays surgical.
//   run: node scripts/add-tour-room-i18n.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const LOCALES = {
  en: {
    nav: 'Tour Room',
    ns: {
      title: 'Tour Room',
      liveNow: 'Live now',
      today: 'Today',
      tomorrow: 'Tomorrow',
      date: 'Date',
      time: 'Time',
      guests: 'Guests',
      reference: 'Booking ref',
      chatHeading: 'Messages with your guide',
      chatPlaceholder: 'Type a message…',
      send: 'Send',
      chatEmpty: 'No messages yet. Say hello to your guide!',
      sendError: 'Couldn’t send. Please try again.',
      senderGuide: 'Guide',
      senderTeam: 'AtoC',
      noActiveTitle: 'No tour in progress',
      noActiveDesc: 'Your Tour Room opens the day before your tour.',
      opensSoon: 'Your Tour Room opens the day before your tour. We’ll have everything ready for you here.',
      viewUpcoming: 'View upcoming tours',
      browseTours: 'Browse tours',
      signInTitle: 'Sign in to open your Tour Room',
      signInDesc: 'Log in to see your tour details and chat with your guide.',
      loadError: 'We couldn’t open this Tour Room.',
    },
  },
  ko: {
    nav: '투어룸',
    ns: {
      title: '투어룸',
      liveNow: '실시간',
      today: '오늘',
      tomorrow: '내일',
      date: '날짜',
      time: '시간',
      guests: '인원',
      reference: '예약번호',
      chatHeading: '가이드와의 대화',
      chatPlaceholder: '메시지를 입력하세요…',
      send: '전송',
      chatEmpty: '아직 메시지가 없어요. 가이드에게 인사를 건네보세요!',
      sendError: '전송하지 못했어요. 다시 시도해 주세요.',
      senderGuide: '가이드',
      senderTeam: 'AtoC',
      noActiveTitle: '진행 중인 투어가 없어요',
      noActiveDesc: '투어룸은 투어 전날 열립니다.',
      opensSoon: '투어룸은 투어 전날 열립니다. 모든 준비를 여기에 모아둘게요.',
      viewUpcoming: '예정된 투어 보기',
      browseTours: '투어 둘러보기',
      signInTitle: '로그인하고 투어룸 열기',
      signInDesc: '로그인하면 투어 정보를 확인하고 가이드와 대화할 수 있어요.',
      loadError: '투어룸을 열 수 없습니다.',
    },
  },
  zh: {
    nav: '行程室',
    ns: {
      title: '行程室',
      liveNow: '进行中',
      today: '今天',
      tomorrow: '明天',
      date: '日期',
      time: '时间',
      guests: '人数',
      reference: '预订编号',
      chatHeading: '与向导的对话',
      chatPlaceholder: '输入消息…',
      send: '发送',
      chatEmpty: '还没有消息，先和向导打个招呼吧！',
      sendError: '发送失败，请重试。',
      senderGuide: '向导',
      senderTeam: 'AtoC',
      noActiveTitle: '暂无进行中的行程',
      noActiveDesc: '行程室将在出行前一天开放。',
      opensSoon: '行程室将在出行前一天开放，我们会把一切都为您准备在这里。',
      viewUpcoming: '查看即将出行',
      browseTours: '浏览行程',
      signInTitle: '登录以打开行程室',
      signInDesc: '登录后即可查看行程详情并与向导聊天。',
      loadError: '无法打开此行程室。',
    },
  },
  'zh-TW': {
    nav: '行程室',
    ns: {
      title: '行程室',
      liveNow: '進行中',
      today: '今天',
      tomorrow: '明天',
      date: '日期',
      time: '時間',
      guests: '人數',
      reference: '預訂編號',
      chatHeading: '與導遊的對話',
      chatPlaceholder: '輸入訊息…',
      send: '傳送',
      chatEmpty: '還沒有訊息，先和導遊打個招呼吧！',
      sendError: '傳送失敗，請重試。',
      senderGuide: '導遊',
      senderTeam: 'AtoC',
      noActiveTitle: '暫無進行中的行程',
      noActiveDesc: '行程室將在出發前一天開放。',
      opensSoon: '行程室將在出發前一天開放，我們會把一切都為您準備在這裡。',
      viewUpcoming: '查看即將出發',
      browseTours: '瀏覽行程',
      signInTitle: '登入以開啟行程室',
      signInDesc: '登入後即可查看行程詳情並與導遊聊天。',
      loadError: '無法開啟此行程室。',
    },
  },
  es: {
    nav: 'Sala Tour',
    ns: {
      title: 'Sala del Tour',
      liveNow: 'En directo',
      today: 'Hoy',
      tomorrow: 'Mañana',
      date: 'Fecha',
      time: 'Hora',
      guests: 'Personas',
      reference: 'Nº de reserva',
      chatHeading: 'Mensajes con tu guía',
      chatPlaceholder: 'Escribe un mensaje…',
      send: 'Enviar',
      chatEmpty: 'Aún no hay mensajes. ¡Saluda a tu guía!',
      sendError: 'No se pudo enviar. Inténtalo de nuevo.',
      senderGuide: 'Guía',
      senderTeam: 'AtoC',
      noActiveTitle: 'No hay ningún tour en curso',
      noActiveDesc: 'Tu Sala del Tour se abre el día antes del tour.',
      opensSoon: 'Tu Sala del Tour se abre el día antes del tour. Aquí tendremos todo listo para ti.',
      viewUpcoming: 'Ver próximos tours',
      browseTours: 'Explorar tours',
      signInTitle: 'Inicia sesión para abrir tu Sala del Tour',
      signInDesc: 'Inicia sesión para ver los detalles de tu tour y chatear con tu guía.',
      loadError: 'No pudimos abrir esta Sala del Tour.',
    },
  },
  ja: {
    nav: 'ツアールーム',
    ns: {
      title: 'ツアールーム',
      liveNow: 'ライブ中',
      today: '今日',
      tomorrow: '明日',
      date: '日付',
      time: '時刻',
      guests: '人数',
      reference: '予約番号',
      chatHeading: 'ガイドとのメッセージ',
      chatPlaceholder: 'メッセージを入力…',
      send: '送信',
      chatEmpty: 'まだメッセージがありません。ガイドに挨拶してみましょう！',
      sendError: '送信できませんでした。もう一度お試しください。',
      senderGuide: 'ガイド',
      senderTeam: 'AtoC',
      noActiveTitle: '進行中のツアーはありません',
      noActiveDesc: 'ツアールームはツアー前日に開きます。',
      opensSoon: 'ツアールームはツアー前日に開きます。すべてをここにご用意します。',
      viewUpcoming: '予定のツアーを見る',
      browseTours: 'ツアーを探す',
      signInTitle: 'ログインしてツアールームを開く',
      signInDesc: 'ログインするとツアー詳細の確認とガイドとのチャットができます。',
      loadError: 'このツアールームを開けませんでした。',
    },
  },
};

let failures = 0;
for (const [loc, { nav, ns }] of Object.entries(LOCALES)) {
  const file = `messages/${loc}.json`;
  let txt = readFileSync(file, 'utf8');

  if (txt.includes('"tourRoom"')) {
    console.log(`= ${loc}: already has tourRoom — skipped`);
    continue;
  }

  // (1) nav.tourRoom — first child of the nav object.
  txt = txt.replace(/("nav":\s*\{\r?\n)/, `$1    "tourRoom": ${JSON.stringify(nav)},\n`);

  // (2) tourRoom namespace — sibling inserted before the `tour` namespace.
  const body = JSON.stringify(ns, null, 2)
    .split('\n')
    .map((line) => '  ' + line)
    .join('\n')
    .trimStart();
  const insert = `\n  "tourRoom": ${body},`;
  txt = txt.replace(/\n  "tour":\s*\{/, `${insert}\n  "tour": {`);

  // Validate before writing.
  try {
    JSON.parse(txt);
  } catch (e) {
    console.error(`✗ ${loc}: would produce invalid JSON — ${e.message}`);
    failures++;
    continue;
  }
  if (!txt.includes('"tourRoom": {')) {
    console.error(`✗ ${loc}: namespace anchor "tour" not found — namespace NOT inserted`);
    failures++;
    continue;
  }

  writeFileSync(file, txt);
  console.log(`✓ ${loc}: nav.tourRoom + tourRoom namespace inserted`);
}

process.exit(failures ? 1 : 0);
