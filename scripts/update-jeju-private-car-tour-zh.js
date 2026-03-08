/**
 * Update Jeju Private Car Charter Tour - Chinese (zh) translation
 * Run from browser console on /admin (logged in as admin), or use in a one-off update.
 *
 * Usage in browser:
 * 1. Go to /admin and log in
 * 2. Open DevTools Console
 * 3. Copy-paste this file content and run: updateJejuPrivateCarTourZh()
 */

const ZH_TRANSLATION = {
  title: "济州岛私人包车一日游（含司机导游）| 济州岛定制包车旅游",
  tag: "济州岛 · 私人包车 · 一日游",
  subtitle: "专业司机导游陪同的济州岛私人包车旅游，可自由定制行程，轻松探索济州岛热门景点。",
  duration: "9小时",
  description: `通过这趟济州岛私人包车一日游，以最舒适、灵活的方式探索济州岛的主要景点。乘坐宽敞的空调车辆，由经验丰富的专业司机导游带领，无需使用公共交通，轻松前往济州岛各大热门旅游地。

您可以根据自己的时间安排和兴趣爱好自由定制行程。在专业导游的陪同下，按照自己的节奏游览济州岛著名景点、海岸风光以及壮丽的自然景观，享受轻松而个性化的旅行体验。`,

  pickup_info: `酒店接送服务

若您的酒店位于济州市区（距离济州国际机场6公里范围内），可享受免费酒店接送服务。

若接送地点位于济州市区以外地区，需支付额外接送费用 ₩50,000。

接送区域
免费接送 – 济州市区

位于Nohyeong-dong、Yeon-dong及济州市区附近的酒店。

济州市区以外（+₩50,000）

Seogwipo、西归浦
Aewol、涯月
Hallim、翰林
Seongsan、城山
Hangyeong、翰京
Jocheon、朝天
Pyoseon、表善
Namwon、南元
Andeok、安德
Daejeong、大静
Jungmun、中门`,

  notes: `重要信息

超时费用
行程超过9小时后，每小时需支付**₩25,000**，费用需现金直接支付给司机。

行程区域限制
济州岛私人包车行程每天仅限游览一个区域（例如：济州东部或南部）。
若需跨区域游览，将产生额外往返费用 ₩60,000。

机场接送服务
在行程当天可免费提供机场接送（需提前申请）。

乘客及行李信息
预订时请提供准确的乘客人数及行李数量。

出发前联系
工作人员将在行程前一天晚上8点前通过 WhatsApp 联系您。

WhatsApp联系方式
请提供有效的 WhatsApp 号码，以便顺利安排您的济州岛包车行程。`,

  highlights: [
    "享受团队旅游无法提供的舒适私人体验",
    "10年以上经验的专业司机导游",
    "酒店接送服务，轻松出行无烦恼",
    "探索济州岛联合国教科文组织世界遗产和隐藏景点",
    "私人定制行程，根据个人兴趣自由安排",
    "乘坐宽敞舒适的空调车辆旅行",
    "提供多语言导游（英语 / 中文 / 韩语）",
    "轮椅可通行",
    "私人小团（最多6人）",
  ],

  includes: [
    "酒店接送服务",
    "济州岛私人包车车辆",
    "专业司机导游（中文 / 英文）",
    "燃油费",
    "高速过路费",
    "停车费",
    "税费",
  ],

  excludes: [
    "景点门票",
    "餐饮费用",
    "小费",
  ],

  faqs: [
    {
      question: "接送时间是什么时候？",
      answer: "导游联系您后，您可以直接与导游协商并确认具体接送时间。",
    },
    {
      question: "超时费用如何计算？",
      answer: "行程超过9小时后，每小时需支付**₩25,000**，费用需现金直接支付给司机。",
    },
    {
      question: "一天可以游览多个区域吗？",
      answer: "济州岛私人包车行程每天仅限一个区域。若需跨区域游览，将产生额外往返费用 ₩60,000。",
    },
    {
      question: "导游可以使用什么语言？",
      answer: "我们将根据您的需求安排英语、中文或韩语的专业导游。",
    },
    {
      question: "可以免费取消吗？",
      answer: "可以。在行程开始前24小时取消，可获得全额退款。",
    },
    {
      question: "可以先预订后付款吗？",
      answer: "可以。您可以先支付少量订金锁定名额，剩余费用在行程当天直接支付给导游。",
    },
  ],
};

async function getAdminToken() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes("auth")) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const token =
          data?.access_token ||
          data?.accessToken ||
          data?.session?.access_token ||
          data?.currentSession?.access_token;
        if (token) return token;
      } catch (e) {}
    }
  }
  return null;
}

async function findTourBySlug(slug) {
  const res = await fetch(`/api/tours?limit=200`);
  const data = await res.json();
  if (!res.ok || !data.data) return null;
  const tour = data.data.find((t) => t.slug === slug || (t.slug && t.slug.includes("jeju-private-car")));
  return tour || null;
}

async function updateJejuPrivateCarTourZh() {
  const token = await getAdminToken();
  if (!token) {
    console.error("❌ Admin token not found. Please log in at /admin first.");
    return;
  }

  const tour = await findTourBySlug("jeju-private-car-charter-tour") || await findTourBySlug("jeju-private-car-charter-driver-custom-tour");
  if (!tour) {
    console.error("❌ Jeju Private Car Charter Tour not found.");
    return;
  }

  const res = await fetch(`/api/admin/tours/${tour.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      translations: {
        zh: ZH_TRANSLATION,
      },
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    console.error("❌ Update failed:", result);
    return;
  }
  console.log("✅ Jeju Private Car Charter Tour – Chinese (zh) translation updated.");
  console.log("   Tour ID:", tour.id, "| Slug:", tour.slug);
}

if (typeof window !== "undefined") {
  window.updateJejuPrivateCarTourZh = updateJejuPrivateCarTourZh;
  console.log("💡 Run: updateJejuPrivateCarTourZh()");
}
