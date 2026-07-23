// AtoC 통합 Phase 2 — WhatsApp 발송 프리셋 (plan §4.2).
// 6 locale (기존 content_locales 키 체계: en/ko/zh/zh-TW/es/ja) × 5 프리셋.
// 이 모듈이 단일 소스: ① 시드 스크립트가 ops_whatsapp_templates로 upsert
// ② 테이블 미적용/미시드 상태에서는 admin UI가 이 정의를 그대로 폴백 사용.
// 변수는 wa-deep-link.renderWaTemplate 규약 (plan: {guest_name} {tour_date}
// {pickup_time} {room_link} {pass_link} + {tour_name} {pickup_point} {operator}).

export const WA_LOCALES = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja'] as const
export type WaLocale = (typeof WA_LOCALES)[number]

export const WA_PRESET_KEYS = [
  'confirm_d7', // 예약확정 (D-7)
  'pickup_d1', // 픽업 재확인 (D-1)
  'room_invite', // 룸 초대 + 좌석지정 안내 (D-1~당일 아침)
  'day_pass', // 당일 아침 패스/체크인 안내
  'thanks', // 투어 종료 감사 (D+0)
] as const
export type WaPresetKey = (typeof WA_PRESET_KEYS)[number]

export interface WaPresetDefinition {
  key: WaPresetKey
  /** Admin-facing Korean label (버튼/드롭다운). */
  label: string
  /** 발송 권장 시점 힌트 (admin 표시용). */
  timing: string
  bodies: Record<WaLocale, string>
}

const L = (lines: string[]) => lines.join('\n')

