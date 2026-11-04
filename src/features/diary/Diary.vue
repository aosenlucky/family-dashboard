<script setup>
import {
  ref,
  shallowRef,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import Icon from "./Icon.vue";
import DialogShell from "./DialogShell.vue";
import "./style.css";
import tea from "./assets/tea.jpg";
import lake from "./assets/lake.jpg";
import {
  createVault,
  unlockVault,
  encryptData,
  changePassword,
  validateEnvelope,
  decryptData,
} from "./crypto.js";
import { createVaultStorage } from "./storage.js";
import {
  today,
  addDays,
  dateText,
  period,
  movePeriod,
  titleOf,
  newData,
  sortedEntries,
  entriesFor,
  highlights,
  calendarDays,
  publishDraft,
  prepareAiText,
  createDemo,
} from "./model.js";

const props = defineProps({
  cloudSession: Object,
  preview: Boolean,
  demoMode: Boolean,
  allowPrivate: { type: Boolean, default: true },
});
const emit = defineEmits(["show-demo", "show-private", "locked"]);
const demo = ref(
  props.preview
    ? new URLSearchParams(location.search).get("demo") === "1"
    : props.demoMode,
);
const cloud = props.cloudSession?.store;
const savedLabel = cloud ? "已加密同步到个人账号" : "已加密保存到本机";
const { readVault, writeVault } =
  cloud ||
  createVaultStorage(
    props.preview
      ? "family-private-diary-preview-v1"
      : "family-private-diary-v1",
  );
const data = ref(null),
  envelope = shallowRef(null),
  loading = ref(true),
  busy = ref(false);
const page = ref("write"),
  modal = ref(""),
  error = ref(""),
  toast = ref(""),
  secret = ref(""),
  repeatSecret = ref(""),
  name = ref("Aosen"),
  recoveryMode = ref(false);
const setupPending = shallowRef(null),
  recoverySaved = ref(false),
  covered = ref(false);
const saveStatus = ref(""),
  dirty = ref(false),
  storageError = ref(""),
  photoBusy = ref(false);
const selectedId = ref(""),
  search = ref(""),
  monthFilter = ref(""),
  favoriteOnly = ref(false),
  calendarOpen = ref(false),
  selectedDay = ref("");
const calendarMonth = ref(today().slice(0, 7)),
  reviewType = ref("week"),
  reviewDate = ref(today()),
  chosenIds = ref([]),
  lastSaved = ref("");
const importCandidate = shallowRef(null),
  importReady = shallowRef(null),
  newPassword = ref(""),
  repeatPassword = ref("");
let key = null,
  hydrating = false,
  saveTimer,
  toastTimer,
  coverTimer,
  idleTimer,
  lastActive = Date.now(),
  generation = 0,
  savePromise = null,
  importRevision = null;
const ackReload = ref(false);
const IDLE_MS = 5 * 60 * 1000;
const active = computed(() => !!data.value);
const entries = computed(() => (data.value ? sortedEntries(data.value) : []));
const selected = computed(() =>
  data.value?.entries.find((e) => e.id === selectedId.value),
);
const trash = computed(
  () => data.value?.entries.filter((e) => e.deletedAt) || [],
);
const dateHeading = computed(() =>
  dateText(data.value?.draft.date || today(), true),
);
const weekday = computed(() =>
  new Intl.DateTimeFormat("zh-CN", { timeZone: "UTC", weekday: "long" }).format(
    new Date(`${data.value?.draft.date || today()}T12:00:00Z`),
  ),
);
const hasDraft = computed(
  () => !!(data.value?.draft.text.trim() || data.value?.draft.photos.length),
);
const filtered = computed(() =>
  entries.value.filter(
    (e) =>
      (!search.value.trim() ||
        e.text
          .toLocaleLowerCase()
          .includes(search.value.trim().toLocaleLowerCase()) ||
        e.date.includes(search.value.trim())) &&
      (!monthFilter.value || e.date.startsWith(monthFilter.value)) &&
      (!selectedDay.value || e.date === selectedDay.value) &&
      (!favoriteOnly.value || e.starred),
  ),
);
const groups = computed(() => {
  const map = new Map();
  for (const e of filtered.value) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return [...map].map(([date, items]) => ({ date, items }));
});
const calendar = computed(() => calendarDays(calendarMonth.value));
const recordedDays = computed(() => new Set(entries.value.map((e) => e.date)));
const range = computed(() => period(reviewDate.value, reviewType.value));
const periodEntries = computed(() =>
  data.value ? entriesFor(data.value, range.value) : [],
);
const reviewHighlights = computed(() => highlights(periodEntries.value));
const reviewLabel = computed(() =>
  reviewType.value === "week" ? "这一周" : "这个月",
);
const reviewText = computed(
  () => data.value?.reviews[range.value.key]?.text || "",
);
const savedReviews = computed(() =>
  Object.entries(data.value?.reviews || {})
    .filter(([, v]) => v.text.trim())
    .sort(([a], [b]) => b.slice(5).localeCompare(a.slice(5))),
);
const weeklyNotes = computed(() =>
  reviewType.value === "month"
    ? savedReviews.value.filter(
        ([k, v]) =>
          k.startsWith("week:") &&
          v.start <= range.value.end &&
          v.end >= range.value.start,
      )
    : [],
);
const dueReview = computed(() => {
  if (!data.value) return null;
  const candidates = [
    period(movePeriod(today(), "month", -1), "month"),
    period(addDays(today(), -7), "week"),
  ];
  return (
    candidates.find(
      (r) =>
        !data.value.reviewSeen?.[r.key] &&
        !data.value.reviews[r.key]?.text.trim() &&
        entriesFor(data.value, r).length,
    ) || null
  );
});
const memory = computed(() =>
  lastSaved.value
    ? entries.value.find(
        (e) =>
          e.id !== lastSaved.value && e.resurface !== false && e.date < today(),
      )
    : null,
);
const photoOf = (e) =>
  e.photos?.[0] ||
  (demo.value && e.demoPhoto ? { tea, lake }[e.demoPhoto] : "");
const selectedAi = computed(() =>
  periodEntries.value.filter((e) => chosenIds.value.includes(e.id)),
);
const modalTitle = computed(
  () =>
    ({
      detail: selected.value ? dateText(selected.value.date, true) : "日记",
      settings: "日记设置",
      about: props.preview ? "关于日记预览" : "关于私人日记",
      recovery: "收好你的恢复码",
      import: "导入加密备份",
      ai: "准备 AI 整理素材",
      trash: "回收站",
      password: "修改日记口令",
      history: "之前的版本",
      reload: "读取最新日记",
    })[modal.value],
);

function notice(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 4500);
}
function openModal(value) {
  ackReload.value = false;
  error.value = "";
  secret.value = "";
  newPassword.value = "";
  repeatPassword.value = "";
  modal.value = value;
}
function closeModal() {
  if (busy.value) return;
  modal.value = "";
  error.value = "";
  secret.value = "";
  newPassword.value = "";
  repeatPassword.value = "";
  if (importCandidate.value) {
    importCandidate.value = null;
    importReady.value = null;
  }
}
function go(value) {
  page.value = value;
  error.value = "";
  nextTick(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}
function activate(payload, sessionKey, stored) {
  hydrating = true;
  data.value = payload;
  key = sessionKey;
  envelope.value = stored;
  if (!payload.draft.id && !payload.draft.text && !payload.draft.photos.length)
    payload.draft.date = today();
  dirty.value = false;
  storageError.value = "";
  saveStatus.value = demo.value ? "示例仅保留在当前页面" : savedLabel;
  generation = 0;
  hydrating = false;
  covered.value = false;
  secret.value = "";
  repeatSecret.value = "";
  lastActive = Date.now();
  page.value = "write";
  reviewDate.value =
    payload.entries
      .filter((e) => !e.deletedAt)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.date || today();
}
function startPrivate() {
  if (!props.allowPrivate) return;
  if (props.preview) location.href = "./";
  else emit("show-private");
}
async function prepareToLeave() {
  if (busy.value || photoBusy.value) {
    notice("正在处理内容，完成后即可离开。");
    return false;
  }
  if (!(await flush())) {
    covered.value = false;
    notice("草稿尚未保存，请先重试或导出加密备份。");
    return false;
  }
  if (active.value && !demo.value) await lock();
  return true;
}
defineExpose({ prepareToLeave });
function focusMain() {
  document.getElementById("main")?.focus({ preventScroll: true });
}
function startDemo() {
  if (props.preview) location.href = "?demo=1";
  else emit("show-demo");
}
watch(
  data,
  () => {
    if (hydrating || !data.value) return;
    if (demo.value) {
      saveStatus.value = "示例仅保留在当前页面";
      return;
    }
    dirty.value = true;
    generation++;
    saveStatus.value = "正在加密保存…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 650);
  },
  { deep: true, flush: "sync" },
);
async function flush() {
  clearTimeout(saveTimer);
  if (demo.value || !key || !data.value) return true;
  if (savePromise) {
    const ok = await savePromise;
    return ok && dirty.value ? flush() : ok;
  }
  if (!dirty.value) return true;
  const ticket = generation,
    snapshot = JSON.parse(JSON.stringify(data.value)),
    current = envelope.value,
    sessionKey = key;
  savePromise = (async () => {
    try {
      const encrypted = await encryptData(sessionKey, current, snapshot);
      envelope.value = await writeVault(encrypted, current.revision);
      if (generation === ticket) dirty.value = false;
      storageError.value = "";
      saveStatus.value = dirty.value ? "正在加密保存…" : savedLabel;
      return true;
    } catch (e) {
      storageError.value = e.message;
      saveStatus.value = cloud
        ? "尚未同步，请保留此页面"
        : "尚未保存，请保留此页面";
      return false;
    }
  })();
  const ok = await savePromise;
  savePromise = null;
  return ok && dirty.value ? flush() : ok;
}
async function setup() {
  error.value = "";
  if (!name.value.trim()) {
    error.value = "填写一个称呼即可。";
    return;
  }
  if (secret.value !== repeatSecret.value) {
    error.value = "两次输入的日记口令不一致。";
    return;
  }
  busy.value = true;
  try {
    setupPending.value = await createVault(
      secret.value,
      newData(name.value.trim()),
    );
    secret.value = "";
    repeatSecret.value = "";
    recoverySaved.value = false;
    modal.value = "recovery";
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function finishSetup() {
  if (!recoverySaved.value || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const pending = setupPending.value,
      stored = await writeVault(pending.envelope, null);
    const opened = await unlockVault(stored, pending.recovery, true);
    activate(opened.data, opened.key, stored);
    setupPending.value = null;
    modal.value = "";
    notice("日记已建立，可以直接写了。");
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function unlock() {
  busy.value = true;
  error.value = "";
  try {
    const latest = await readVault();
    if (!latest) throw new Error("未找到本机日记，可以从加密备份导入。");
    const result = await unlockVault(latest, secret.value, recoveryMode.value);
    activate(result.data, result.key, latest);
    if (recoveryMode.value)
      notice("已通过恢复码解锁，可在设置中修改日记口令。");
  } catch (e) {
    error.value = e.message;
    secret.value = "";
  } finally {
    busy.value = false;
  }
}
async function lock() {
  if (!active.value || busy.value || photoBusy.value) return;
  if (demo.value) {
    covered.value = true;
    return;
  }
  busy.value = true;
  try {
    if (!(await flush())) {
      covered.value = true;
      return;
    }
    hydrating = true;
    data.value = null;
    key = null;
    hydrating = false;
    emit("locked");
    selectedId.value = "";
    search.value = "";
    chosenIds.value = [];
    modal.value = "";
    importCandidate.value = null;
    importReady.value = null;
    secret.value = "";
    repeatSecret.value = "";
    newPassword.value = "";
    repeatPassword.value = "";
    error.value = "";
    covered.value = false;
  } finally {
    busy.value = false;
  }
}
async function discardAndReload() {
  if (!ackReload.value) return;
  busy.value = true;
  clearTimeout(saveTimer);
  try {
    if (savePromise) await savePromise;
    if (cloud) {
      dirty.value = false;
      emit("locked");
      return;
    }
    const latest = await readVault();
    hydrating = true;
    data.value = null;
    key = null;
    dirty.value = false;
    hydrating = false;
    storageError.value = "";
    envelope.value = latest;
    modal.value = "";
    covered.value = false;
    secret.value = "";
    error.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
function keepWriting() {
  clearTimeout(coverTimer);
  covered.value = false;
  lastActive = Date.now();
  refreshCloud();
}
async function publish() {
  if (photoBusy.value || busy.value) return;
  error.value = "";
  try {
    lastSaved.value = publishDraft(data.value);
    if (await flush())
      notice(demo.value ? "已留在本次示例中" : "这一篇，已加密留在日记里。");
  } catch (e) {
    error.value = e.message;
  }
}
function viewEntry(entry) {
  selectedId.value = entry.id;
  openModal("detail");
}
function editEntry() {
  if (hasDraft.value && data.value.draft.id !== selected.value.id) {
    closeModal();
    go("write");
    notice("写作区还有一段草稿，先留下它再编辑。");
    return;
  }
  const e = selected.value;
  data.value.draft = {
    id: e.id,
    date: e.date,
    text: e.text,
    photos: [...e.photos],
  };
  closeModal();
  go("write");
}
function restoreVersion(version) {
  if (hasDraft.value) {
    notice("写作区还有草稿，请先保存它。");
    return;
  }
  data.value.draft = {
    id: selected.value.id,
    date: version.date,
    text: version.text,
    photos: [...version.photos],
  };
  closeModal();
  go("write");
  notice("旧版本已放入写作区，保存后才会更新原日记。");
}
function trashEntry() {
  selected.value.deletedAt = new Date().toISOString();
  closeModal();
  notice("已移入回收站，可以随时恢复。");
}
function recoverEntry(entry) {
  entry.deletedAt = null;
  notice("已恢复到日记。");
}
async function addPhotos(event) {
  const files = [...(event.target.files || [])];
  event.target.value = "";
  if (!files.length) return;
  if (data.value.draft.photos.length + files.length > 4) {
    error.value = "每篇最多放 4 张照片。";
    return;
  }
  photoBusy.value = true;
  error.value = "";
  try {
    const photos = [];
    for (const file of files) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 12 * 1024 * 1024
      )
        throw new Error("请选择 12 MB 以内的 JPG、PNG 或 WebP 照片。");
      const bitmap = await createImageBitmap(file);
      try {
        const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        photos.push(canvas.toDataURL("image/jpeg", 0.76));
      } finally {
        bitmap.close();
      }
    }
    data.value.draft.photos.push(...photos);
  } catch (e) {
    error.value = e.message;
  } finally {
    photoBusy.value = false;
  }
}
function download(content, filename, mime = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type: mime })),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function backup() {
  if (demo.value) {
    notice("示例不生成私人备份，请先建立自己的加密日记。");
    return;
  }
  busy.value = true;
  try {
    const result =
      data.value && key
        ? await encryptData(
            key,
            envelope.value,
            JSON.parse(JSON.stringify(data.value)),
          )
        : await readVault();
    if (!result) throw new Error("还没有可导出的日记。");
    download(JSON.stringify(result), `日记-加密备份-${today()}.json`);
    notice("加密备份已下载，包含当前草稿。");
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function chooseBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  error.value = "";
  busy.value = true;
  try {
    if (file.size > 50 * 1024 * 1024)
      throw new Error("备份超过 50 MB，当前无法导入。");
    if (data.value && !(await flush()))
      throw new Error("当前内容还未保存，请先导出加密备份。");
    const candidate = validateEnvelope(JSON.parse(await file.text()));
    importRevision = cloud
      ? envelope.value.revision
      : ((await readVault())?.revision ?? null);
    importCandidate.value = candidate;
    importReady.value = null;
    recoveryMode.value = false;
    secret.value = "";
    modal.value = "import";
  } catch (e) {
    error.value = e.message || "备份文件无法打开。";
  } finally {
    busy.value = false;
  }
}
async function verifyImport() {
  busy.value = true;
  error.value = "";
  try {
    importReady.value = await unlockVault(
      importCandidate.value,
      secret.value,
      recoveryMode.value,
    );
    secret.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function confirmImport() {
  busy.value = true;
  error.value = "";
  try {
    const imported = cloud
      ? await encryptData(key, envelope.value, importReady.value.data)
      : importCandidate.value;
    const stored = await writeVault(imported, importRevision);
    activate(
      importReady.value.data,
      cloud ? key : importReady.value.key,
      stored,
    );
    importReady.value = null;
    importCandidate.value = null;
    modal.value = "";
    notice(
      cloud ? "备份已同步到当前个人账号。" : "加密备份已恢复到这个浏览器。",
    );
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function updatePassword() {
  error.value = "";
  if (newPassword.value !== repeatPassword.value) {
    error.value = "两次输入的口令不一致。";
    return;
  }
  busy.value = true;
  try {
    if (!(await flush())) return;
    const next = await changePassword(key, envelope.value, newPassword.value);
    envelope.value = await writeVault(next, envelope.value.revision, {
      password: newPassword.value,
    });
    modal.value = "";
    newPassword.value = "";
    repeatPassword.value = "";
    notice("日记口令已更新，恢复码仍可使用。");
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
function setReview(event) {
  data.value.reviews[range.value.key] = {
    text: event.target.value,
    sourceIds: periodEntries.value.map((e) => e.id),
    type: reviewType.value,
    start: range.value.start,
    end: range.value.end,
    updatedAt: new Date().toISOString(),
  };
}
async function saveReview() {
  if (await flush())
    notice(demo.value ? "回顾已留在本次示例中" : "回顾已加密保存。");
}
function visitReview() {
  const due = dueReview.value;
  if (due) {
    reviewType.value = due.type;
    reviewDate.value = due.start;
  }
  go("review");
}
watch([page, reviewDate, reviewType], () => {
  if (page.value === "review" && data.value && periodEntries.value.length) {
    data.value.reviewSeen ||= {};
    if (!data.value.reviewSeen[range.value.key])
      data.value.reviewSeen[range.value.key] = true;
  }
});
function openReview(k) {
  const [type, date] = k.split(":");
  reviewType.value = type;
  reviewDate.value = date;
  go("review");
}
function openAi() {
  chosenIds.value = periodEntries.value.map((e) => e.id);
  openModal("ai");
}
function exportAi() {
  if (!selectedAi.value.length) return;
  download(
    prepareAiText(selectedAi.value, range.value),
    `AI整理素材-${range.value.start}.txt`,
    "text/plain;charset=utf-8",
  );
  notice("已下载所选记录的明文素材，未发送给任何 AI 服务。");
}
let checking = false,
  disposed = false,
  lastChecked = 0;
async function refreshCloud() {
  if (
    !cloud ||
    disposed ||
    checking ||
    !key ||
    dirty.value ||
    busy.value ||
    photoBusy.value ||
    covered.value ||
    document.hidden ||
    modal.value ||
    savePromise
  )
    return;
  checking = true;
  lastChecked = Date.now();
  const previous = envelope.value,
    ticket = generation,
    sessionKey = key;
  try {
    if ((await cloud.readRevision()) === previous.revision) {
      if (!disposed && !dirty.value && key === sessionKey)
        saveStatus.value = savedLabel;
      return;
    }
    const latest = await readVault();
    const updated = await decryptData(sessionKey, latest);
    if (
      disposed ||
      !key ||
      sessionKey !== key ||
      envelope.value !== previous ||
      generation !== ticket ||
      busy.value ||
      dirty.value ||
      photoBusy.value ||
      modal.value
    )
      return;
    hydrating = true;
    try {
      data.value = updated;
      envelope.value = latest;
    } finally {
      hydrating = false;
    }
    saveStatus.value = savedLabel;
  } catch (e) {
    if (!disposed && key === sessionKey && !dirty.value)
      saveStatus.value =
        e.status === 403 ? "口令已变更，请锁定后重新登录" : "暂未取得云端更新";
  } finally {
    checking = false;
  }
}
function onActivity() {
  lastActive = Date.now();
}
function onVisibility() {
  if (!active.value) return;
  if (document.hidden) {
    covered.value = true;
    clearTimeout(coverTimer);
    coverTimer = setTimeout(lock, 60000);
    flush();
  }
}
function onBeforeLeave(event) {
  if (!demo.value && (dirty.value || photoBusy.value)) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(async () => {
  try {
    if (props.cloudSession) {
      const { opened, stored } = props.cloudSession;
      activate(opened.data, opened.key, stored);
    } else if (demo.value) activate(createDemo(), null, null);
    else {
      envelope.value = await readVault();
      if (!crypto.subtle)
        error.value = "当前环境不支持安全加密，请通过 HTTPS 或本机预览打开。";
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("beforeunload", onBeforeLeave);
  for (const event of ["pointerdown", "keydown", "touchstart"])
    window.addEventListener(event, onActivity, { passive: true });
  idleTimer = setInterval(() => {
    if (active.value && !demo.value && Date.now() - lastActive > IDLE_MS)
      lock();
    else if (cloud && Date.now() - lastChecked > 30000) refreshCloud();
  }, 10000);
});
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(saveTimer);
  clearTimeout(toastTimer);
  clearTimeout(coverTimer);
  clearInterval(idleTimer);
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("beforeunload", onBeforeLeave);
  for (const e of ["pointerdown", "keydown", "touchstart"])
    window.removeEventListener(e, onActivity);
});
</script>

<template>
  <div class="diary-surface" :class="{ 'diary-integrated': !preview }">
    <a class="skip-link" href="#main" @click.prevent="focusMain"
      >跳到日记正文</a
    >
    <div v-if="preview || demo" class="preview-bar">
      <span
        ><span class="preview-dot"></span
        >{{
          demo
            ? "示例体验 · 内容为虚构，刷新后恢复示例"
            : "独立预览 · 加密保存在当前浏览器，尚未接入云同步"
        }}</span
      ><button @click="openModal('about')">
        {{ preview ? "预览说明" : "日记说明" }} <Icon name="right" :size="12" />
      </button>
    </div>
    <header v-if="preview" class="site-header">
      <div class="site-header-inner">
        <a class="brand" href="http://127.0.0.1:5176/?entry=life"
          ><Icon name="heart" :size="22" /><span>Aosen & 小悦</span></a
        >
        <nav class="family-nav" aria-label="家庭网站导航">
          <a href="http://127.0.0.1:5176/?entry=life">生活</a><span>理财</span
          ><span>画廊</span><span>旅行</span
          ><a class="active" :href="demo ? '?demo=1' : './'" aria-current="page"
            >日记</a
          >
        </nav>
        <span class="family-caption">属于我们的日常</span>
      </div>
    </header>
    <main id="main" tabindex="-1">
      <div v-if="loading" class="loading-state" role="status">
        正在打开日记…
      </div>
      <template v-else-if="!active">
        <section class="vault-gate">
          <div class="gate-copy">
            <span class="eyebrow">PRIVATE JOURNAL</span>
            <h1>把日子，<br />留给自己。</h1>
            <p>一句话，一张照片。<br />写下的，慢慢成为生活的来路。</p>
            <div class="gate-assurance">
              <Icon name="shield" /><span
                >正文、照片和草稿<br /><strong
                  >都在设备上加密后保存</strong
                ></span
              >
            </div>
            <button class="text-button" @click="startDemo">
              先看看示例 <Icon name="arrow" :size="16" />
            </button>
          </div>
          <form
            v-if="!envelope"
            class="gate-form panel"
            @submit.prevent="setup"
          >
            <div class="round-icon"><Icon name="book" :size="25" /></div>
            <h2>建立自己的日记</h2>
            <p class="muted">设置一次，以后用日记口令解锁。</p>
            <label for="diary-name">称呼</label
            ><input
              id="diary-name"
              v-model="name"
              maxlength="40"
              autocomplete="off"
              required
            /><label for="new-secret">日记口令</label
            ><input
              id="new-secret"
              v-model="secret"
              type="password"
              autocomplete="new-password"
              placeholder="至少 12 个字符"
              required
              minlength="12"
            /><label for="repeat-secret">再输入一次</label
            ><input
              id="repeat-secret"
              v-model="repeatSecret"
              type="password"
              autocomplete="new-password"
              required
            />
            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <button class="primary wide" :disabled="busy">
              {{ busy ? "正在准备加密…" : "建立加密日记" }}
              <Icon name="arrow" :size="17" /></button
            ><label class="file-link"
              >已有备份？导入日记<input
                type="file"
                accept=".json,application/json"
                @change="chooseBackup"
                :disabled="busy"
            /></label>
            <p class="small muted">
              本机存储不会跨设备同步，请定期下载加密备份。
            </p>
          </form>
          <form v-else class="gate-form panel" @submit.prevent="unlock">
            <div class="round-icon"><Icon name="lock" :size="25" /></div>
            <h2>欢迎回来</h2>
            <p class="muted">解锁后，从今天继续。</p>
            <label for="unlock-secret">{{
              recoveryMode ? "恢复码" : "日记口令"
            }}</label
            ><input
              id="unlock-secret"
              v-model="secret"
              :type="recoveryMode ? 'text' : 'password'"
              :autocomplete="recoveryMode ? 'off' : 'current-password'"
              required
            />
            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <button class="primary wide" :disabled="busy">
              {{ busy ? "正在解锁…" : "打开我的日记" }}
              <Icon name="arrow" :size="17" /></button
            ><button
              class="text-button"
              type="button"
              @click="
                recoveryMode = !recoveryMode;
                secret = '';
                error = '';
              "
            >
              {{ recoveryMode ? "使用日记口令" : "使用恢复码解锁" }}
            </button>
            <div class="gate-extra">
              <button type="button" class="text-button" @click="backup">
                导出加密备份</button
              ><label class="file-link"
                >导入备份<input
                  type="file"
                  accept=".json,application/json"
                  @change="chooseBackup"
                  :disabled="busy"
              /></label>
            </div>
          </form>
        </section>
      </template>
      <section v-else-if="covered" class="cover-panel panel">
        <div class="round-icon"><Icon name="lock" :size="28" /></div>
        <h1>日记已暂时遮盖</h1>
        <p>回来以后，接着写。</p>
        <p v-if="storageError" class="error">
          {{ storageError }} 内容仍保留在本页面。
        </p>
        <button class="primary" @click="keepWriting">
          继续 <Icon name="arrow" :size="16" /></button
        ><button
          v-if="!demo"
          class="text-button"
          :disabled="busy"
          @click="lock"
        >
          锁定日记
        </button>
      </section>
      <template v-else>
        <div class="page-top">
          <div>
            <span class="eyebrow">MY JOURNAL</span>
            <h1>
              日记<span class="name-caption"
                >{{ cloud ? cloudSession.account : data.name }} 的私人空间</span
              >
            </h1>
          </div>
          <div class="top-actions">
            <span class="privacy-chip"
              ><Icon name="shield" :size="14" />{{
                demo ? "示例体验" : "仅自己可读"
              }}</span
            ><button
              class="icon-button"
              :disabled="busy || photoBusy"
              aria-label="锁定日记"
              @click="lock"
            >
              <Icon name="lock" /></button
            ><button
              class="icon-button"
              aria-label="日记设置"
              @click="openModal('settings')"
            >
              <Icon name="dots" />
            </button>
          </div>
        </div>
        <div class="page-toolbar">
          <nav class="diary-tabs" aria-label="日记功能">
            <button
              :class="{ active: page === 'write' }"
              :aria-current="page === 'write' ? 'page' : undefined"
              @click="go('write')"
            >
              <Icon name="pen" :size="16" />写下</button
            ><button
              :class="{ active: page === 'browse' }"
              :aria-current="page === 'browse' ? 'page' : undefined"
              @click="go('browse')"
            >
              <Icon name="book" :size="16" />回看</button
            ><button
              :class="{ active: page === 'review' }"
              :aria-current="page === 'review' ? 'page' : undefined"
              @click="visitReview"
            >
              <Icon name="calendar" :size="16" />回顾<span
                v-if="dueReview"
                class="review-dot"
                aria-hidden="true"
              ></span>
            </button>
          </nav>
          <span
            class="save-status"
            :class="{ failed: storageError }"
            role="status"
            ><Icon :name="dirty ? 'clock' : 'check'" :size="14" />{{
              saveStatus
            }}</span
          >
        </div>
        <div v-if="storageError" class="error storage-error" role="alert">
          {{ storageError
          }}<button class="text-button" @click="flush">重试保存</button
          ><button class="text-button" @click="backup">导出当前加密副本</button
          ><button class="text-button" @click="openModal('reload')">
            读取最新日记
          </button>
        </div>

        <div v-if="page === 'write'" class="writing-layout">
          <section class="writing-paper panel" aria-label="写日记">
            <div class="paper-date">
              <div>
                <span class="eyebrow">{{
                  data.draft.id ? "EDITING" : "TODAY"
                }}</span>
                <h2>{{ dateHeading }}</h2>
                <span class="weekday">{{ weekday }}</span>
              </div>
              <label class="date-picker" title="更改日期"
                ><Icon name="calendar" :size="17" /><span>日期</span
                ><input
                  aria-label="日记日期"
                  type="date"
                  v-model="data.draft.date"
                  :max="today()"
                  @change="data.draft.date = data.draft.date || today()"
                  required
              /></label>
            </div>
            <label class="sr-only" for="diary-text">日记正文</label
            ><textarea
              id="diary-text"
              v-model="data.draft.text"
              maxlength="50000"
              placeholder="直接写在这里…"
              spellcheck="false"
              :disabled="busy"
              @keydown.ctrl.enter.prevent="publish"
              @keydown.meta.enter.prevent="publish"
            ></textarea>
            <div v-if="data.draft.photos.length" class="draft-photos">
              <figure v-for="(photo, i) in data.draft.photos" :key="photo">
                <img :src="photo" :alt="`日记照片 ${i + 1}`" /><button
                  class="icon-button"
                  :aria-label="`移除照片 ${i + 1}`"
                  @click="data.draft.photos.splice(i, 1)"
                >
                  <Icon name="close" :size="15" />
                </button>
              </figure>
            </div>
            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <div class="paper-actions">
              <label class="photo-control"
                ><Icon name="image" :size="19" /><span>{{
                  photoBusy ? "正在整理照片…" : "添加照片"
                }}</span
                ><input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  @change="addPhotos"
                  :disabled="
                    photoBusy || busy || data.draft.photos.length >= 4
                  " /></label
              ><button
                class="primary"
                @click="publish"
                :disabled="photoBusy || busy || !hasDraft"
              >
                {{ data.draft.id ? "保存修改" : "留在日记" }}
                <Icon name="arrow" :size="17" />
              </button>
            </div>
            <div class="paper-foot">
              <span>{{
                demo
                  ? "示例内容不会保存到你的日记"
                  : "草稿自动加密保存，稍后可以继续"
              }}</span
              ><span class="keyboard-hint">Ctrl + Enter 保存</span>
            </div>
          </section>
          <aside class="writing-aside">
            <div class="aside-heading">
              <h2>{{ memory ? "翻回一页" : "最近写下" }}</h2>
              <button class="text-button" @click="go('browse')">
                全部 <Icon name="right" :size="14" />
              </button>
            </div>
            <button
              v-if="memory"
              class="memory-card panel"
              @click="viewEntry(memory)"
            >
              <img
                v-if="photoOf(memory)"
                :src="photoOf(memory)"
                alt="曾经记录的照片"
              /><span class="memory-content"
                ><span class="small muted">{{ dateText(memory.date) }}</span
                ><strong>{{ titleOf(memory) }}</strong
                ><span class="excerpt">{{ memory.text }}</span
                ><span class="text-button"
                  >看看当时的自己 <Icon name="arrow" :size="15" /></span
              ></span>
            </button>
            <div v-else-if="entries.length" class="recent-stack">
              <button
                v-for="entry in entries.slice(0, 3)"
                :key="entry.id"
                class="recent-item panel"
                @click="viewEntry(entry)"
              >
                <div>
                  <span class="small muted">{{ dateText(entry.date) }}</span
                  ><strong>{{ titleOf(entry) }}</strong
                  ><span class="excerpt">{{ entry.text }}</span>
                </div>
                <img
                  v-if="photoOf(entry)"
                  :src="photoOf(entry)"
                  alt="日记照片"
                />
              </button>
            </div>
            <div v-else class="empty-aside panel">
              <Icon name="leaf" :size="27" />
              <p>写下的日子<br />会慢慢留在这里。</p>
            </div>
            <button class="review-invite" @click="visitReview">
              <span class="round-icon small-icon"
                ><Icon name="calendar" :size="19" /></span
              ><span
                ><strong>{{
                  dueReview
                    ? dueReview.type === "month"
                      ? "上个月，已经可以回顾"
                      : "上一周，已经可以回顾"
                    : "把日子，翻一翻"
                }}</strong
                ><small>{{
                  dueReview
                    ? "解锁后已在本地整理，随时翻开"
                    : "看看这一周、这个月留下了什么"
                }}</small></span
              ><Icon name="right" :size="16" />
            </button>
            <p class="quiet-note">
              <Icon name="lock" :size="13" />{{
                demo ? "正在浏览虚构示例" : "私人内容，不进入家庭共享记录"
              }}
            </p>
          </aside>
        </div>

        <section v-else-if="page === 'browse'" class="browse-page">
          <div class="section-title">
            <div>
              <h2>写过的日子</h2>
              <p>随时回来，翻到任意一页。</p>
            </div>
            <button
              class="text-button"
              :aria-pressed="favoriteOnly"
              @click="favoriteOnly = !favoriteOnly"
            >
              <Icon name="bookmark" :size="17" />{{
                favoriteOnly ? "查看全部" : "只看收藏"
              }}
            </button>
          </div>
          <div class="browse-controls">
            <label class="search-field"
              ><Icon name="search" :size="18" /><input
                v-model="search"
                aria-label="搜索日记"
                placeholder="搜索文字或日期" /></label
            ><label class="month-field"
              ><span class="sr-only">按月份查看</span
              ><input
                type="month"
                v-model="monthFilter"
                aria-label="按月份查看" /></label
            ><button
              class="secondary icon-label"
              :aria-expanded="calendarOpen"
              @click="calendarOpen = !calendarOpen"
            >
              <Icon name="calendar" :size="18" /><span>月历</span></button
            ><button
              v-if="search || monthFilter || favoriteOnly || selectedDay"
              class="text-button"
              @click="
                search = '';
                monthFilter = '';
                favoriteOnly = false;
                selectedDay = '';
              "
            >
              清除筛选
            </button>
          </div>
          <div v-if="calendarOpen" class="calendar-panel panel">
            <div class="calendar-top">
              <button
                class="icon-button"
                aria-label="上个月"
                @click="
                  calendarMonth = movePeriod(
                    calendarMonth + '-01',
                    'month',
                    -1,
                  ).slice(0, 7)
                "
              >
                <Icon name="left" :size="17" /></button
              ><strong>{{ calendarMonth.replace("-", " 年 ") }} 月</strong
              ><button
                class="icon-button"
                aria-label="下个月"
                @click="
                  calendarMonth = movePeriod(
                    calendarMonth + '-01',
                    'month',
                    1,
                  ).slice(0, 7)
                "
              >
                <Icon name="right" :size="17" />
              </button>
            </div>
            <div class="calendar-grid">
              <span
                v-for="day in ['一', '二', '三', '四', '五', '六', '日']"
                :key="day"
                >{{ day }}</span
              ><button
                v-for="date in calendar"
                :key="date"
                :class="{
                  dim: !date.startsWith(calendarMonth),
                  selected: selectedDay === date,
                  recorded: recordedDays.has(date),
                }"
                :aria-label="`${date}${recordedDays.has(date) ? '，有日记' : ''}`"
                @click="
                  selectedDay = selectedDay === date ? '' : date;
                  monthFilter = '';
                "
              >
                <span>{{ Number(date.slice(-2)) }}</span
                ><i v-if="recordedDays.has(date)"></i>
              </button>
            </div>
            <p class="small muted">小圆点代表留下过记录，空白也很好。</p>
          </div>
          <div v-if="selectedDay" class="day-filter">
            {{ dateText(selectedDay, true) }}
            <button
              class="icon-button"
              aria-label="清除日期筛选"
              @click="selectedDay = ''"
            >
              <Icon name="close" :size="14" />
            </button>
          </div>
          <div v-if="groups.length" class="journal-timeline">
            <section
              v-for="group in groups"
              :key="group.date"
              class="day-group"
            >
              <h3>{{ dateText(group.date, true) }}</h3>
              <div class="entry-grid">
                <article
                  v-for="entry in group.items"
                  :key="entry.id"
                  class="entry-card panel"
                >
                  <button class="entry-open" @click="viewEntry(entry)">
                    <img
                      v-if="photoOf(entry)"
                      :src="photoOf(entry)"
                      alt="日记照片"
                      loading="lazy"
                    />
                    <div>
                      <h4>{{ titleOf(entry) }}</h4>
                      <p class="excerpt">{{ entry.text }}</p>
                    </div>
                  </button>
                  <div class="entry-footer">
                    <button class="text-button" @click="viewEntry(entry)">
                      翻开这一篇 <Icon name="arrow" :size="14" /></button
                    ><button
                      class="icon-button"
                      :class="{ starred: entry.starred }"
                      :aria-label="
                        (entry.starred ? '取消收藏：' : '收藏：') +
                        titleOf(entry)
                      "
                      :aria-pressed="entry.starred"
                      @click="entry.starred = !entry.starred"
                    >
                      <Icon name="bookmark" :size="18" />
                    </button>
                  </div>
                </article>
              </div>
            </section>
          </div>
          <div v-else class="empty panel">
            <Icon name="book" :size="35" />
            <h3>
              {{ entries.length ? "没有找到这段记录" : "第一页，留给今天" }}
            </h3>
            <p>
              {{
                entries.length
                  ? "试试换个关键词，或清除筛选。"
                  : "直接写一点，日记就开始了。"
              }}
            </p>
            <button class="primary" @click="go('write')">
              去写日记 <Icon name="pen" :size="16" />
            </button>
          </div>
        </section>

        <section v-else class="review-page">
          <div class="section-title">
            <div>
              <h2>让日子，有回声</h2>
              <p>把零散的记录，慢慢收成一页。</p>
            </div>
            <span class="privacy-chip"
              ><Icon name="shield" :size="14" />本地整理</span
            >
          </div>
          <div class="review-controls">
            <div class="segmented">
              <button
                :class="{ active: reviewType === 'week' }"
                :aria-pressed="reviewType === 'week'"
                @click="reviewType = 'week'"
              >
                周回顾</button
              ><button
                :class="{ active: reviewType === 'month' }"
                :aria-pressed="reviewType === 'month'"
                @click="reviewType = 'month'"
              >
                月回顾
              </button>
            </div>
            <div class="period-picker">
              <button
                class="icon-button"
                aria-label="上一时段"
                @click="reviewDate = movePeriod(reviewDate, reviewType, -1)"
              >
                <Icon name="left" :size="17" /></button
              ><span
                >{{ dateText(range.start) }} — {{ dateText(range.end) }}</span
              ><button
                class="icon-button"
                aria-label="下一时段"
                :disabled="range.end >= today()"
                @click="reviewDate = movePeriod(reviewDate, reviewType, 1)"
              >
                <Icon name="right" :size="17" /></button
              ><button class="text-button" @click="reviewDate = today()">
                现在
              </button>
            </div>
          </div>
          <article class="recap-paper panel">
            <div class="recap-top">
              <span class="eyebrow">{{
                reviewType === "week"
                  ? "A WEEK IN MY LIFE"
                  : "A MONTH IN MY LIFE"
              }}</span
              ><Icon name="leaf" :size="24" />
            </div>
            <h3>{{ reviewLabel }}，留在这里。</h3>
            <p v-if="periodEntries.length" class="recap-intro">
              在
              {{ new Set(periodEntries.map((e) => e.date)).size }}
              个日子里，留下了
              {{ periodEntries.length }}
              篇记录。下面是收藏优先、按日期整理的片段。
            </p>
            <p v-else class="recap-intro">
              这段时间还没有记录。下一次写下的时候，再回来看看。
            </p>
            <div class="recap-highlights">
              <button
                v-for="entry in reviewHighlights"
                :key="entry.id"
                @click="viewEntry(entry)"
              >
                <img
                  v-if="photoOf(entry)"
                  :src="photoOf(entry)"
                  alt="回顾中的日记照片"
                /><span v-else class="text-snapshot"
                  ><Icon name="pen" :size="23" /><span>{{
                    entry.text.slice(0, 60)
                  }}</span></span
                ><small>{{ dateText(entry.date) }}</small
                ><strong>{{ titleOf(entry) }}</strong>
              </button>
            </div>
            <details v-if="periodEntries.length" class="period-all">
              <summary>
                这段时间的全部记录 · {{ periodEntries.length }} 篇
              </summary>
              <button
                v-for="entry in periodEntries"
                :key="entry.id"
                @click="viewEntry(entry)"
              >
                <time>{{ entry.date }}</time
                ><span>{{ titleOf(entry) }}</span
                ><Icon name="right" :size="14" />
              </button>
            </details>
            <div v-if="weeklyNotes.length" class="weekly-notes">
              <h4>这个月，曾经写给自己的话</h4>
              <blockquote v-for="[k, note] in weeklyNotes" :key="k">
                <p>{{ note.text }}</p>
                <small
                  >{{ dateText(note.start) }} — {{ dateText(note.end) }}</small
                >
              </blockquote>
            </div>
            <div class="review-writing">
              <label for="review-text"
                >给{{ reviewLabel }}留一句自己的总结</label
              ><textarea
                id="review-text"
                :value="reviewText"
                @input="setReview"
                rows="4"
                maxlength="10000"
                placeholder="写在这里…"
              ></textarea>
              <div class="form-bottom">
                <span class="small muted">{{
                  demo ? "示例内保留" : "文字与日记一起加密保存"
                }}</span
                ><button
                  class="primary"
                  :disabled="
                    busy || (!reviewText.trim() && !data.reviews[range.key])
                  "
                  @click="saveReview"
                >
                  保存回顾 <Icon name="check" :size="16" />
                </button>
              </div>
            </div>
          </article>
          <div class="review-bottom">
            <span>素材只在本机整理，不调用外部 AI。</span
            ><button
              class="text-button"
              :disabled="!periodEntries.length"
              @click="openAi"
            >
              选择记录，准备 AI 素材 <Icon name="arrow" :size="15" />
            </button>
          </div>
          <section v-if="savedReviews.length" class="past-reviews">
            <h3>留下的回顾</h3>
            <button
              v-for="[k, review] in savedReviews"
              :key="k"
              class="panel"
              @click="openReview(k)"
            >
              <span
                >{{ review.type === "week" ? "周回顾" : "月回顾" }} ·
                {{ dateText(review.start, true) }}</span
              >
              <p>{{ review.text }}</p>
              <Icon name="right" :size="16" />
            </button>
          </section>
        </section>
      </template>
    </main>
    <footer v-if="preview" class="site-footer">
      Aosen & 小悦的家庭空间 <span>·</span> 日记是留给自己的地方
    </footer>
    <Transition name="toast"
      ><div v-if="toast && !covered" class="toast" role="status">
        <Icon name="check" :size="17" />{{ toast }}
      </div></Transition
    >
    <DialogShell
      v-if="modal && !covered"
      :title="modalTitle"
      :wide="['detail', 'ai'].includes(modal)"
      @close="closeModal"
    >
      <template v-if="modal === 'detail' && selected"
        ><div class="detail-toolbar">
          <span class="muted small">{{ data.name }} · 私人日记</span
          ><button
            class="icon-button"
            :class="{ starred: selected.starred }"
            :aria-pressed="selected.starred"
            aria-label="收藏这篇日记"
            @click="selected.starred = !selected.starred"
          >
            <Icon name="bookmark" :size="19" />
          </button>
        </div>
        <div class="detail-photos">
          <img
            v-for="(photo, i) in selected.photos"
            :key="i"
            :src="photo"
            :alt="`日记照片 ${i + 1}`"
          /><img
            v-if="demo && selected.demoPhoto"
            :src="photoOf(selected)"
            alt="示例照片"
          />
        </div>
        <p class="detail-text">{{ selected.text }}</p>
        <label class="check-label"
          ><input
            type="checkbox"
            :checked="selected.resurface !== false"
            @change="selected.resurface = $event.target.checked"
          />允许这篇出现在「翻回一页」</label
        >
        <div class="detail-actions">
          <button class="secondary" @click="editEntry">
            <Icon name="pen" :size="16" />编辑</button
          ><button
            v-if="selected.versions?.length"
            class="text-button"
            @click="modal = 'history'"
          >
            之前的版本</button
          ><button class="text-button danger" @click="trashEntry">
            移入回收站
          </button>
        </div></template
      >
      <template v-else-if="modal === 'history' && selected"
        ><p class="muted">保留最近 5 次保存前的内容。恢复会先放入写作区。</p>
        <article
          v-for="(version, i) in selected.versions"
          :key="i"
          class="version"
        >
          <time class="small muted">{{ dateText(version.date, true) }}</time>
          <p>{{ version.text }}</p>
          <button class="secondary" @click="restoreVersion(version)">
            放入写作区
          </button>
        </article></template
      >
      <template v-else-if="modal === 'settings'"
        ><div class="settings-status">
          <Icon name="shield" :size="25" />
          <div>
            <strong>{{
              demo ? "当前为示例体验" : "日记已开启设备端加密"
            }}</strong>
            <p>
              {{
                demo
                  ? "所有操作仅保留在本次页面中。"
                  : cloud
                    ? "仅同步本账号的密文，同一账号可在手机和电脑上解锁。"
                    : "保存在此浏览器，未同步到云端。"
              }}
            </p>
          </div>
        </div>
        <p class="muted">
          离开页面先遮盖；离开满 1 分钟或 5 分钟无操作后自动锁定。草稿会先保存。
        </p>
        <div class="settings-list">
          <button v-if="!demo" @click="backup">
            <Icon name="download" />下载加密备份
            <Icon name="right" :size="16" /></button
          ><label v-if="!demo"
            ><Icon name="upload" />导入加密备份
            <Icon name="right" :size="16" /><input
              type="file"
              accept=".json,application/json"
              @change="chooseBackup"
              :disabled="busy" /></label
          ><button v-if="!demo" @click="openModal('password')">
            <Icon name="lock" />修改日记口令
            <Icon name="right" :size="16" /></button
          ><button @click="openModal('trash')">
            <Icon name="trash" />回收站 <span>{{ trash.length }}</span>
          </button>
        </div>
        <button
          v-if="demo && allowPrivate"
          class="primary wide"
          @click="startPrivate"
        >
          建立自己的加密日记 <Icon name="arrow" :size="16" />
        </button>
        <p class="small muted">
          恢复码与口令都丢失时，无法恢复内容。清理浏览器数据前请下载备份。
        </p>
        <p v-if="error" class="error" role="alert">{{ error }}</p></template
      >
      <template v-else-if="modal === 'recovery' && setupPending"
        ><p>恢复码能解锁这本日记。请单独保管，不要发到家庭共享页面。</p>
        <code class="recovery-code">{{ setupPending.recovery }}</code
        ><button
          class="secondary"
          @click="
            download(
              '日记恢复码\n\n' +
                setupPending.recovery +
                '\n\n持有此恢复码及加密备份即可解锁日记，请单独安全保管。',
              '日记恢复码.txt',
              'text/plain',
            )
          "
        >
          <Icon name="download" :size="17" />下载恢复码</button
        ><label class="check-label"
          ><input
            v-model="recoverySaved"
            type="checkbox"
          />我已妥善保存恢复码</label
        >
        <p class="small muted">口令和恢复码都丢失时，无法找回原日记。</p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <div class="dialog-actions">
          <button
            class="primary"
            :disabled="busy || !recoverySaved"
            @click="finishSetup"
          >
            {{ busy ? "正在建立…" : "开始写日记" }}
            <Icon name="arrow" :size="17" />
          </button></div
      ></template>
      <form v-else-if="modal === 'password'" @submit.prevent="updatePassword">
        <p class="muted">恢复码继续有效。以前下载的备份仍使用当时的口令。</p>
        <label for="changed-password">新的日记口令</label
        ><input
          id="changed-password"
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          minlength="12"
          required
        /><label for="changed-password-again">再输入一次</label
        ><input
          id="changed-password-again"
          v-model="repeatPassword"
          type="password"
          autocomplete="new-password"
          required
        />
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <div class="dialog-actions">
          <button class="primary" :disabled="busy">
            {{ busy ? "正在更新…" : "保存新口令" }}
          </button>
        </div>
      </form>
      <template v-else-if="modal === 'import'"
        ><form v-if="!importReady" @submit.prevent="verifyImport">
          <p class="muted">先解锁并验证文件，确认后才会恢复。</p>
          <label for="import-secret">{{
            recoveryMode ? "这份备份的恢复码" : "这份备份的日记口令"
          }}</label
          ><input
            id="import-secret"
            v-model="secret"
            :type="recoveryMode ? 'text' : 'password'"
            autocomplete="off"
            required
          /><button
            class="text-button"
            type="button"
            @click="
              recoveryMode = !recoveryMode;
              secret = '';
            "
          >
            {{ recoveryMode ? "使用口令" : "使用恢复码" }}
          </button>
          <div class="dialog-actions">
            <button class="primary" :disabled="busy">
              {{ busy ? "正在验证…" : "验证备份" }}
            </button>
          </div>
        </form>
        <template v-else
          ><div class="settings-status">
            <Icon name="check" />
            <div>
              <strong>{{ importReady.data.name }} 的日记</strong>
              <p>
                {{
                  importReady.data.entries.filter((e) => !e.deletedAt).length
                }}
                篇记录，含草稿、回顾与回收站
              </p>
            </div>
          </div>
          <p v-if="importRevision !== null" class="error">
            {{
              cloud
                ? "导入将替换当前个人账号的日记，其他设备也会同步。"
                : "导入将替换此浏览器现有日记。"
            }}请先下载现有日记的加密备份。
          </p>
          <button
            v-if="importRevision !== null"
            class="secondary"
            :disabled="busy"
            @click="backup"
          >
            先备份现有日记
          </button>
          <div class="dialog-actions">
            <button class="secondary" @click="closeModal">取消</button
            ><button class="primary" :disabled="busy" @click="confirmImport">
              {{
                busy
                  ? "正在导入…"
                  : importRevision !== null
                    ? "确认替换并导入"
                    : "导入这本日记"
              }}
            </button>
          </div></template
        >
        <p v-if="error" class="error" role="alert">{{ error }}</p></template
      >
      <template v-else-if="modal === 'trash'"
        ><p class="muted">移除的日记仍加密保留在这里，可随时恢复。</p>
        <article v-for="entry in trash" :key="entry.id" class="trash-item">
          <div>
            <small>{{ dateText(entry.date, true) }}</small>
            <p>{{ titleOf(entry) }}</p>
          </div>
          <button class="secondary" @click="recoverEntry(entry)">恢复</button>
        </article>
        <div v-if="!trash.length" class="small-empty">
          回收站是空的。
        </div></template
      >
      <template v-else-if="modal === 'ai'"
        ><p>
          选择这次愿意交给 AI 整理的文字。当前功能<strong
            >只下载素材，不连接外部 AI</strong
          >。
        </p>
        <p class="small muted">
          下载的是明文文件，不包含照片。是否提交给
          AI、提交给哪家服务，由你决定。
        </p>
        <div class="ai-options">
          <button
            class="text-button"
            @click="chosenIds = periodEntries.map((e) => e.id)"
          >
            全选</button
          ><button class="text-button" @click="chosenIds = []">清空</button
          ><span>已选 {{ selectedAi.length }} 篇</span>
        </div>
        <label v-for="entry in periodEntries" :key="entry.id" class="ai-entry"
          ><input type="checkbox" v-model="chosenIds" :value="entry.id" /><span
            ><small>{{ entry.date }}</small
            ><strong>{{ titleOf(entry) }}</strong
            ><span class="excerpt">{{ entry.text }}</span></span
          ></label
        >
        <details v-if="selectedAi.length" class="material-preview">
          <summary>查看即将导出的完整内容</summary>
          <pre>{{ prepareAiText(selectedAi, range) }}</pre>
        </details>
        <div class="dialog-actions">
          <button
            class="primary"
            :disabled="!selectedAi.length"
            @click="exportAi"
          >
            <Icon name="download" :size="17" />下载所选文字与整理说明
          </button>
        </div></template
      >
      <template v-else-if="modal === 'reload'"
        ><p>
          读取最新版本会放下本页未保存的修改。可以先导出当前加密副本，保留这部分内容。
        </p>
        <button class="secondary" @click="backup">导出当前加密副本</button
        ><label class="check-label"
          ><input
            type="checkbox"
            v-model="ackReload"
          />我已备份，或确认放弃本页未保存的修改</label
        >
        <p v-if="error" class="error">{{ error }}</p>
        <div class="dialog-actions">
          <button class="secondary" @click="closeModal">继续当前记录</button
          ><button
            class="primary"
            :disabled="busy || !ackReload"
            @click="discardAndReload"
          >
            读取最新版本并重新解锁
          </button>
        </div></template
      >
      <template v-else-if="modal === 'about'"
        ><div class="about-copy">
          <p>
            {{
              preview
                ? "这是「日记」独立页面的预览。"
                : "这是家庭网站中留给自己的独立日记页面。"
            }}
          </p>
          <p>
            「写下」直接输入，没有引导问题。支持文字、照片、草稿自动保存、搜索、月历、收藏和本地周月回顾。
          </p>
          <p>
            正文、照片、草稿、历史版本和回顾都在设备上加密。使用
            AES-256-GCM，日记口令经 PBKDF2-SHA256
            派生保护密钥。口令与恢复码不会上传。
          </p>
          <p>
            {{
              preview
                ? "独立预览保存在本机浏览器。"
                : "正式网站使用个人日记账号同步密文，同一账号可以在手机和电脑上解锁。"
            }}
            示例内容仅在当前页面保留。AI 素材需自己选择并导出。
          </p>
          <p>请单独保管恢复码，并定期下载加密备份。</p>
          <p v-if="preview">
            <a href="./mobile.html" target="_blank" rel="noopener noreferrer"
              >打开手机尺寸示例预览</a
            >
          </p>
          <p class="small muted">
            示例文字为虚构；示例茶桌和湖边照片沿用「我们这一页」预览素材。
          </p>
        </div>
        <div class="dialog-actions">
          <button class="secondary" @click="closeModal">知道了</button>
        </div></template
      >
    </DialogShell>
  </div>
</template>
