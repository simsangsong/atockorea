// Loc-C translation table — bridges the 191-key gap.
//
// Keyed by canonical EN dot-path. Each value carries per-locale translations.
// `ko` is present only for the 13 keys also missing in Korean.
// Variables like {count}, {name}, {message} are preserved exactly.
//
// Tone references:
//   ja — desu/masu polite, kana for nouns, 「、」 standard punctuation
//   zh — concise simplified, 「，」 (chinese comma)
//   zh-TW — traditional chars; 依 vs 按, 設定 vs 设置, etc.
//   es — Latin Spanish, 2nd-person tú, matching existing "Tu reseña / Guarda" tone

const T = {
  // === appShell (universal) ===
  'appShell.backButton.label': {
    ko: '뒤로', ja: '戻る', zh: '返回', 'zh-TW': '返回', es: 'Atrás',
  },

  // === tourCard (universal) ===
  'tourCard.noItinerary': {
    ko: '일정 없음', ja: '行程なし', zh: '暂无行程', 'zh-TW': '尚無行程', es: 'Sin itinerario',
  },
  'tourCard.moreSpots': {
    ko: '+{count}곳 더', ja: '+{count} スポット', zh: '+{count} 个景点', 'zh-TW': '+{count} 個景點', es: '+{count} más',
  },
  'tourCard.duration': {
    ko: '소요 시간', ja: '所要時間', zh: '时长', 'zh-TW': '時長', es: 'Duración',
  },
  'tourCard.lunch': {
    ko: '점심', ja: '昼食', zh: '午餐', 'zh-TW': '午餐', es: 'Almuerzo',
  },
  'tourCard.tickets': {
    ko: '입장권', ja: 'チケット', zh: '门票', 'zh-TW': '門票', es: 'Entradas',
  },
  'tourCard.pickup': {
    ko: '픽업', ja: '送迎', zh: '接送', 'zh-TW': '接送', es: 'Recogida',
  },
  'tourCard.included': {
    ko: '포함', ja: '含む', zh: '包含', 'zh-TW': '包含', es: 'Incluido',
  },
  'tourCard.notIncluded': {
    ko: '미포함', ja: '含まない', zh: '不包含', 'zh-TW': '不包含', es: 'No incluido',
  },
  'tourCard.pickupPointsCountOne': {
    ko: '픽업 장소 {count}곳', ja: '送迎ポイント {count} 件', zh: '{count} 个接送点', 'zh-TW': '{count} 個接送點', es: '{count} punto de recogida',
  },
  'tourCard.pickupPointsCountOther': {
    ko: '픽업 장소 {count}곳', ja: '送迎ポイント {count} 件', zh: '{count} 个接送点', 'zh-TW': '{count} 個接送點', es: '{count} puntos de recogida',
  },
  'tourCard.hotelPickup': {
    ko: '호텔 픽업', ja: 'ホテル送迎', zh: '酒店接送', 'zh-TW': '飯店接送', es: 'Recogida en hotel',
  },
  'tourCard.cruiseTerminalPickup': {
    ko: '크루즈 터미널 픽업', ja: 'クルーズターミナル送迎', zh: '邮轮码头接送', 'zh-TW': '郵輪碼頭接送', es: 'Recogida en terminal de crucero',
  },

  // === toursList (ja/zh/zh-TW/es) ===
  'toursList.eyebrow': {
    ja: 'ツアー', zh: '行程', 'zh-TW': '行程', es: 'Tours',
  },
  'toursList.resultsCount': {
    ja: '{count} 件', zh: '{count} 个结果', 'zh-TW': '{count} 個結果', es: '{count} resultados',
  },
  'toursList.price': {
    ja: '価格', zh: '价格', 'zh-TW': '價格', es: 'Precio',
  },
  'toursList.priceFrom': {
    ja: '{amount} から', zh: '{amount} 起', 'zh-TW': '{amount} 起', es: 'Desde {amount}',
  },
  'toursList.priceUpTo': {
    ja: '{amount} まで', zh: '最高 {amount}', 'zh-TW': '最高 {amount}', es: 'Hasta {amount}',
  },
  'toursList.priceRange': {
    ja: '{min} – {max}', zh: '{min} – {max}', 'zh-TW': '{min} – {max}', es: '{min} – {max}',
  },
  'toursList.minPlaceholder': {
    ja: '最小', zh: '最小', 'zh-TW': '最小', es: 'Mín',
  },
  'toursList.maxPlaceholder': {
    ja: '最大', zh: '最大', 'zh-TW': '最大', es: 'Máx',
  },
  'toursList.apply': {
    ja: '適用', zh: '应用', 'zh-TW': '套用', es: 'Aplicar',
  },
  'toursList.reset': {
    ja: 'リセット', zh: '重置', 'zh-TW': '重設', es: 'Restablecer',
  },
  'toursList.resetFilters': {
    ja: 'フィルターをリセット', zh: '重置筛选', 'zh-TW': '重設篩選', es: 'Restablecer filtros',
  },
  'toursList.loadMore': {
    ja: 'もっと見る', zh: '加载更多', 'zh-TW': '載入更多', es: 'Cargar más',
  },
  'toursList.loadingMore': {
    ja: '読み込み中...', zh: '加载中...', 'zh-TW': '載入中...', es: 'Cargando más...',
  },
  'toursList.emptyTitle': {
    ja: 'この条件に合うツアーはありません。', zh: '没有符合条件的行程。', 'zh-TW': '沒有符合條件的行程。', es: 'Ningún tour coincide con estos filtros.',
  },
  'toursList.emptyHint': {
    ja: 'フィルターを外すか、リセットしてすべてのツアーをご覧ください。', zh: '请尝试移除筛选条件，或重置查看全部行程。', 'zh-TW': '請嘗試移除篩選條件，或重設查看全部行程。', es: 'Prueba a quitar un filtro, o restablece para ver todos los tours.',
  },
  'toursList.searchAriaLabel': {
    ja: 'ツアーを検索', zh: '搜索行程', 'zh-TW': '搜尋行程', es: 'Buscar tours',
  },
  'toursList.destinationAriaLabel': {
    ja: '目的地で絞り込む', zh: '按目的地筛选', 'zh-TW': '依目的地篩選', es: 'Filtrar por destino',
  },
  'toursList.sortAriaLabel': {
    ja: 'ツアーを並べ替え', zh: '排序行程', 'zh-TW': '排序行程', es: 'Ordenar tours',
  },
  'toursList.priceAriaLabel': {
    ja: '価格帯', zh: '价格区间', 'zh-TW': '價格區間', es: 'Rango de precio',
  },
  'toursList.popularHint': {
    ja: '評価・予約数・新着でキュレーション', zh: '依据评分、预订量与新鲜度精选', 'zh-TW': '依評分、預訂量與新鮮度精選', es: 'Seleccionado por valoración, reservas y novedad',
  },

  // === signup (ja/zh/zh-TW/es) ===
  'signup.accountGroupTitle': {
    ja: 'アカウント', zh: '账号', 'zh-TW': '帳號', es: 'Cuenta',
  },
  'signup.identityGroupTitle': {
    ja: '本人情報', zh: '身份信息', 'zh-TW': '身分資料', es: 'Identidad',
  },
  'signup.contactGroupTitle': {
    ja: '連絡先と同意', zh: '联系方式与同意', 'zh-TW': '聯絡方式與同意', es: 'Contacto y consentimiento',
  },

  // === mypage.dashboard (ja/zh/zh-TW/es) ===
  'mypage.dashboard.errorBanner': {
    ja: 'ダッシュボードの一部データを読み込めませんでした', zh: '部分仪表板数据加载失败', 'zh-TW': '部分儀表板資料載入失敗', es: 'No pudimos cargar parte de los datos de tu panel',
  },
  'mypage.dashboard.retry': {
    ja: '再試行', zh: '重试', 'zh-TW': '重試', es: 'Reintentar',
  },
  'mypage.dashboard.pendingReviewsTitle': {
    ja: '書きかけのレビュー', zh: '待写的评价', 'zh-TW': '待寫的評價', es: 'Reseñas pendientes',
  },
  'mypage.dashboard.pendingReviewsEmpty': {
    ja: '書くべきレビューはありません', zh: '暂无待写的评价', 'zh-TW': '暫無待寫的評價', es: 'No hay reseñas pendientes',
  },
  'mypage.dashboard.nextTripTitle': {
    ja: '次の旅', zh: '下一段旅程', 'zh-TW': '下一段旅程', es: 'Próximo viaje',
  },
  'mypage.dashboard.nextTripCta': {
    ja: '詳細を見る', zh: '查看详情', 'zh-TW': '查看詳情', es: 'Ver detalles',
  },
  'mypage.dashboard.nextTripEmpty': {
    ja: '今後のツアーはありません', zh: '暂无即将到来的行程', 'zh-TW': '暫無即將到來的行程', es: 'Sin tours próximos',
  },
  'mypage.dashboard.nextTripBrowse': {
    ja: 'ツアーを見る', zh: '浏览行程', 'zh-TW': '瀏覽行程', es: 'Explorar tours',
  },

  // === mypage.reviews.write (ja/zh/zh-TW/es) ===
  'mypage.reviews.write.title': {
    ja: 'レビューを書く', zh: '撰写评价', 'zh-TW': '撰寫評價', es: 'Escribir una reseña',
  },
  'mypage.reviews.write.subtitle': {
    ja: '{tour} のご体験を共有してください', zh: '分享你在 {tour} 的体验', 'zh-TW': '分享你在 {tour} 的體驗', es: 'Comparte tu experiencia con {tour}',
  },
  'mypage.reviews.write.ratingLabel': {
    ja: '評価', zh: '评分', 'zh-TW': '評分', es: 'Calificación',
  },
  'mypage.reviews.write.ratingRequired': {
    ja: '評価を選択してください', zh: '请选择评分', 'zh-TW': '請選擇評分', es: 'Selecciona una calificación',
  },
  'mypage.reviews.write.ratingSrLabel': {
    ja: '{value} 星', zh: '{value} 星', 'zh-TW': '{value} 星', es: '{value} estrellas',
  },
  'mypage.reviews.write.titleLabel': {
    ja: 'レビュータイトル（任意）', zh: '评价标题（可选）', 'zh-TW': '評價標題（選填）', es: 'Título de la reseña (opcional)',
  },
  'mypage.reviews.write.titlePlaceholder': {
    ja: 'タイトルを入力してください', zh: '为你的评价命名', 'zh-TW': '為你的評價命名', es: 'Pon un título a tu reseña',
  },
  'mypage.reviews.write.commentLabel': {
    ja: 'レビュー本文', zh: '你的评价', 'zh-TW': '你的評價', es: 'Tu reseña',
  },
  'mypage.reviews.write.commentPlaceholder': {
    ja: 'ご体験を共有してください...', zh: '分享你的体验...', 'zh-TW': '分享你的體驗...', es: 'Comparte tu experiencia...',
  },
  'mypage.reviews.write.commentRequired': {
    ja: 'レビューを入力してください', zh: '请填写评价内容', 'zh-TW': '請填寫評價內容', es: 'Por favor escribe una reseña',
  },
  'mypage.reviews.write.commentCount': {
    ja: '{count} 文字', zh: '{count} 字', 'zh-TW': '{count} 字', es: '{count} caracteres',
  },
  'mypage.reviews.write.photosLabel': {
    ja: '写真（任意）', zh: '照片（可选）', 'zh-TW': '照片（選填）', es: 'Fotos (opcional)',
  },
  'mypage.reviews.write.photosUploadFailed': {
    ja: '写真のアップロードに失敗しました', zh: '照片上传失败', 'zh-TW': '照片上傳失敗', es: 'No se pudieron subir las fotos',
  },
  'mypage.reviews.write.cancel': {
    ja: 'キャンセル', zh: '取消', 'zh-TW': '取消', es: 'Cancelar',
  },
  'mypage.reviews.write.submit': {
    ja: 'レビューを投稿', zh: '提交评价', 'zh-TW': '送出評價', es: 'Enviar reseña',
  },
  'mypage.reviews.write.submitting': {
    ja: '送信中...', zh: '提交中...', 'zh-TW': '送出中...', es: 'Enviando...',
  },
  'mypage.reviews.write.signInToUpload': {
    ja: '画像をアップロードするにはログインしてください', zh: '请登录后再上传图片', 'zh-TW': '請登入後再上傳圖片', es: 'Inicia sesión para subir imágenes',
  },
  'mypage.reviews.write.signInToSubmit': {
    ja: 'レビューを書くにはログインしてください', zh: '请登录后再撰写评价', 'zh-TW': '請登入後再撰寫評價', es: 'Inicia sesión para escribir una reseña',
  },
  'mypage.reviews.write.windowNotOpen': {
    ja: 'レビューはツアー当日の韓国時間 13:00 から書けます', zh: '评价于行程当日韩国时间 13:00 起开放', 'zh-TW': '評價於行程當日韓國時間 13:00 起開放', es: 'Las reseñas se abren a las 13:00 KST del día del tour',
  },
  'mypage.reviews.write.editTitle': {
    ja: 'レビューを編集', zh: '编辑评价', 'zh-TW': '編輯評價', es: 'Editar reseña',
  },
  'mypage.reviews.write.updateSubmit': {
    ja: 'レビューを更新', zh: '更新评价', 'zh-TW': '更新評價', es: 'Actualizar reseña',
  },
  'mypage.reviews.write.genericError': {
    ja: 'レビューを処理できませんでした', zh: '无法处理你的评价', 'zh-TW': '無法處理你的評價', es: 'No pudimos procesar tu reseña',
  },
  'mypage.reviews.cardEdit': {
    ja: '編集', zh: '编辑', 'zh-TW': '編輯', es: 'Editar',
  },
  'mypage.reviews.cardDelete': {
    ja: '削除', zh: '删除', 'zh-TW': '刪除', es: 'Eliminar',
  },
  'mypage.reviews.cardMenu': {
    ja: 'レビューメニューを開く', zh: '打开评价菜单', 'zh-TW': '開啟評價選單', es: 'Abrir menú de reseña',
  },
  'mypage.reviews.deleteConfirmTitle': {
    ja: 'このレビューを削除しますか？', zh: '删除这条评价？', 'zh-TW': '刪除這則評價？', es: '¿Eliminar esta reseña?',
  },
  'mypage.reviews.deleteConfirmDescription': {
    ja: 'この操作は取り消せません。', zh: '该操作无法撤销。', 'zh-TW': '此動作無法復原。', es: 'Esta acción no se puede deshacer.',
  },
  'mypage.reviews.deleteConfirmCta': {
    ja: '削除', zh: '删除', 'zh-TW': '刪除', es: 'Eliminar',
  },

  // === mypage.settings (ja/zh/zh-TW/es) ===
  'mypage.settings.savedBadge': {
    ja: '保存しました', zh: '已保存', 'zh-TW': '已儲存', es: 'Guardado',
  },
  'mypage.settings.connectedAccountsTitle': {
    ja: '連携アカウント', zh: '已绑定的账号', 'zh-TW': '已綁定的帳號', es: 'Cuentas conectadas',
  },
  'mypage.settings.connectedAccountsEmpty': {
    ja: '連携中の外部アカウントはありません', zh: '尚未绑定任何外部账号', 'zh-TW': '尚未綁定任何外部帳號', es: 'No hay cuentas externas conectadas',
  },
  'mypage.settings.dangerZoneTitle': {
    ja: '危険ゾーン', zh: '危险操作', 'zh-TW': '危險區域', es: 'Zona de peligro',
  },
  'mypage.settings.dangerZoneDescription': {
    ja: 'アカウント削除は近日対応予定です。お急ぎの場合はカスタマーサポートまでご連絡ください。', zh: '账号注销功能即将上线。如有紧急需求，请联系客服。', 'zh-TW': '帳號刪除功能即將上線。如有緊急需求，請聯絡客服。', es: 'La eliminación de cuenta llegará pronto. Para casos urgentes, contacta con atención al cliente.',
  },
  'mypage.settings.deleteAccount': {
    ja: 'アカウントを削除', zh: '注销账号', 'zh-TW': '刪除帳號', es: 'Eliminar cuenta',
  },
  'mypage.settings.avatarUploadLabel': {
    ja: 'プロフィール写真を変更', zh: '更换头像', 'zh-TW': '更換頭像', es: 'Cambiar foto de perfil',
  },
  'mypage.settings.avatarRemove': {
    ja: 'デフォルト画像を使う', zh: '使用默认头像', 'zh-TW': '使用預設頭像', es: 'Usar imagen predeterminada',
  },

  // === mypage.* (top-level booking flow, ja/zh/zh-TW/es) ===
  'mypage.bookingsPageSubtitle': {
    ja: 'すべての予約をまとめて管理できます', zh: '一处管理你的全部预订', 'zh-TW': '一處管理你的全部預訂', es: 'Gestiona todas tus reservas en un solo lugar',
  },
  'mypage.bookingsSectionUpcoming': {
    ja: '今後のツアー', zh: '即将到来的行程', 'zh-TW': '即將到來的行程', es: 'Tours próximos',
  },
  'mypage.bookingsSectionCompleted': {
    ja: '完了したツアー', zh: '已完成的行程', 'zh-TW': '已完成的行程', es: 'Tours completados',
  },
  'mypage.bookingsSectionCancelled': {
    ja: 'キャンセル済みのツアー', zh: '已取消的行程', 'zh-TW': '已取消的行程', es: 'Tours cancelados',
  },
  'mypage.bookingsEmpty': {
    ja: '予約はありません', zh: '暂无预订', 'zh-TW': '暫無預訂', es: 'No hay reservas',
  },
  'mypage.bookingsLoading': {
    ja: '予約を読み込み中...', zh: '正在加载预订...', 'zh-TW': '正在載入預訂...', es: 'Cargando reservas...',
  },
  'mypage.bookingsError': {
    ja: 'エラー：{message}', zh: '错误：{message}', 'zh-TW': '錯誤：{message}', es: 'Error: {message}',
  },
  'mypage.cancelBookingCta': {
    ja: '予約をキャンセル', zh: '取消预订', 'zh-TW': '取消預訂', es: 'Cancelar reserva',
  },
  'mypage.writeReviewCta': {
    ja: 'レビューを書く', zh: '撰写评价', 'zh-TW': '撰寫評價', es: 'Escribir reseña',
  },
  'mypage.cancelNotAllowed24h': {
    ja: 'ツアー出発の 24 時間以内はキャンセルできません。カスタマーサポートまでご連絡ください。', zh: '行程开始前 24 小时内无法取消。请联系客服处理。', 'zh-TW': '行程開始前 24 小時內無法取消。請聯絡客服處理。', es: 'No se permite la cancelación en las 24 horas previas al tour. Contacta con atención al cliente.',
  },
  'mypage.confirmCancelBooking': {
    ja: 'この予約をキャンセルしますか？', zh: '确定要取消该预订吗？', 'zh-TW': '確定要取消這筆預訂嗎？', es: '¿Seguro que quieres cancelar esta reserva?',
  },
  'mypage.cancelSuccess': {
    ja: '予約をキャンセルしました', zh: '已成功取消预订', 'zh-TW': '已成功取消預訂', es: 'Reserva cancelada correctamente',
  },
  'mypage.cancelFailed': {
    ja: '予約のキャンセルに失敗しました：{message}', zh: '取消预订失败：{message}', 'zh-TW': '取消預訂失敗：{message}', es: 'No se pudo cancelar la reserva: {message}',
  },
  'mypage.signInToCancel': {
    ja: '予約をキャンセルするにはログインしてください', zh: '请登录后再取消预订', 'zh-TW': '請登入後再取消預訂', es: 'Inicia sesión para cancelar reservas',
  },
  'mypage.upcomingPageSubtitle': {
    ja: '今後の予約を管理できます', zh: '管理你即将到来的预订', 'zh-TW': '管理你即將到來的預訂', es: 'Gestiona tus próximas reservas',
  },
  'mypage.upcomingEmpty': {
    ja: '今後のツアーはありません', zh: '暂无即将到来的行程', 'zh-TW': '暫無即將到來的行程', es: 'Sin tours próximos',
  },
  'mypage.upcomingPickupTba': {
    ja: '未定', zh: '待定', 'zh-TW': '待定', es: 'Por confirmar',
  },
  'mypage.historyPageTitle': {
    ja: '予約履歴', zh: '预订历史', 'zh-TW': '預訂歷史', es: 'Historial de reservas',
  },
  'mypage.historyPageSubtitle': {
    ja: '過去の予約を確認できます', zh: '查看过往的预订记录', 'zh-TW': '查看過往的預訂紀錄', es: 'Consulta tus reservas pasadas',
  },
  'mypage.historyEmpty': {
    ja: '予約履歴はありません', zh: '暂无预订记录', 'zh-TW': '暫無預訂紀錄', es: 'No hay historial de reservas',
  },
  'mypage.historyStatusCompleted': {
    ja: '完了', zh: '已完成', 'zh-TW': '已完成', es: 'Completado',
  },
  'mypage.historyStatusCancelled': {
    ja: 'キャンセル済み', zh: '已取消', 'zh-TW': '已取消', es: 'Cancelado',
  },
  'mypage.historyRebookCta': {
    ja: 'もう一度予約', zh: '再次预订', 'zh-TW': '再次預訂', es: 'Reservar de nuevo',
  },
  'mypage.reviewsPageTitle': {
    ja: 'マイレビュー', zh: '我的评价', 'zh-TW': '我的評價', es: 'Mis reseñas',
  },
  'mypage.reviewsPageSubtitle': {
    ja: '完了したご予約から新しいレビューを書けます。投稿済みのレビューは以下に表示され、編集や削除はできません。', zh: '可从已完成的预订撰写新评价。已发布的评价显示在下方，无法编辑或删除。', 'zh-TW': '可從已完成的預訂撰寫新評價。已發布的評價顯示在下方，無法編輯或刪除。', es: 'Puedes escribir nuevas reseñas desde tus reservas completadas. Las reseñas existentes se muestran abajo y no pueden editarse ni eliminarse.',
  },
  'mypage.reviewsSectionTitle': {
    ja: '投稿したレビュー', zh: '你的评价', 'zh-TW': '你的評價', es: 'Tus reseñas',
  },
  'mypage.reviewsEmpty': {
    ja: 'まだレビューを書いていません。', zh: '你还没有写过评价。', 'zh-TW': '你還沒有寫過評價。', es: 'Aún no has escrito ninguna reseña.',
  },
  'mypage.reviewsLoading': {
    ja: '読み込み中...', zh: '加载中...', 'zh-TW': '載入中...', es: 'Cargando...',
  },
  'mypage.wishlistPageTitle': {
    ja: 'マイウィッシュリスト', zh: '我的心愿单', 'zh-TW': '我的願望清單', es: 'Mi lista de deseos',
  },
  'mypage.wishlistCountOne': {
    ja: '{count} 件のツアーを保存中', zh: '已保存 {count} 个行程', 'zh-TW': '已儲存 {count} 個行程', es: '{count} tour guardado',
  },
  'mypage.wishlistCountMany': {
    ja: '{count} 件のツアーを保存中', zh: '已保存 {count} 个行程', 'zh-TW': '已儲存 {count} 個行程', es: '{count} tours guardados',
  },
  'mypage.wishlistLoading': {
    ja: 'ウィッシュリストを読み込み中...', zh: '正在加载心愿单...', 'zh-TW': '正在載入願望清單...', es: 'Cargando lista de deseos...',
  },
  'mypage.wishlistRemoveConfirm': {
    ja: 'このツアーをウィッシュリストから外しますか？', zh: '从心愿单中移除该行程？', 'zh-TW': '從願望清單中移除這個行程？', es: '¿Quitar este tour de la lista de deseos?',
  },
  'mypage.wishlistRemoveFailed': {
    ja: 'ウィッシュリストから削除できませんでした：{message}', zh: '从心愿单移除失败：{message}', 'zh-TW': '從願望清單移除失敗：{message}', es: 'No se pudo eliminar de la lista de deseos: {message}',
  },
  'mypage.wishlistSignInRequired': {
    ja: 'ウィッシュリストを管理するにはログインしてください', zh: '请登录后再管理心愿单', 'zh-TW': '請登入後再管理願望清單', es: 'Inicia sesión para gestionar la lista de deseos',
  },
  'mypage.commonRetry': {
    ja: '再試行', zh: '重试', 'zh-TW': '重試', es: 'Reintentar',
  },
  'mypage.commonViewDetails': {
    ja: '詳細を見る', zh: '查看详情', 'zh-TW': '查看詳情', es: 'Ver detalles',
  },

  // === mypage.common.* (ja/zh/zh-TW/es) ===
  'mypage.common.verifyingSession': {
    ja: 'セッションを確認中...', zh: '正在验证你的登录...', 'zh-TW': '正在驗證你的登入...', es: 'Verificando tu sesión...',
  },
  'mypage.common.confirm.cancelBookingTitle': {
    ja: 'この予約をキャンセルしますか？', zh: '取消该预订？', 'zh-TW': '取消這筆預訂？', es: '¿Cancelar esta reserva?',
  },
  'mypage.common.confirm.cancelBookingDescription': {
    ja: 'キャンセルすると予約はその場で終了し、適用される規定に従って払い戻されます。', zh: '取消后预订立即结束。如有退款，按适用政策处理。', 'zh-TW': '取消後預訂立即結束。如有退款，依適用政策處理。', es: 'Al cancelar, la reserva se cierra de inmediato. Los reembolsos, si los hay, siguen la política aplicable.',
  },
  'mypage.common.confirm.cancelBookingConfirm': {
    ja: '予約をキャンセル', zh: '取消预订', 'zh-TW': '取消預訂', es: 'Cancelar reserva',
  },
  'mypage.common.confirm.cancel': {
    ja: '閉じる', zh: '关闭', 'zh-TW': '關閉', es: 'Descartar',
  },
  'mypage.common.confirm.removeWishlistTitle': {
    ja: 'ウィッシュリストから外しますか？', zh: '从心愿单移除？', 'zh-TW': '從願望清單移除？', es: '¿Quitar de la lista de deseos?',
  },
  'mypage.common.confirm.removeWishlistDescription': {
    ja: 'いつでも再追加できます。', zh: '随时可以再加回来。', 'zh-TW': '隨時可以再加回來。', es: 'Siempre puedes volver a añadirlo.',
  },
  'mypage.common.confirm.removeWishlistConfirm': {
    ja: '削除', zh: '移除', 'zh-TW': '移除', es: 'Quitar',
  },
  'mypage.common.confirm.signOutTitle': {
    ja: 'ログアウトしますか？', zh: '退出登录？', 'zh-TW': '登出？', es: '¿Cerrar sesión?',
  },
  'mypage.common.confirm.signOutDescription': {
    ja: '予約を確認するには再度ログインが必要です。', zh: '需要重新登录才能查看预订。', 'zh-TW': '需要重新登入才能查看預訂。', es: 'Tendrás que volver a iniciar sesión para ver tus reservas.',
  },
  'mypage.common.confirm.signOutConfirm': {
    ja: 'ログアウト', zh: '退出登录', 'zh-TW': '登出', es: 'Cerrar sesión',
  },
  'mypage.common.toast.bookingCancelled': {
    ja: '予約をキャンセルしました', zh: '预订已取消', 'zh-TW': '預訂已取消', es: 'Reserva cancelada',
  },
  'mypage.common.toast.bookingCancelFailed': {
    ja: '予約のキャンセルに失敗しました', zh: '取消预订失败', 'zh-TW': '取消預訂失敗', es: 'No se pudo cancelar la reserva',
  },
  'mypage.common.toast.bookingCancelNotAllowed24h': {
    ja: 'ツアー出発の 24 時間以内はキャンセルできません', zh: '行程开始前 24 小时内无法取消', 'zh-TW': '行程開始前 24 小時內無法取消', es: 'No se permite la cancelación en las 24 horas previas al tour',
  },
  'mypage.common.toast.signInRequired': {
    ja: '続行するにはログインしてください', zh: '请登录后继续', 'zh-TW': '請登入後繼續', es: 'Inicia sesión para continuar',
  },
  'mypage.common.toast.wishlistRemoved': {
    ja: 'ウィッシュリストから削除しました', zh: '已从心愿单移除', 'zh-TW': '已從願望清單移除', es: 'Quitado de la lista de deseos',
  },
  'mypage.common.toast.wishlistRemoveFailed': {
    ja: 'ウィッシュリストから削除できませんでした', zh: '从心愿单移除失败', 'zh-TW': '從願望清單移除失敗', es: 'No se pudo eliminar de la lista de deseos',
  },
  'mypage.common.toast.saved': {
    ja: '保存しました', zh: '已保存', 'zh-TW': '已儲存', es: 'Guardado',
  },
  'mypage.common.toast.saveFailed': {
    ja: '保存に失敗しました', zh: '保存失败', 'zh-TW': '儲存失敗', es: 'No se pudo guardar',
  },
  'mypage.common.toast.reviewSubmitted': {
    ja: 'レビューを投稿しました', zh: '评价已提交', 'zh-TW': '評價已送出', es: 'Reseña enviada',
  },
  'mypage.common.toast.reviewUpdated': {
    ja: 'レビューを更新しました', zh: '评价已更新', 'zh-TW': '評價已更新', es: 'Reseña actualizada',
  },
  'mypage.common.toast.reviewDeleted': {
    ja: 'レビューを削除しました', zh: '评价已删除', 'zh-TW': '評價已刪除', es: 'Reseña eliminada',
  },
  'mypage.common.toast.reviewFailed': {
    ja: 'レビューエラー：{message}', zh: '评价错误：{message}', 'zh-TW': '評價錯誤：{message}', es: 'Error de reseña: {message}',
  },
  'mypage.common.toast.reviewWindowNotOpen': {
    ja: 'レビューはツアー当日の韓国時間 13:00 から書けます', zh: '评价于行程当日韩国时间 13:00 起开放', 'zh-TW': '評價於行程當日韓國時間 13:00 起開放', es: 'Las reseñas se pueden escribir desde las 13:00 KST del día del tour',
  },
  'mypage.common.toast.comingSoon': {
    ja: '近日公開', zh: '即将推出', 'zh-TW': '即將推出', es: 'Próximamente',
  },
  'mypage.common.toast.avatarUpdated': {
    ja: 'プロフィール写真を更新しました', zh: '头像已更新', 'zh-TW': '頭像已更新', es: 'Foto de perfil actualizada',
  },
  'mypage.common.toast.avatarUploadFailed': {
    ja: 'プロフィール写真のアップロードに失敗しました', zh: '头像上传失败', 'zh-TW': '頭像上傳失敗', es: 'No se pudo subir la foto de perfil',
  },
  'mypage.common.percentOff': {
    ja: '{value}% OFF', zh: '{value}% 折扣', 'zh-TW': '{value}% 折扣', es: '{value}% de descuento',
  },
  'mypage.common.loadingLabel': {
    ja: '読み込み中...', zh: '加载中...', 'zh-TW': '載入中...', es: 'Cargando...',
  },
  'mypage.common.errorLoad': {
    ja: 'このコンテンツを読み込めませんでした', zh: '无法加载此内容', 'zh-TW': '無法載入此內容', es: 'No pudimos cargar este contenido',
  },

  // === mypage.bookings.* (ja/zh/zh-TW/es) ===
  'mypage.bookings.guestsLabel': {
    ja: 'ご利用人数', zh: '人数', 'zh-TW': '人數', es: 'Personas',
  },
  'mypage.bookings.receiptCta': {
    ja: '領収書を見る', zh: '查看收据', 'zh-TW': '查看收據', es: 'Ver recibo',
  },
  'mypage.bookings.addToCalendar': {
    ja: 'カレンダーに追加', zh: '加入日历', 'zh-TW': '加入行事曆', es: 'Añadir al calendario',
  },
  'mypage.bookings.dayCountdownToday': {
    ja: '本日', zh: '今天', 'zh-TW': '今天', es: 'Hoy',
  },
  'mypage.bookings.dayCountdownTomorrow': {
    ja: '明日', zh: '明天', 'zh-TW': '明天', es: 'Mañana',
  },
  'mypage.bookings.dayCountdownPast': {
    ja: '過去', zh: '已过', 'zh-TW': '已過', es: 'Pasado',
  },
  'mypage.bookings.dayCountdownFuture': {
    ja: 'あと {days} 日', zh: '还剩 {days} 天', 'zh-TW': '還剩 {days} 天', es: 'D-{days}',
  },

  // === mypage.landing.* (ja/zh/zh-TW/es) ===
  'mypage.landing.greetingMorning': {
    ja: 'おはようございます、{name} さん', zh: '早安，{name}', 'zh-TW': '早安，{name}', es: 'Buenos días, {name}',
  },
  'mypage.landing.greetingAfternoon': {
    ja: 'こんにちは、{name} さん', zh: '午安，{name}', 'zh-TW': '午安，{name}', es: 'Buenas tardes, {name}',
  },
  'mypage.landing.greetingEvening': {
    ja: 'こんばんは、{name} さん', zh: '晚上好，{name}', 'zh-TW': '晚安，{name}', es: 'Buenas noches, {name}',
  },
  'mypage.landing.subtitle': {
    ja: 'AtoCKorea のすべてを一目で', zh: '一眼掌握你的 AtoCKorea', 'zh-TW': '一眼掌握你的 AtoCKorea', es: 'Tu centro de AtoCKorea en un vistazo',
  },
  'mypage.landing.viewDashboard': {
    ja: 'ダッシュボードを見る', zh: '查看仪表板', 'zh-TW': '查看儀表板', es: 'Ver panel',
  },
  'mypage.landing.errorBanner': {
    ja: 'データの一部を読み込めませんでした', zh: '部分数据加载失败', 'zh-TW': '部分資料載入失敗', es: 'No pudimos cargar parte de tus datos',
  },
  'mypage.landing.retry': {
    ja: '再試行', zh: '重试', 'zh-TW': '重試', es: 'Reintentar',
  },
  'mypage.landing.profile.ringLabel': {
    ja: 'プロフィール', zh: '个人资料', 'zh-TW': '個人資料', es: 'Perfil',
  },
  'mypage.landing.profile.completeCta': {
    ja: 'プロフィールを完成 · {pct}%', zh: '完成个人资料 · {pct}%', 'zh-TW': '完成個人資料 · {pct}%', es: 'Completa tu perfil · {pct}%',
  },
  'mypage.landing.profile.completeBadge': {
    ja: 'プロフィール完成', zh: '资料已完成', 'zh-TW': '資料已完成', es: 'Perfil completo',
  },
  'mypage.landing.nextTrip.badgeLabel': {
    ja: '次の旅', zh: '你的下一段旅程', 'zh-TW': '你的下一段旅程', es: 'Tu próximo viaje',
  },
  'mypage.landing.nextTrip.pickupLabel': {
    ja: '送迎', zh: '接送', 'zh-TW': '接送', es: 'Recogida',
  },
  'mypage.landing.nextTrip.pickupTba': {
    ja: '未定', zh: '待定', 'zh-TW': '待定', es: 'Por confirmar',
  },
  'mypage.landing.nextTrip.guests': {
    ja: '{count} 名', zh: '{count} 位', 'zh-TW': '{count} 位', es: '{count} personas',
  },
  'mypage.landing.nextTrip.viewDetails': {
    ja: '詳細を見る', zh: '查看详情', 'zh-TW': '查看詳情', es: 'Ver detalles',
  },
  'mypage.landing.nextTrip.addToCalendar': {
    ja: 'カレンダーに追加', zh: '加入日历', 'zh-TW': '加入行事曆', es: 'Añadir al calendario',
  },
  'mypage.landing.nextTrip.receipt': {
    ja: '領収書を開く', zh: '打开收据', 'zh-TW': '開啟收據', es: 'Abrir recibo',
  },
  'mypage.landing.emptyHero.title': {
    ja: 'まだ予定の旅行はありません', zh: '尚无即将到来的行程', 'zh-TW': '尚無即將到來的行程', es: 'Aún no tienes próximos viajes',
  },
  'mypage.landing.emptyHero.subtitle': {
    ja: 'キュレーション済みの済州ツアーから、最初の旅を計画しましょう。', zh: '浏览精选的济州体验，规划你的第一段旅程。', 'zh-TW': '瀏覽精選的濟州體驗，規劃你的第一段旅程。', es: 'Descubre experiencias seleccionadas en Jeju y planea tu primer viaje.',
  },
  'mypage.landing.emptyHero.cta': {
    ja: '済州ツアーを見る', zh: '探索济州行程', 'zh-TW': '探索濟州行程', es: 'Explorar tours de Jeju',
  },
  'mypage.landing.quickAccess.title': {
    ja: 'クイックアクセス', zh: '快捷入口', 'zh-TW': '快速入口', es: 'Acceso rápido',
  },
  'mypage.landing.quickAccess.count': {
    ja: '{count} 件', zh: '{count} 项', 'zh-TW': '{count} 項', es: '{count} elementos',
  },
  'mypage.landing.quickAccess.view': {
    ja: '見る', zh: '查看', 'zh-TW': '查看', es: 'Ver',
  },
  'mypage.landing.quickAccess.items.bookings': {
    ja: 'マイ予約', zh: '我的预订', 'zh-TW': '我的預訂', es: 'Mis reservas',
  },
  'mypage.landing.quickAccess.items.upcoming': {
    ja: '今後の予定', zh: '即将到来', 'zh-TW': '即將到來', es: 'Próximos',
  },
  'mypage.landing.quickAccess.items.history': {
    ja: '履歴', zh: '历史记录', 'zh-TW': '歷史紀錄', es: 'Historial',
  },
  'mypage.landing.quickAccess.items.reviews': {
    ja: 'レビュー', zh: '评价', 'zh-TW': '評價', es: 'Reseñas',
  },
  'mypage.landing.quickAccess.items.wishlist': {
    ja: 'ウィッシュリスト', zh: '心愿单', 'zh-TW': '願望清單', es: 'Lista de deseos',
  },
  'mypage.landing.quickAccess.items.settings': {
    ja: '設定', zh: '设置', 'zh-TW': '設定', es: 'Configuración',
  },
  'mypage.landing.pendingReview.title': {
    ja: '{title} の感想を共有しませんか', zh: '分享一下你对 {title} 的感受', 'zh-TW': '分享一下你對 {title} 的感受', es: 'Comparte qué te pareció {title}',
  },
  'mypage.landing.pendingReview.cta': {
    ja: 'レビューを書く', zh: '撰写评价', 'zh-TW': '撰寫評價', es: 'Escribir reseña',
  },
  'mypage.landing.pendingReview.more': {
    ja: 'ほか {count} 件待機中', zh: '还有 {count} 条待写', 'zh-TW': '還有 {count} 則待寫', es: '+{count} más pendientes',
  },
  'mypage.landing.wishlist.sectionTitle': {
    ja: '保存したツアー', zh: '已保存的行程', 'zh-TW': '已儲存的行程', es: 'Tours guardados',
  },
  'mypage.landing.wishlist.viewAll': {
    ja: 'すべて見る（{count}）', zh: '查看全部（{count}）', 'zh-TW': '查看全部（{count}）', es: 'Ver todo ({count})',
  },
  'mypage.landing.recommendations.title': {
    ja: 'あなたへのおすすめ', zh: '为你推荐', 'zh-TW': '為你推薦', es: 'Recomendados para ti',
  },
  'mypage.landing.recommendations.subtitle': {
    ja: 'あなたに合わせて選んだ高評価ツアー', zh: '精选高分行程，特别为你', 'zh-TW': '精選高分行程，特別為你', es: 'Tours mejor valorados elegidos para ti',
  },
  'mypage.landing.recommendations.empty': {
    ja: 'まだおすすめはありません', zh: '暂无推荐', 'zh-TW': '暫無推薦', es: 'Aún no hay recomendaciones',
  },
};

export default T;

// Orphan keys to delete (already-present-but-not-in-EN strings).
// Confirmed via grep: none of these are referenced by application code.
export const ORPHANS_TO_DELETE = {
  ko: ['home.customJoinTour.verifySuccessKo'],
  ja: ['mypage.dashboard', 'mypage.reviews', 'mypage.settings'],
  zh: ['mypage.dashboard', 'mypage.reviews', 'mypage.settings'],
  'zh-TW': ['mypage.dashboard', 'mypage.reviews', 'mypage.settings'],
  es: ['mypage.dashboard', 'mypage.reviews', 'mypage.settings'],
};
