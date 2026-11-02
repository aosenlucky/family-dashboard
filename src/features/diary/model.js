export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function dateText(date, year = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    ...(year ? { year: "numeric" } : {}),
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function weekStart(date) {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -(d === 0 ? 6 : d - 1));
}
export function period(date, type) {
  const start = type === "week" ? weekStart(date) : date.slice(0, 7) + "-01";
  const next =
    type === "week"
      ? addDays(start, 7)
      : new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7), 1, 12))
          .toISOString()
          .slice(0, 10);
  return { start, end: addDays(next, -1), key: `${type}:${start}`, type };
}
export function movePeriod(date, type, direction) {
  if (type === "week") return addDays(date, direction * 7);
  return new Date(
    Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1 + direction, 1, 12),
  )
    .toISOString()
    .slice(0, 10);
}
export const titleOf = (e) =>
  e.text.trim().split("\n")[0].slice(0, 36) || "留下一张照片";
export const newDraft = () => ({ id: "", date: today(), text: "", photos: [] });
export const newData = (name = "Aosen") => ({
  schema: 1,
  name,
  entries: [],
  draft: newDraft(),
  reviews: {},
});
export function sortedEntries(data) {
  return data.entries
    .filter((e) => !e.deletedAt)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
}
export function entriesFor(data, range) {
  return sortedEntries(data).filter(
    (e) => e.date >= range.start && e.date <= range.end,
  );
}
export function highlights(entries) {
  const ordered = [...entries].sort(
    (a, b) =>
      Number(b.starred) - Number(a.starred) || b.date.localeCompare(a.date),
  );
  const days = new Set(),
    result = [];
  for (const entry of ordered) {
    if (!days.has(entry.date)) {
      result.push(entry);
      days.add(entry.date);
    }
    if (result.length === 3) break;
  }
  return result;
}
export function calendarDays(month) {
  const start = month + "-01",
    first = weekStart(start);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}
export function publishDraft(
  data,
  now = new Date().toISOString(),
  id = crypto.randomUUID(),
) {
  const draft = data.draft;
  if (!draft.text.trim() && !draft.photos.length)
    throw new Error("写一点文字，或放一张照片，再保存。");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    Number.isNaN(Date.parse(`${draft.date}T12:00:00Z`)) ||
    new Date(`${draft.date}T12:00:00Z`).toISOString().slice(0, 10) !==
      draft.date ||
    draft.date > today()
  )
    throw new Error("请选择今天或之前的有效日期。");
  const old = data.entries.find((e) => e.id === draft.id);
  if (draft.id && (!old || old.deletedAt))
    throw new Error("原记录已不在日记中，请先恢复它。");
  const entry = {
    id: old?.id || id,
    createdAt: old?.createdAt || now,
    updatedAt: now,
    date: draft.date,
    text: draft.text.trim(),
    photos: [...draft.photos],
    starred: old?.starred || false,
    resurface: old?.resurface ?? true,
    deletedAt: null,
    versions: old?.versions || [],
  };
  if (old) {
    entry.versions = [
      {
        text: old.text,
        photos: old.photos,
        date: old.date,
        savedAt: old.updatedAt || old.createdAt,
      },
      ...entry.versions,
    ].slice(0, 5);
    Object.assign(old, entry);
  } else data.entries.push(entry);
  data.draft = newDraft();
  return entry.id;
}
export function prepareAiText(entries, range) {
  return (
    `请仅根据以下由我选择的日记，整理${range.type === "week" ? "本周" : "本月"}回顾。不要编造经历，不做心理或性格诊断；区分事实与推测，每个主要结论注明来源日期。记录不足时请明确说明。\n\n按「发生的事、反复出现的主题、值得留下的变化」整理成可修改的草稿。\n\n` +
    entries
      .map(
        (e) =>
          `【${e.date}】\n${e.text || "（这篇只有照片，本次未导出照片。）"}`,
      )
      .join("\n\n---\n\n")
  );
}
export function createDemo() {
  const d = newData("Aosen"),
    now = today();
  const rows = [
    [
      0,
      "下班后，绕了一点远路。\n\n没有急着回消息，慢慢走过楼下的那排树。风很轻，路灯刚亮。今天没有什么大事，但这一小段路，让我觉得舒服。",
      true,
    ],
    [
      -1,
      "给自己留了一个慢慢喝茶的下午。\n\n手机放在一旁，茶凉了一点也没关系。原来没安排满的时间，也可以过得很好。",
      true,
      "tea",
    ],
    [
      -3,
      "把那件拖了很久的小事做完了。\n\n做之前觉得很麻烦，真正开始只用了二十分钟。记下来，下次遇到类似的事时，回来看看。",
      false,
    ],
    [
      -5,
      "又去湖边走了一次。\n\n还记得上次来时，满脑子都是没做完的工作。这一次只是看了看水面，等了一会儿日落。",
      true,
      "lake",
    ],
    [-9, "普通的一天。早餐很好吃，下午有点累，晚上读了几页书。", false],
    [
      -31,
      "开始给自己留一点空白。\n\n不用每一天都写得完整。有一句，就留一句。",
      true,
    ],
  ];
  d.entries = rows.map(([offset, text, starred, photo], i) => ({
    id: `demo-${i}`,
    date: addDays(now, offset),
    text,
    photos: [],
    demoPhoto: photo || "",
    starred,
    resurface: true,
    createdAt: `${addDays(now, offset)}T12:00:00Z`,
    updatedAt: `${addDays(now, offset)}T12:00:00Z`,
    deletedAt: null,
    versions: [],
  }));
  return d;
}