export const WA_PRESETS: WaPresetDefinition[] = [
  {
    key: 'confirm_d7',
    label: '예약 확정 안내',
    timing: 'D-7',
    bodies: {
      en: L([
        'Hello {guest_name}, this is {operator}. 👋',
        '',
        'Your booking is confirmed:',
        '· Tour: {tour_name}',
        '· Date: {tour_date}',
        '',
        'We will send your pickup details closer to the date.',
        'If anything changes, just reply to this message. Thank you!',
      ]),
      ko: L([
        '안녕하세요 {guest_name}님, {operator}입니다. 👋',
        '',
        '예약이 확정되었습니다:',
        '· 투어: {tour_name}',
        '· 날짜: {tour_date}',
        '',
        '픽업 상세는 투어일에 가까워지면 다시 안내드립니다.',
        '변경 사항이 있으면 이 메시지에 회신해 주세요. 감사합니다!',
      ]),
      zh: L([
        '{guest_name} 您好，这里是 {operator}。👋',
        '',
        '您的预订已确认:',
        '· 行程: {tour_name}',
        '· 日期: {tour_date}',
        '',
        '接送详情将在临近日期时另行通知。',
        '如有变动请直接回复此消息。谢谢!',
      ]),
      'zh-TW': L([
        '{guest_name} 您好，這裡是 {operator}。👋',
        '',
        '您的預訂已確認:',
        '· 行程: {tour_name}',
        '· 日期: {tour_date}',
        '',
        '接送詳情將在臨近日期時另行通知。',
        '如有變動請直接回覆此訊息。謝謝!',
      ]),
      es: L([
        'Hola {guest_name}, somos {operator}. 👋',
        '',
        'Su reserva está confirmada:',
        '· Tour: {tour_name}',
        '· Fecha: {tour_date}',
        '',
        'Le enviaremos los detalles de recogida cuando se acerque la fecha.',
        'Si algo cambia, responda a este mensaje. ¡Gracias!',
      ]),
      ja: L([
        '{guest_name} 様、{operator}でございます。👋',
        '',
        'ご予約が確定いたしました:',
        '・ツアー: {tour_name}',
        '・日付: {tour_date}',
        '',
        'ピックアップの詳細は日程が近づきましたら改めてご案内いたします。',
        'ご変更があればこのメッセージにご返信ください。ありがとうございます!',
      ]),
    },
  },
  {
    key: 'pickup_d1',
    label: '픽업 재확인',
    timing: 'D-1',
    bodies: {
      en: L([
        'Hello {guest_name}, this is {operator}. 👋',
        '',
        'Reminder for tomorrow — {tour_name} ({tour_date}):',
        '📍 Pickup: {pickup_point}',
        '🕗 Time: {pickup_time}',
        '',
        'We may arrive a few minutes early, so please be ready at your pickup point.',
        'If you received this message, please reply to confirm. Thank you!',
      ]),
      ko: L([
        '안녕하세요 {guest_name}님, {operator}입니다. 👋',
        '',
        '내일 투어 리마인더 — {tour_name} ({tour_date}):',
        '📍 픽업: {pickup_point}',
        '🕗 시간: {pickup_time}',
        '',
        '차량이 몇 분 일찍 도착할 수 있으니 조금 먼저 나와 기다려 주세요.',
        '이 메시지를 받으셨으면 회신으로 확인 부탁드립니다. 감사합니다!',
      ]),
      zh: L([
        '{guest_name} 您好，这里是 {operator}。👋',
        '',
        '明日行程提醒 — {tour_name} ({tour_date}):',
        '📍 接送地点: {pickup_point}',
        '🕗 时间: {pickup_time}',
        '',
        '车辆可能提前几分钟到达，请提前在接送点等候。',
        '收到此消息请回复确认。谢谢!',
      ]),
      'zh-TW': L([
        '{guest_name} 您好，這裡是 {operator}。👋',
        '',
        '明日行程提醒 — {tour_name} ({tour_date}):',
        '📍 接送地點: {pickup_point}',
        '🕗 時間: {pickup_time}',
        '',
        '車輛可能提前幾分鐘抵達，請提早在接送點等候。',
        '收到此訊息請回覆確認。謝謝!',
      ]),
      es: L([
        'Hola {guest_name}, somos {operator}. 👋',
        '',
        'Recordatorio para mañana — {tour_name} ({tour_date}):',
        '📍 Recogida: {pickup_point}',
        '🕗 Hora: {pickup_time}',
        '',
        'Podemos llegar unos minutos antes; por favor esté listo en el punto de recogida.',
        'Si recibió este mensaje, responda para confirmar. ¡Gracias!',
      ]),
      ja: L([
        '{guest_name} 様、{operator}でございます。👋',
        '',
        '明日のツアーのご案内 — {tour_name} ({tour_date}):',
        '📍 ピックアップ: {pickup_point}',
        '🕗 時間: {pickup_time}',
        '',
        '車両が数分早く到着する場合がございますので、少し早めにお越しください。',
        'このメッセージを受け取られましたら、ご返信にてご確認をお願いいたします。',
      ]),
    },
  },
  {
    key: 'room_invite',
    label: '룸 초대 + 좌석 안내',
    timing: 'D-1 ~ 당일 아침',
    bodies: {
      en: L([
        'Hello {guest_name}! 👋',
        '',
        'Your tour room for {tour_name} ({tour_date}) is open:',
        '{room_link}',
        '',
        'Open the link, tap your name, and pick your seats before departure.',
        'Live guide chat + today’s schedule are inside. — {operator}',
      ]),
      ko: L([
        '안녕하세요 {guest_name}님! 👋',
        '',
        '{tour_name} ({tour_date}) 투어룸이 열렸습니다:',
        '{room_link}',
        '',
        '링크를 열고 본인 이름을 선택한 뒤 출발 전 좌석을 지정해 주세요.',
        '가이드 실시간 채팅과 오늘 일정도 룸에서 확인할 수 있습니다. — {operator}',
      ]),
      zh: L([
        '{guest_name} 您好! 👋',
        '',
        '{tour_name} ({tour_date}) 的行程房间已开放:',
        '{room_link}',
        '',
        '请打开链接选择您的姓名，并在出发前选好座位。',
        '房间内可与导游实时聊天并查看当日行程。— {operator}',
      ]),
      'zh-TW': L([
        '{guest_name} 您好! 👋',
        '',
        '{tour_name} ({tour_date}) 的行程房間已開放:',
        '{room_link}',
        '',
        '請開啟連結選擇您的姓名，並在出發前選好座位。',
        '房間內可與導遊即時聊天並查看當日行程。— {operator}',
      ]),
      es: L([
        '¡Hola {guest_name}! 👋',
        '',
        'La sala de su tour {tour_name} ({tour_date}) ya está abierta:',
        '{room_link}',
        '',
        'Abra el enlace, seleccione su nombre y elija sus asientos antes de la salida.',
        'Dentro encontrará el chat con el guía y el itinerario del día. — {operator}',
      ]),
      ja: L([
        '{guest_name} 様、こんにちは! 👋',
        '',
        '{tour_name} ({tour_date}) のツアールームが開きました:',
        '{room_link}',
        '',
        'リンクを開いてお名前を選択し、出発前に座席をお選びください。',
        'ガイドとのチャットや当日の日程もルームでご確認いただけます。— {operator}',
      ]),
    },
  },
  {
    key: 'day_pass',
    label: '당일 아침 패스',
    timing: '당일 아침',
    bodies: {
      en: L([
        'Good morning {guest_name}! ☀️',
        '',
        'Today is your {tour_name} day. Your pass:',
        '{pass_link}',
        '',
        '📍 Pickup: {pickup_point}',
        '🕗 Time: {pickup_time}',
        '',
        'Show the pass when you board. See you soon! — {operator}',
      ]),
      ko: L([
        '좋은 아침입니다 {guest_name}님! ☀️',
        '',
        '오늘은 {tour_name} 투어일입니다. 패스 링크:',
        '{pass_link}',
        '',
        '📍 픽업: {pickup_point}',
        '🕗 시간: {pickup_time}',
        '',
        '탑승 시 패스를 보여주세요. 곧 뵙겠습니다! — {operator}',
      ]),
      zh: L([
        '早上好 {guest_name}! ☀️',
        '',
        '今天是您的 {tour_name} 行程日。您的通行证:',
        '{pass_link}',
        '',
        '📍 接送地点: {pickup_point}',
        '🕗 时间: {pickup_time}',
        '',
        '上车时请出示通行证。一会儿见! — {operator}',
      ]),
      'zh-TW': L([
        '早安 {guest_name}! ☀️',
        '',
        '今天是您的 {tour_name} 行程日。您的通行證:',
        '{pass_link}',
        '',
        '📍 接送地點: {pickup_point}',
        '🕗 時間: {pickup_time}',
        '',
        '上車時請出示通行證。待會見! — {operator}',
      ]),
      es: L([
        '¡Buenos días {guest_name}! ☀️',
        '',
        'Hoy es el día de su tour {tour_name}. Su pase:',
        '{pass_link}',
        '',
        '📍 Recogida: {pickup_point}',
        '🕗 Hora: {pickup_time}',
        '',
        'Muestre el pase al subir. ¡Hasta pronto! — {operator}',
      ]),
      ja: L([
        'おはようございます {guest_name} 様! ☀️',
        '',
        '本日は {tour_name} の日です。パスはこちら:',
        '{pass_link}',
        '',
        '📍 ピックアップ: {pickup_point}',
        '🕗 時間: {pickup_time}',
        '',
        'ご乗車の際にパスをご提示ください。それでは後ほど! — {operator}',
      ]),
    },
  },
  {
    key: 'thanks',
    label: '투어 종료 감사',
    timing: 'D+0',
    bodies: {
      en: L([
        'Hello {guest_name}, thank you for joining {tour_name} today! 🙏',
        '',
        'We hope you had a wonderful time in Korea.',
        'If you left anything in the vehicle or have any questions, just reply here.',
        '',
        'Safe travels! — {operator}',
      ]),
      ko: L([
        '{guest_name}님, 오늘 {tour_name}에 함께해 주셔서 감사합니다! 🙏',
        '',
        '한국에서 즐거운 시간이 되셨기를 바랍니다.',
        '차량에 두고 내리신 물건이나 궁금한 점이 있으면 이 메시지에 회신해 주세요.',
        '',
        '남은 여행도 안전하게! — {operator}',
      ]),
      zh: L([
        '{guest_name} 您好，感谢您今天参加 {tour_name}! 🙏',
        '',
        '希望您在韩国度过了愉快的时光。',
        '如有物品遗落在车上或任何疑问，请直接回复此消息。',
        '',
        '祝旅途平安! — {operator}',
      ]),
      'zh-TW': L([
        '{guest_name} 您好，感謝您今天參加 {tour_name}! 🙏',
        '',
        '希望您在韓國度過了愉快的時光。',
        '如有物品遺落在車上或任何疑問，請直接回覆此訊息。',
        '',
        '祝旅途平安! — {operator}',
      ]),
      es: L([
        'Hola {guest_name}, ¡gracias por acompañarnos hoy en {tour_name}! 🙏',
        '',
        'Esperamos que haya disfrutado su tiempo en Corea.',
        'Si olvidó algo en el vehículo o tiene alguna pregunta, responda aquí.',
        '',
        '¡Buen viaje! — {operator}',
      ]),
      ja: L([
        '{guest_name} 様、本日は {tour_name} にご参加いただきありがとうございました! 🙏',
        '',
        '韓国で素敵な時間をお過ごしいただけたなら幸いです。',
        'お忘れ物やご質問がございましたら、このメッセージにご返信ください。',
        '',
        '残りの旅も安全に! — {operator}',
      ]),
    },
  },
]

export function getPreset(key: string): WaPresetDefinition | null {
  return WA_PRESETS.find((p) => p.key === key) ?? null
}

/** Resolve the preset body for a guest locale — normalizes zh-TW vs zh, falls
 *  back to en for the 4-locale Phase 2.5 languages (fr/de/it/ru 등). */
export function presetBodyForLocale(preset: WaPresetDefinition, locale: string | null | undefined): string {
  const raw = (locale ?? 'en').trim()
  if (/^zh[-_]?tw$/i.test(raw) || /^zh[-_]hant/i.test(raw)) return preset.bodies['zh-TW']
  const two = raw.toLowerCase().slice(0, 2)
  if (two === 'zh') return preset.bodies.zh
  const hit = (WA_LOCALES as readonly string[]).includes(two) ? preset.bodies[two as WaLocale] : null
  return hit ?? preset.bodies.en
}
