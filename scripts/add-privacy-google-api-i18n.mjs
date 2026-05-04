// Inject `privacy.googleApi.*` keys into all 6 locale message files.
// These render the dedicated Google API Services User Data Policy disclosures
// required by Google OAuth verification (Data Accessed / Usage / Sharing /
// Storage / Retention).

import { readFileSync, writeFileSync } from "node:fs";

const TRANSLATIONS = {
  en: {
    title: "15. Google API Services User Data — Specific Disclosures",
    intro:
      'This section describes how our application accesses, uses, stores, and protects information received from Google APIs when you choose to sign in with Google. AtoC\'s use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.',
    s1: {
      title: "15.1 Data Accessed",
      p1: "We request only the minimum scopes required to operate the sign-in feature:",
      li1: "openid — to authenticate the user via Google's OpenID Connect.",
      li2: "profile — to read your name, profile picture URL, and locale, used to personalize your account.",
      li3: "email — to read your primary email address, used as the unique identifier of your account and for transactional booking communication.",
      p2: "We do NOT request access to Gmail content, Google Calendar, Google Drive, Google Contacts, Google Photos, YouTube, or any other restricted scope. We do not request offline access or refresh tokens beyond the active session.",
    },
    s2: {
      title: "15.2 How We Use Google User Data",
      p1: "Google user data is used solely to operate user-facing features you have requested:",
      li1: "To create and authenticate your AtoC Korea account (a single AtoC account is keyed to the Google email address you sign in with).",
      li2: "To pre-fill your name and profile photo on your account page so you can recognize the signed-in identity.",
      li3: "To send transactional booking communications (booking confirmation, pickup time, cancellation receipt) to the email address provided by Google.",
      li4: "To detect duplicate accounts and to support customer-service requests you initiate.",
      p2: "We do NOT use Google user data for advertising, do not sell or rent it, do not transfer it to third parties for advertising, and do not use it to train, evaluate, or improve generalized AI / ML models. Human review of Google user data is limited to (a) explicit user consent, (b) security investigations, (c) legal compliance, or (d) as needed to provide a user-facing feature you requested. These uses comply with the Google API Services User Data Policy, including the Limited Use requirements.",
    },
    s3: {
      title: "15.3 How We Share Google User Data",
      li1: "Service providers (sub-processors). We share the minimum data needed with the following processors operating on our behalf under contractual data-protection obligations: Supabase, Inc. (managed PostgreSQL hosting and authentication), Vercel Inc. (web hosting), Stripe, Inc. (payments), Resend, Inc. or comparable transactional-email providers (delivery of booking emails). Each processor only receives the fields required for its function.",
      li2: "No sale, no advertising sharing. We do not sell Google user data and do not share it with advertisers, ad networks, data brokers, or analytics providers that use it for cross-context behavioral advertising.",
      li3: "Legal disclosure. We may disclose Google user data when required by law, valid legal process (subpoena, court order), or to protect the rights, safety, or property of AtoC, our users, or the public.",
      li4: "Corporate transactions. If we are involved in a merger, acquisition, financing, or asset sale, Google user data may be transferred subject to the acquirer's commitment to honor this Privacy Policy.",
    },
    s4: {
      title: "15.4 Storage and Protection",
      li1: "Account records (including the email and profile fields received from Google) are stored in encrypted PostgreSQL databases managed by Supabase, hosted in the Asia-Pacific region (Seoul / Singapore) with daily automated backups.",
      li2: "Data in transit is protected with TLS 1.2 or higher. Data at rest is encrypted at the disk-volume level (AES-256). Access to production data is restricted to a small number of named engineers under role-based access control with audit logging.",
      li3: "Authentication tokens issued by Google are kept only for the duration of your active session and are revoked when you sign out, change your password, or delete your account. We do not persist long-lived Google OAuth refresh tokens.",
      li4: "Database row-level security policies prevent any user from reading another user's personal data. Application secrets and API keys are stored in encrypted environment variables, never in code or version control.",
      li5: "We perform regular security reviews, dependency vulnerability scans, and incident-response drills. We will notify affected users and the relevant data-protection authority of any qualifying personal-data breach within 72 hours of becoming aware, as required by applicable law.",
    },
    s5: {
      title: "15.5 Retention and Deletion",
      li1: "Active accounts. We retain your account data (including the Google email and profile fields) for as long as your account is active.",
      li2: "Inactive accounts. Accounts with no sign-in activity for 24 consecutive months are automatically scheduled for deletion after a 30-day grace-period notice sent to the email on file.",
      li3: "Booking records. Confirmed booking records are retained for 5 years from the tour date to comply with Korean commercial-law and tax recordkeeping obligations, after which they are permanently deleted or irreversibly anonymized.",
      li4: "User-initiated deletion. You may delete your account and the associated Google user data at any time from My Page → Settings → Delete Account, or by emailing",
      li5: "Revoking Google access. You may also revoke our application's access to your Google account at any time at",
    },
  },

  ko: {
    title: "15. Google API 서비스 사용자 데이터 — 별도 고지",
    intro:
      "본 섹션은 사용자가 Google 계정으로 로그인하는 경우, 본 애플리케이션이 Google API로부터 수신한 정보를 어떻게 접근·사용·저장·보호하는지를 설명합니다. AtoC는 Google API로부터 수신한 정보의 사용에 있어 Google API 서비스 사용자 데이터 정책을 준수하며, 이는 Limited Use 요건을 포함합니다.",
    s1: {
      title: "15.1 접근하는 데이터",
      p1: "로그인 기능 운영에 필요한 최소 스코프만 요청합니다:",
      li1: "openid — Google OpenID Connect를 통한 사용자 인증.",
      li2: "profile — 계정 개인화에 사용되는 이름, 프로필 사진 URL, 로케일.",
      li3: "email — 계정 고유 식별자 및 예약 관련 거래 이메일 발송에 사용되는 기본 이메일 주소.",
      p2: "Gmail 콘텐츠, Google 캘린더, Google 드라이브, Google 연락처, Google 포토, YouTube 또는 기타 제한 스코프에는 접근하지 않습니다. 활성 세션 이외의 오프라인 접근 또는 refresh token도 요청하지 않습니다.",
    },
    s2: {
      title: "15.2 Google 사용자 데이터의 사용 방법",
      p1: "Google 사용자 데이터는 사용자가 요청한 기능을 운영하기 위해서만 사용됩니다:",
      li1: "AtoC Korea 계정 생성 및 인증 (단일 AtoC 계정은 로그인하신 Google 이메일에 연결됨).",
      li2: "계정 페이지에서 로그인된 신원을 인식할 수 있도록 이름·프로필 사진 사전 채움.",
      li3: "Google이 제공한 이메일 주소로 예약 거래 통신(예약 확인, 픽업 시간, 취소 영수증) 발송.",
      li4: "중복 계정 감지 및 사용자가 직접 시작한 고객 서비스 요청 처리.",
      p2: "Google 사용자 데이터는 광고 목적으로 사용되지 않으며, 판매·임대·광고를 위한 제3자 제공도 일체 없으며, 일반화된 AI/ML 모델 학습·평가·개선에 사용되지 않습니다. Google 사용자 데이터에 대한 사람의 검토는 (a) 사용자의 명시적 동의, (b) 보안 조사, (c) 법적 준수, 또는 (d) 사용자가 요청한 기능 제공에 필요한 경우로 제한됩니다. 이러한 사용은 Limited Use 요건을 포함한 Google API 서비스 사용자 데이터 정책을 준수합니다.",
    },
    s3: {
      title: "15.3 Google 사용자 데이터의 공유",
      li1: "서비스 제공자(하위처리자). 계약상 데이터 보호 의무 하에 당사를 대신해 운영하는 다음 처리자에게만 필요한 최소 데이터를 공유합니다: Supabase, Inc.(매니지드 PostgreSQL 호스팅 및 인증), Vercel Inc.(웹 호스팅), Stripe, Inc.(결제), Resend, Inc. 또는 동급 트랜잭션 이메일 제공업체(예약 이메일 발송). 각 처리자는 해당 기능에 필요한 필드만 수신합니다.",
      li2: "판매 없음, 광고 공유 없음. Google 사용자 데이터를 판매하지 않으며, 광고주, 광고 네트워크, 데이터 브로커, 또는 교차 맥락 행태 광고에 사용하는 분석 제공업체와 공유하지 않습니다.",
      li3: "법적 공개. 법률, 유효한 법적 절차(소환장, 법원 명령) 또는 AtoC, 사용자, 또는 공중의 권리·안전·재산을 보호하기 위해 필요한 경우 Google 사용자 데이터를 공개할 수 있습니다.",
      li4: "기업 거래. 합병, 인수, 자금 조달, 자산 매각에 관여하는 경우, 인수자가 본 개인정보처리방침을 준수한다는 약속을 조건으로 Google 사용자 데이터가 이전될 수 있습니다.",
    },
    s4: {
      title: "15.4 저장 및 보호",
      li1: "Google에서 수신한 이메일 및 프로필 필드를 포함한 계정 기록은 Supabase가 관리하는 암호화된 PostgreSQL 데이터베이스에 저장되며, 아시아-태평양 리전(서울/싱가포르)에서 호스팅되고 일일 자동 백업이 수행됩니다.",
      li2: "전송 중 데이터는 TLS 1.2 이상으로 보호됩니다. 저장 데이터는 디스크 볼륨 수준에서 암호화(AES-256)됩니다. 운영 데이터에 대한 접근은 역할 기반 접근 제어와 감사 로깅 하에 소수의 지정된 엔지니어로 제한됩니다.",
      li3: "Google이 발급한 인증 토큰은 활성 세션 동안만 보관되며, 로그아웃, 비밀번호 변경, 계정 삭제 시 폐기됩니다. 장기 Google OAuth refresh token은 보관하지 않습니다.",
      li4: "데이터베이스 행 수준 보안 정책으로 어떤 사용자도 다른 사용자의 개인 데이터를 읽을 수 없습니다. 애플리케이션 시크릿 및 API 키는 코드나 버전 관리가 아닌 암호화된 환경 변수에 저장됩니다.",
      li5: "정기적 보안 검토, 의존성 취약점 스캔, 사고 대응 훈련을 수행합니다. 적용 가능한 법률에 따라 자격 있는 개인정보 침해 발생 인지 후 72시간 이내에 영향받은 사용자 및 관련 개인정보 보호 당국에 통지합니다.",
    },
    s5: {
      title: "15.5 보관 및 삭제",
      li1: "활성 계정. Google 이메일 및 프로필 필드를 포함한 계정 데이터는 계정이 활성 상태인 동안 보관됩니다.",
      li2: "비활성 계정. 24개월 연속 로그인 활동이 없는 계정은 등록된 이메일로 30일 유예 통지 후 자동 삭제 예약됩니다.",
      li3: "예약 기록. 확정된 예약 기록은 한국 상법 및 세무 기록 유지 의무를 준수하기 위해 투어 일자로부터 5년간 보관 후 영구 삭제되거나 회복 불가능하게 익명화됩니다.",
      li4: "사용자 요청 삭제. 마이페이지 → 설정 → 계정 삭제에서 또는 다음 이메일로 언제든지 계정 및 관련 Google 사용자 데이터를 삭제 요청하실 수 있습니다:",
      li5: "Google 접근 권한 철회. 다음 페이지에서 언제든지 본 애플리케이션의 Google 계정 접근 권한을 철회하실 수 있습니다:",
    },
  },

  zh: {
    title: "15. Google API 服务用户数据 — 专项披露",
    intro:
      "本章节说明当您选择使用 Google 账号登录时，本应用如何访问、使用、存储和保护从 Google API 接收的信息。AtoC 对从 Google API 接收的信息的使用，遵循 Google API 服务用户数据政策，包括 Limited Use（有限使用）要求。",
    s1: {
      title: "15.1 访问的数据",
      p1: "我们仅请求运行登录功能所需的最小作用域（scopes）：",
      li1: "openid — 通过 Google OpenID Connect 验证用户身份。",
      li2: "profile — 读取您的姓名、头像 URL 和地区设置，用于个性化您的账户。",
      li3: "email — 读取您的主电邮地址，作为账户的唯一标识符并用于预订相关的事务性通信。",
      p2: "我们不会请求访问 Gmail 内容、Google 日历、Google 云端硬盘、Google 联系人、Google 相册、YouTube 或任何其他受限作用域。我们也不请求活动会话之外的离线访问或 refresh token。",
    },
    s2: {
      title: "15.2 我们如何使用 Google 用户数据",
      p1: "Google 用户数据仅用于运行您所请求的面向用户的功能：",
      li1: "创建并认证您的 AtoC Korea 账户（单一 AtoC 账户与您登录所用的 Google 电邮关联）。",
      li2: "在账户页面预填您的姓名和头像，便于您识别已登录的身份。",
      li3: "将预订事务通信（预订确认、接送时间、取消凭证）发送至 Google 提供的电邮地址。",
      li4: "检测重复账户并处理您主动发起的客户服务请求。",
      p2: "我们不使用 Google 用户数据进行广告、不出售或租赁、不转让给第三方用于广告，也不用于训练、评估或改进通用 AI/ML 模型。对 Google 用户数据的人工审阅仅限于 (a) 用户明示同意、(b) 安全调查、(c) 法律合规，或 (d) 提供您所请求的面向用户功能所需。这些用途符合 Google API 服务用户数据政策，包括 Limited Use 要求。",
    },
    s3: {
      title: "15.3 我们如何共享 Google 用户数据",
      li1: "服务提供商（次级处理者）。我们仅与下列在合同数据保护义务下代表我们运营的处理者共享所需最少数据：Supabase, Inc.（托管 PostgreSQL 与认证）、Vercel Inc.（网站托管）、Stripe, Inc.（支付）、Resend, Inc. 或同等事务性电邮服务（预订邮件发送）。每个处理者仅接收其功能所需字段。",
      li2: "不出售，不向广告共享。我们不出售 Google 用户数据，亦不与广告主、广告网络、数据经纪商或将其用于跨情景行为广告的分析提供商共享。",
      li3: "法律披露。在法律要求、有效法律程序（传票、法庭命令）或为保护 AtoC、我们的用户或公众的权利、安全或财产时，可能披露 Google 用户数据。",
      li4: "公司交易。若我们涉及合并、收购、融资或资产出售，在收购方承诺遵守本隐私政策的前提下，Google 用户数据可能被转让。",
    },
    s4: {
      title: "15.4 存储与保护",
      li1: "包含从 Google 接收的电邮和资料字段的账户记录，存储在 Supabase 管理的加密 PostgreSQL 数据库中，托管于亚太地区（首尔/新加坡），具有每日自动备份。",
      li2: "传输中的数据采用 TLS 1.2 及以上保护。静态数据采用 AES-256 在磁盘卷层加密。生产数据访问限于少数指定工程师，采用基于角色的访问控制并具备审计日志。",
      li3: "Google 颁发的认证 token 仅在活动会话期间保留，并在您退出登录、更改密码或删除账户时被吊销。我们不持久化长期 Google OAuth refresh token。",
      li4: "数据库行级安全策略防止任何用户读取他人的个人数据。应用机密和 API 密钥存储在加密的环境变量中，决不存于代码或版本控制。",
      li5: "我们定期进行安全评审、依赖项漏洞扫描和事件响应演练。依据适用法律，发现合格个人数据泄露后将在 72 小时内通知受影响用户及相关数据保护机关。",
    },
    s5: {
      title: "15.5 保留与删除",
      li1: "活动账户。账户数据（包括 Google 电邮和资料字段）在账户处于活动状态期间予以保留。",
      li2: "非活动账户。连续 24 个月无登录活动的账户将在向登记电邮发送 30 日宽限期通知后自动安排删除。",
      li3: "预订记录。已确认的预订记录依据韩国商法及税务记录保留义务，自旅游日期起保留 5 年，到期后永久删除或不可逆匿名化。",
      li4: "用户发起删除。您可以随时通过 我的页面 → 设置 → 删除账户 或发送邮件至 删除您的账户及相关 Google 用户数据：",
      li5: "撤销 Google 访问权限。您也可随时在以下页面撤销本应用对您 Google 账户的访问权限：",
    },
  },

  "zh-TW": {
    title: "15. Google API 服務使用者資料 — 專項揭露",
    intro:
      "本章節說明當您選擇使用 Google 帳號登入時，本應用如何存取、使用、儲存與保護從 Google API 接收的資訊。AtoC 對從 Google API 接收之資訊的使用，遵循 Google API 服務使用者資料政策，包含 Limited Use（有限使用）要求。",
    s1: {
      title: "15.1 存取的資料",
      p1: "我們僅請求執行登入功能所需的最小範圍（scopes）：",
      li1: "openid — 透過 Google OpenID Connect 驗證使用者身分。",
      li2: "profile — 讀取您的姓名、頭像 URL 與地區設定，用於個人化您的帳戶。",
      li3: "email — 讀取您的主要電子郵件地址，作為帳戶的唯一識別碼並用於預訂相關的交易通訊。",
      p2: "我們不請求存取 Gmail 內容、Google 日曆、Google 雲端硬碟、Google 聯絡人、Google 相簿、YouTube 或任何其他受限範圍。我們也不請求作用中工作階段之外的離線存取或 refresh token。",
    },
    s2: {
      title: "15.2 我們如何使用 Google 使用者資料",
      p1: "Google 使用者資料僅用於執行您所請求的面向使用者的功能：",
      li1: "建立並認證您的 AtoC Korea 帳戶（單一 AtoC 帳戶與您登入所用的 Google 電郵連結）。",
      li2: "在帳戶頁面預填您的姓名與頭像，方便您識別已登入的身分。",
      li3: "將預訂交易通訊（預訂確認、接送時間、取消收據）寄送至 Google 提供的電郵地址。",
      li4: "偵測重複帳戶並處理您主動發起的客戶服務請求。",
      p2: "我們不使用 Google 使用者資料進行廣告、不出售或租賃、不為廣告目的轉讓給第三方，亦不用於訓練、評估或改進通用 AI/ML 模型。對 Google 使用者資料的人工審閱僅限於 (a) 使用者明示同意、(b) 安全調查、(c) 法律遵循，或 (d) 提供您所請求的面向使用者功能所需。這些用途遵循 Google API 服務使用者資料政策，包含 Limited Use 要求。",
    },
    s3: {
      title: "15.3 我們如何分享 Google 使用者資料",
      li1: "服務提供者（次級處理者）。我們僅與下列在契約資料保護義務下代表我們營運的處理者分享所需最少資料：Supabase, Inc.（託管 PostgreSQL 與認證）、Vercel Inc.（網站託管）、Stripe, Inc.（支付）、Resend, Inc. 或同等交易電郵服務（預訂郵件寄送）。每個處理者僅接收其功能所需欄位。",
      li2: "不出售，不向廣告分享。我們不出售 Google 使用者資料，亦不與廣告主、廣告網路、資料經紀商或將其用於跨情境行為廣告的分析提供商分享。",
      li3: "法律揭露。在法律要求、有效法律程序（傳票、法院命令）或為保護 AtoC、我們的使用者或公眾的權利、安全或財產時，可能揭露 Google 使用者資料。",
      li4: "公司交易。若我們涉及合併、收購、融資或資產出售，在收購方承諾遵守本隱私權政策的前提下，Google 使用者資料可能被移轉。",
    },
    s4: {
      title: "15.4 儲存與保護",
      li1: "包含從 Google 接收的電郵與個人檔案欄位的帳戶記錄，儲存於 Supabase 管理的加密 PostgreSQL 資料庫，託管於亞太地區（首爾/新加坡），具備每日自動備份。",
      li2: "傳輸中資料採用 TLS 1.2 以上保護。靜態資料採用 AES-256 在磁碟磁區層加密。生產資料存取限於少數指定工程師，採用角色權限控制並具備稽核日誌。",
      li3: "Google 簽發的認證 token 僅在作用中工作階段期間保留，並在您登出、變更密碼或刪除帳戶時被撤銷。我們不持久化長期 Google OAuth refresh token。",
      li4: "資料庫列層安全政策防止任何使用者讀取他人的個人資料。應用機密與 API 金鑰儲存於加密的環境變數中，絕不存於程式碼或版本控制。",
      li5: "我們定期進行安全評估、相依套件弱點掃描與事件回應演練。依適用法律，發現合格個人資料外洩後將於 72 小時內通知受影響使用者及相關資料保護主管機關。",
    },
    s5: {
      title: "15.5 保留與刪除",
      li1: "作用中帳戶。帳戶資料（包含 Google 電郵與個人檔案欄位）在帳戶處於作用中狀態期間予以保留。",
      li2: "非作用中帳戶。連續 24 個月無登入活動的帳戶將在向登記電郵發送 30 日寬限期通知後自動安排刪除。",
      li3: "預訂記錄。已確認的預訂記錄依韓國商法及稅務記錄保留義務，自旅遊日起保留 5 年，到期後永久刪除或不可逆匿名化。",
      li4: "使用者發起刪除。您可以隨時透過 我的頁面 → 設定 → 刪除帳戶 或發送郵件至 刪除您的帳戶及相關 Google 使用者資料：",
      li5: "撤銷 Google 存取權限。您也可隨時在以下頁面撤銷本應用對您 Google 帳戶的存取權限：",
    },
  },

  ja: {
    title: "15. Google API サービスのユーザーデータ — 個別開示",
    intro:
      "本セクションでは、お客様が Google アカウントでログインされる場合に、本アプリケーションが Google API から受領した情報をどのようにアクセス・使用・保管・保護するかについて説明します。AtoC は Google API から受領した情報の使用にあたり、Limited Use 要件を含む Google API サービスのユーザーデータポリシーを遵守します。",
    s1: {
      title: "15.1 アクセスするデータ",
      p1: "サインイン機能の運用に必要な最小スコープのみを要求します：",
      li1: "openid — Google OpenID Connect によるユーザー認証。",
      li2: "profile — アカウントの個別化に使用される氏名、プロフィール画像 URL、ロケール。",
      li3: "email — アカウントの一意識別子および予約関連の取引メール送信に使用される主要メールアドレス。",
      p2: "Gmail コンテンツ、Google カレンダー、Google ドライブ、Google 連絡先、Google フォト、YouTube またはその他の制限スコープへのアクセスは要求しません。アクティブセッション以外のオフラインアクセスや refresh token も要求しません。",
    },
    s2: {
      title: "15.2 Google ユーザーデータの使用方法",
      p1: "Google ユーザーデータは、お客様がリクエストされたユーザー向け機能の運用にのみ使用されます：",
      li1: "AtoC Korea アカウントの作成および認証（単一の AtoC アカウントは、ログインに使用された Google メールアドレスに紐付けされます）。",
      li2: "アカウントページにてサインイン中の身元を識別できるよう、氏名・プロフィール写真の事前入力。",
      li3: "Google が提供したメールアドレスへの予約取引通信（予約確認、ピックアップ時間、キャンセル受領書）の送信。",
      li4: "重複アカウントの検出、およびお客様が開始したカスタマーサービスリクエストの対応。",
      p2: "Google ユーザーデータを広告目的で使用せず、販売・賃貸せず、広告のために第三者に転送せず、汎用 AI/ML モデルの訓練・評価・改善に使用しません。Google ユーザーデータの人による確認は、(a) ユーザーの明示的同意、(b) セキュリティ調査、(c) 法令遵守、または (d) お客様が要求された機能の提供に必要な場合に限定されます。これらの使用は Limited Use 要件を含む Google API サービスのユーザーデータポリシーに準拠します。",
    },
    s3: {
      title: "15.3 Google ユーザーデータの共有",
      li1: "サービスプロバイダー（副処理者）。当社に代わり、契約上のデータ保護義務の下で運営する以下の処理者にのみ必要最小限のデータを共有します：Supabase, Inc.（マネージド PostgreSQL ホスティングおよび認証）、Vercel Inc.（ウェブホスティング）、Stripe, Inc.（決済）、Resend, Inc. または同等の取引メール提供業者（予約メール配信）。各処理者は、その機能に必要なフィールドのみを受領します。",
      li2: "販売なし、広告共有なし。Google ユーザーデータを販売せず、広告主、広告ネットワーク、データブローカー、またはクロスコンテキスト行動広告に使用する分析提供業者と共有しません。",
      li3: "法的開示。法律、有効な法的手続き（召喚状、裁判所命令）、または AtoC、ユーザー、または公衆の権利・安全・財産を保護するために必要な場合、Google ユーザーデータを開示することがあります。",
      li4: "企業取引。当社が合併、買収、資金調達、または資産売却に関与する場合、買収者が本プライバシーポリシーを尊重することを条件として、Google ユーザーデータが移転される可能性があります。",
    },
    s4: {
      title: "15.4 保管および保護",
      li1: "Google から受領したメールおよびプロフィールフィールドを含むアカウント記録は、Supabase が管理する暗号化された PostgreSQL データベースに保管され、アジア太平洋地域（ソウル/シンガポール）でホスティングされ、毎日自動バックアップが行われます。",
      li2: "転送中のデータは TLS 1.2 以上で保護されます。保管中のデータはディスクボリュームレベルで暗号化（AES-256）されます。本番データへのアクセスは、ロールベースのアクセス制御と監査ログの下で少数の指定エンジニアに制限されます。",
      li3: "Google が発行した認証トークンはアクティブセッション中のみ保持され、サインアウト、パスワード変更、アカウント削除時に取り消されます。長期の Google OAuth refresh token は保持しません。",
      li4: "データベース行レベルセキュリティポリシーにより、いかなるユーザーも他人の個人データを読み取ることはできません。アプリケーションシークレットと API キーは、コードやバージョン管理ではなく、暗号化された環境変数に保管されます。",
      li5: "定期的なセキュリティレビュー、依存関係の脆弱性スキャン、インシデント対応訓練を実施しています。適用法に従い、有資格個人データ侵害を認識してから 72 時間以内に影響を受けたユーザーおよび関連データ保護当局に通知します。",
    },
    s5: {
      title: "15.5 保管および削除",
      li1: "アクティブアカウント。Google メールおよびプロフィールフィールドを含むアカウントデータは、アカウントがアクティブな間保持されます。",
      li2: "非アクティブアカウント。24 か月連続でサインイン活動のないアカウントは、登録メールに 30 日間の猶予期間通知を送信した後、自動的に削除予定となります。",
      li3: "予約記録。確定済み予約記録は、韓国商法および税務記録保管義務を遵守するため、ツアー日から 5 年間保管され、その後永久削除または不可逆匿名化されます。",
      li4: "ユーザー主導の削除。マイページ → 設定 → アカウント削除 から、または以下のメールでいつでもアカウントおよび関連 Google ユーザーデータの削除を要求できます：",
      li5: "Google アクセス権限の取り消し。以下のページからいつでも本アプリケーションの Google アカウントへのアクセス権限を取り消すことができます：",
    },
  },

  es: {
    title: "15. Datos de Usuario de los Servicios de la API de Google — Divulgaciones específicas",
    intro:
      "Esta sección describe cómo nuestra aplicación accede, utiliza, almacena y protege la información recibida de las API de Google cuando usted opta por iniciar sesión con Google. El uso por parte de AtoC de la información recibida de las API de Google se ajusta a la Política de Datos de Usuario de los Servicios de la API de Google, incluyendo los requisitos de Uso Limitado.",
    s1: {
      title: "15.1 Datos a los que se accede",
      p1: "Solicitamos únicamente los ámbitos mínimos necesarios para operar la función de inicio de sesión:",
      li1: "openid — para autenticar al usuario mediante Google OpenID Connect.",
      li2: "profile — para leer su nombre, URL de la foto de perfil e idioma, utilizado para personalizar su cuenta.",
      li3: "email — para leer su dirección de correo principal, utilizada como identificador único de su cuenta y para la comunicación transaccional de reservas.",
      p2: "NO solicitamos acceso al contenido de Gmail, Google Calendar, Google Drive, Google Contacts, Google Photos, YouTube ni a ningún otro ámbito restringido. Tampoco solicitamos acceso sin conexión ni tokens de actualización más allá de la sesión activa.",
    },
    s2: {
      title: "15.2 Cómo usamos los datos de usuario de Google",
      p1: "Los datos de usuario de Google se utilizan únicamente para operar funciones orientadas al usuario que usted ha solicitado:",
      li1: "Para crear y autenticar su cuenta de AtoC Korea (una única cuenta de AtoC se asocia a la dirección de correo de Google con la que inicia sesión).",
      li2: "Para precargar su nombre y foto de perfil en la página de su cuenta para que pueda reconocer la identidad con la que está conectado.",
      li3: "Para enviar comunicaciones transaccionales de reserva (confirmación, hora de recogida, recibo de cancelación) a la dirección de correo proporcionada por Google.",
      li4: "Para detectar cuentas duplicadas y atender solicitudes de servicio al cliente que usted inicie.",
      p2: "NO utilizamos los datos de usuario de Google para publicidad, no los vendemos ni alquilamos, no los transferimos a terceros con fines publicitarios y no los utilizamos para entrenar, evaluar o mejorar modelos generales de IA / ML. La revisión humana de los datos de usuario de Google se limita a (a) consentimiento explícito del usuario, (b) investigaciones de seguridad, (c) cumplimiento legal, o (d) cuando sea necesario para proporcionar una función orientada al usuario que usted haya solicitado. Estos usos cumplen con la Política de Datos de Usuario de los Servicios de la API de Google, incluidos los requisitos de Uso Limitado.",
    },
    s3: {
      title: "15.3 Cómo compartimos los datos de usuario de Google",
      li1: "Proveedores de servicios (subprocesadores). Compartimos los datos mínimos necesarios con los siguientes procesadores que operan en nuestro nombre bajo obligaciones contractuales de protección de datos: Supabase, Inc. (alojamiento de PostgreSQL gestionado y autenticación), Vercel Inc. (alojamiento web), Stripe, Inc. (pagos), Resend, Inc. o proveedores comparables de correo transaccional (envío de correos de reserva). Cada procesador solo recibe los campos necesarios para su función.",
      li2: "Sin venta, sin compartir publicitario. No vendemos datos de usuario de Google ni los compartimos con anunciantes, redes publicitarias, intermediarios de datos o proveedores de análisis que los utilicen para publicidad conductual entre contextos.",
      li3: "Divulgación legal. Podemos divulgar datos de usuario de Google cuando lo exija la ley, un proceso legal válido (citación, orden judicial), o para proteger los derechos, la seguridad o la propiedad de AtoC, nuestros usuarios o el público.",
      li4: "Operaciones corporativas. Si participamos en una fusión, adquisición, financiación o venta de activos, los datos de usuario de Google podrán transferirse con el compromiso del adquirente de respetar esta Política de Privacidad.",
    },
    s4: {
      title: "15.4 Almacenamiento y protección",
      li1: "Los registros de cuenta (incluidos el correo y los campos de perfil recibidos de Google) se almacenan en bases de datos PostgreSQL cifradas gestionadas por Supabase, alojadas en la región Asia-Pacífico (Seúl / Singapur), con copias de seguridad automáticas diarias.",
      li2: "Los datos en tránsito se protegen con TLS 1.2 o superior. Los datos en reposo se cifran a nivel de volumen de disco (AES-256). El acceso a los datos de producción está restringido a un pequeño número de ingenieros designados bajo control de acceso basado en roles con registro de auditoría.",
      li3: "Los tokens de autenticación emitidos por Google se conservan únicamente durante la sesión activa y se revocan al cerrar sesión, cambiar la contraseña o eliminar la cuenta. No conservamos tokens de actualización OAuth de Google de larga duración.",
      li4: "Las políticas de seguridad a nivel de fila de la base de datos impiden que cualquier usuario lea los datos personales de otro usuario. Los secretos de aplicación y las claves de API se almacenan en variables de entorno cifradas, nunca en código ni en control de versiones.",
      li5: "Realizamos revisiones de seguridad periódicas, escaneos de vulnerabilidades de dependencias y simulacros de respuesta a incidentes. Notificaremos a los usuarios afectados y a la autoridad de protección de datos correspondiente sobre cualquier brecha cualificada de datos personales en un plazo de 72 horas desde su detección, según lo exija la ley aplicable.",
    },
    s5: {
      title: "15.5 Conservación y eliminación",
      li1: "Cuentas activas. Conservamos los datos de su cuenta (incluidos el correo y los campos de perfil de Google) durante todo el tiempo que su cuenta esté activa.",
      li2: "Cuentas inactivas. Las cuentas sin actividad de inicio de sesión durante 24 meses consecutivos se programan automáticamente para su eliminación tras un aviso de período de gracia de 30 días enviado al correo registrado.",
      li3: "Registros de reserva. Los registros de reserva confirmados se conservan durante 5 años desde la fecha del tour para cumplir con las obligaciones de conservación de registros del derecho mercantil y fiscal coreano, tras lo cual se eliminan permanentemente o se anonimizan irreversiblemente.",
      li4: "Eliminación iniciada por el usuario. Puede eliminar su cuenta y los datos de usuario de Google asociados en cualquier momento desde Mi Página → Configuración → Eliminar cuenta, o enviando un correo a:",
      li5: "Revocar el acceso de Google. También puede revocar el acceso de nuestra aplicación a su cuenta de Google en cualquier momento en:",
    },
  },
};

const FILE_BY_LOCALE = {
  en: "messages/en.json",
  ko: "messages/ko.json",
  zh: "messages/zh.json",
  "zh-TW": "messages/zh-TW.json",
  ja: "messages/ja.json",
  es: "messages/es.json",
};

for (const [locale, file] of Object.entries(FILE_BY_LOCALE)) {
  const j = JSON.parse(readFileSync(file, "utf-8"));
  if (!j.privacy) {
    console.error(`! ${file} has no .privacy block — skipping`);
    continue;
  }
  j.privacy.googleApi = TRANSLATIONS[locale];
  writeFileSync(file, JSON.stringify(j, null, 2) + "\n", "utf-8");
  console.log(`✓ ${locale}: privacy.googleApi added (${file})`);
}
