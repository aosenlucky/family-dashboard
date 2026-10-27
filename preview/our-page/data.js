import tea from "./assets/tea.jpg";
import lake from "./assets/lake.jpg";

export const PEOPLE = { aosen: "Aosen", xiaoyue: "小悦" };
export const STORAGE_KEY = "family-our-page-preview-v1";
export const makeId = () => globalThis.crypto.randomUUID();
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dateLabel(value, year = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  const [y, m, d] = value.split("-").map(Number);
  return `${year ? `${y} 年 ` : ""}${m} 月 ${d} 日`;
}
export function weekStart(value) {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function weekEnd(value) {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}
export function createSeed() {
  return {
    version: 1,
    viewer: "aosen",
    moments: [
      {
        id: "tea",
        author: "aosen",
        date: "2026-10-25",
        title: "把周末，过得慢一点",
        text: "把手机放远一点，泡了两杯热茶。听你讲这周的小事，太阳刚好落在桌边。其实哪里也不去，也很好。",
        photo: tea,
        photoAlt: "木桌上的两杯热茶，示例照片",
        sample: true,
        reactions: ["xiaoyue"],
        favorites: ["aosen"],
        replies: [
          {
            id: "r1",
            author: "xiaoyue",
            text: "最喜欢你认真听我说话的时候。那天下午，觉得心里很安静。",
          },
        ],
      },
      {
        id: "note",
        author: "xiaoyue",
        date: "2026-10-23",
        title: "被好好惦记的感觉",
        text: "只是随口说了一句想吃橘子，晚上就看到洗好的橘子放在桌上。你说「顺路买的」，可我知道并不顺路。\n\n这些小事，我都有放在心上。",
        photo: "",
        sample: true,
        reactions: ["aosen"],
        favorites: ["xiaoyue"],
        replies: [],
      },
      {
        id: "walk",
        author: "aosen",
        date: "2026-10-21",
        title: "一起等了一场日落",
        text: "今天没赶路。沿着湖边慢慢走，停下来等天色变成橘子色。想把这样的傍晚多留一些给我们。",
        photo: lake,
        photoAlt: "晚霞倒映在安静的湖面，示例照片",
        sample: true,
        reactions: [],
        favorites: ["aosen", "xiaoyue"],
        replies: [
          {
            id: "r2",
            author: "xiaoyue",
            text: "还记得风吹过来，你把外套披在我肩上。",
          },
        ],
      },
    ],
    letters: {},
    weekDrafts: {},
    momentDrafts: {},
    heartDrafts: {},
    hearts: [
      {
        id: "h1",
        author: "xiaoyue",
        date: "2026-10-24",
        event: "昨天约好一起吃饭，后来你晚回来了，我没有提前收到消息。",
        feeling: "等着的时候有点失落，也有些担心。",
        wish: "如果时间有变化，可以提前告诉我一声吗？",
        sample: true,
        replies: [
          {
            id: "hr1",
            author: "aosen",
            text: "听到啦。以后临时加班，我会先告诉你，不让你一直等。",
          },
        ],
        agreement: {
          text: "晚归时提前说一声，再一起决定要不要等饭。",
          proposer: "aosen",
          accepted: [],
          outcomes: {},
          archived: false,
        },
      },
    ],
  };
}

export function readPreview(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createSeed();
  const data = JSON.parse(raw);
  if (
    data.version !== 1 ||
    !Array.isArray(data.moments) ||
    !Array.isArray(data.hearts) ||
    !PEOPLE[data.viewer]
  )
    throw new Error("预览记录格式不正确");
  for (const moment of data.moments) {
    if (
      !moment.id ||
      !PEOPLE[moment.author] ||
      typeof moment.text !== "string" ||
      !Array.isArray(moment.replies) ||
      !Array.isArray(moment.favorites) ||
      !Array.isArray(moment.reactions)
    )
      throw new Error("预览记录格式不正确");
  }
  return { ...createSeed(), ...data };
}
