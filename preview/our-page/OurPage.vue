<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import Icon from "./components/Icon.vue";
import DialogShell from "./components/DialogShell.vue";
import MomentCard from "./components/MomentCard.vue";
import AuthorPicker from "./components/AuthorPicker.vue";
import LifePlacement from "./components/LifePlacement.vue";
import {
  PEOPLE,
  STORAGE_KEY,
  makeId,
  today,
  dateLabel,
  weekStart,
  weekEnd,
  createSeed,
  readPreview,
} from "./data.js";

const storageError = ref("");
let initial;
try {
  initial = readPreview(localStorage);
} catch {
  initial = createSeed();
  storageError.value =
    "未能读取已保存的预览记录，暂时展示示例。原记录未覆盖；请在预览说明中导出备份或重置后再保存。";
}
const state = ref(initial);
const viewer = computed(() => state.value.viewer);
const viewerName = computed(() => PEOPLE[viewer.value]);
const page = ref(
  new URLSearchParams(location.search).get("entry") === "life"
    ? "life"
    : "journal",
);
const toast = ref("");
let toastTimer;
function notify(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 4000);
}
function commit(change, message = "") {
  if (storageError.value) {
    notify("请先在预览说明中处理保存问题。");
    return false;
  }
  try {
    // Read the latest snapshot so the desktop and phone preview do not overwrite each other.
    const next = readPreview(localStorage);
    next.viewer = viewer.value;
    if (change(next) === false) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    state.value = next;
    if (message) notify(message);
    return true;
  } catch {
    notify(
      "浏览器空间不足或禁止保存。本次修改尚未保存，请减少照片大小或导出记录后重置。",
    );
    return false;
  }
}
function syncPreview(event) {
  if (event.key !== STORAGE_KEY) return;
  try {
    const latest = readPreview(localStorage);
    latest.viewer = viewer.value;
    state.value = latest;
  } catch {
    storageError.value =
      "另一个窗口的预览记录无法读取。请先导出备份，再恢复示例内容。";
  }
}
onMounted(() => window.addEventListener("storage", syncPreview));
onBeforeUnmount(() => {
  window.removeEventListener("storage", syncPreview);
  clearTimeout(toastTimer);
});
function setViewer(value) {
  if (!PEOPLE[value]) return false;
  if (value === viewer.value) return true;
  return commit((s) => {
    s.viewer = value;
  }, `当前使用者：${PEOPLE[value]}`);
}
function switchViewer(event) {
  if (!setViewer(event.target.value)) event.target.value = viewer.value;
}
function go(value) {
  page.value = value;
  nextTick(() => {
    document.getElementById("page-content")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}
const sortedMoments = computed(() =>
  [...state.value.moments].sort((a, b) => b.date.localeCompare(a.date)),
);
const favoriteMoments = computed(() =>
  sortedMoments.value.filter((m) => m.favorites.length > 0),
);
function remember(moment) {
  commit((s) => {
    const m = s.moments.find((m) => m.id === moment.id);
    m.reactions = m.reactions.includes(viewer.value)
      ? m.reactions.filter((p) => p !== viewer.value)
      : [...m.reactions, viewer.value];
  });
}
function favorite(moment) {
  const wasSaved = moment.favorites.includes(viewer.value);
  commit(
    (s) => {
      const m = s.moments.find((m) => m.id === moment.id);
      m.favorites = m.favorites.includes(viewer.value)
        ? m.favorites.filter((p) => p !== viewer.value)
        : [...m.favorites, viewer.value];
    },
    wasSaved ? "已从你的珍藏中移出" : "已放进你的珍藏",
  );
}

const modal = ref(null);
const selectedId = ref("");
const selectedMoment = computed(() =>
  state.value.moments.find((m) => m.id === selectedId.value),
);
const selectedHeart = computed(() =>
  state.value.hearts.find((h) => h.id === selectedId.value),
);
const form = ref({});
const draftOwner = ref("");
const baseline = ref("");
const replyText = ref("");
const agreementText = ref("");
const editingAgreement = ref(false);
const discardPrompt = ref(false);
const deletePrompt = ref(false);
const photoBusy = ref(false);
const formError = ref("");
const emptyMoment = () => ({
  title: "",
  text: "",
  photo: "",
  date: today(),
  author: viewer.value,
});
const emptyHeart = () => ({
  author: viewer.value,
  event: "",
  feeling: "",
  wish: "",
});
const dirty = computed(
  () =>
    (["moment", "heart-compose"].includes(modal.value) &&
      JSON.stringify(form.value) !== baseline.value) ||
    replyText.value.trim() ||
    agreementText.value.trim(),
);
function closeNow() {
  modal.value = null;
  discardPrompt.value = false;
  deletePrompt.value = false;
  replyText.value = "";
  agreementText.value = "";
  editingAgreement.value = false;
  formError.value = "";
}
function requestClose() {
  if (photoBusy.value) return;
  if (dirty.value) discardPrompt.value = true;
  else closeNow();
}
function composeMoment() {
  draftOwner.value = state.value.momentDrafts[viewer.value] ? viewer.value : "";
  form.value = { ...emptyMoment(), ...state.value.momentDrafts[viewer.value] };
  baseline.value = JSON.stringify(form.value);
  selectedId.value = "";
  modal.value = "moment";
}
function composeHeart() {
  draftOwner.value = state.value.heartDrafts[viewer.value] ? viewer.value : "";
  form.value = { ...emptyHeart(), ...state.value.heartDrafts[viewer.value] };
  baseline.value = JSON.stringify(form.value);
  selectedId.value = "";
  modal.value = "heart-compose";
}
function openMoment(m) {
  selectedId.value = m.id;
  modal.value = "moment-detail";
}
function openHeart(h) {
  selectedId.value = h.id;
  modal.value = "heart-detail";
}
function editMoment() {
  if (replyText.value.trim()) {
    notify("先保存这句回应，再编辑回忆吧。");
    return;
  }
  const m = selectedMoment.value;
  form.value = {
    title: m.title,
    text: m.text,
    photo: m.photo,
    date: m.date,
    author: m.author,
  };
  baseline.value = JSON.stringify(form.value);
  modal.value = "moment";
}
function saveMomentDraft() {
  if (selectedId.value) return;
  if (
    storeDraft(
      "momentDrafts",
      { ...form.value },
      "草稿已留在这个浏览器里，下次继续写",
    )
  )
    closeNow();
}
function storeDraft(collection, content, message) {
  formError.value = "";
  return commit((s) => {
    const author = content.author;
    if (draftOwner.value !== author && s[collection][author]) {
      formError.value = `${PEOPLE[author]} 已有一段草稿。可以直接保存当前内容，或先处理那段草稿。`;
      return false;
    }
    s[collection][author] = content;
    if (draftOwner.value && draftOwner.value !== author)
      delete s[collection][draftOwner.value];
    s.viewer = author;
  }, message);
}
function saveMoment() {
  formError.value = "";
  if (!form.value.text.trim() || !PEOPLE[form.value.author]) {
    formError.value = "选好记录人，再留下一句话吧。";
    return;
  }
  if (!form.value.date || form.value.date > today()) {
    formError.value = "请选择今天或之前的日期。";
    return;
  }
  const content = {
    ...form.value,
    author: selectedId.value ? selectedMoment.value.author : form.value.author,
    title: form.value.title.trim() || form.value.text.trim().slice(0, 24),
    text: form.value.text.trim(),
  };
  const ok = commit(
    (s) => {
      if (selectedId.value)
        Object.assign(
          s.moments.find((m) => m.id === selectedId.value),
          content,
          { sample: false },
        );
      else
        s.moments.unshift({
          ...content,
          id: makeId(),
          author: form.value.author,
          sample: false,
          reactions: [],
          favorites: [],
          replies: [],
        });
      if (!selectedId.value && draftOwner.value)
        delete s.momentDrafts[draftOwner.value];
      s.viewer = content.author;
    },
    selectedId.value ? "这段回忆已更新" : "这一刻，好好留下了",
  );
  if (ok) {
    closeNow();
    page.value = "journal";
  }
}
async function uploadPhoto(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    formError.value = "请选择 JPG、PNG 或 WebP 照片。";
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    formError.value = "照片太大，请选择 12 MB 以内的照片。";
    return;
  }
  photoBusy.value = true;
  formError.value = "";
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    form.value.photo = canvas.toDataURL("image/jpeg", 0.76);
  } catch {
    formError.value = "这张照片没能打开，请换一张试试。";
  } finally {
    bitmap?.close();
    photoBusy.value = false;
  }
}
function addReply(kind) {
  const text = replyText.value.trim();
  if (!text) return;
  const ok = commit((s) => {
    const item = s[kind === "moment" ? "moments" : "hearts"].find(
      (m) => m.id === selectedId.value,
    );
    item.replies.push({ id: makeId(), author: viewer.value, text });
  }, "你的话已留下");
  if (ok) replyText.value = "";
}
function deleteMoment() {
  if (
    commit((s) => {
      s.moments = s.moments.filter((m) => m.id !== selectedId.value);
    }, "这段回忆已删除")
  )
    closeNow();
}
function saveHeart(draft) {
  formError.value = "";
  if (!PEOPLE[form.value.author]) {
    formError.value = "请选择写下这段话的人。";
    return;
  }
  const content = Object.fromEntries(
    Object.entries(form.value).map(([k, v]) => [k, v.trim()]),
  );
  if (!draft && (!content.event || !content.feeling || !content.wish)) {
    formError.value = "请补充发生的事、你的感受和希望，方便对方理解。";
    return;
  }
  if (draft) {
    if (
      storeDraft("heartDrafts", content, "草稿已保存，你可以准备好后再共享")
    ) {
      closeNow();
      page.value = "heart";
    }
    return;
  }
  const ok = commit((s) => {
    s.hearts.unshift({
      id: makeId(),
      author: viewer.value,
      date: today(),
      ...content,
      replies: [],
      agreement: null,
      sample: false,
    });
    if (draftOwner.value) delete s.heartDrafts[draftOwner.value];
    s.viewer = form.value.author;
  }, "心里话已放到两个人的页面里");
  if (ok) {
    closeNow();
    page.value = "heart";
  }
}
function proposeAgreement() {
  const text = agreementText.value.trim();
  if (!text) return;
  if (
    commit((s) => {
      const h = s.hearts.find((h) => h.id === selectedId.value);
      if (h.agreement) {
        h.agreementHistory ||= [];
        h.agreementHistory.push({ ...h.agreement, date: today() });
      }
      h.agreement = {
        text,
        proposer: viewer.value,
        accepted: [],
        outcomes: {},
        archived: false,
      };
    }, "小约定已提出，双方都可以选择是否接受")
  ) {
    agreementText.value = "";
    editingAgreement.value = false;
  }
}
function acceptAgreement() {
  commit((s) => {
    const a = s.hearts.find((h) => h.id === selectedId.value).agreement;
    const retracting = a.accepted.includes(viewer.value);
    a.accepted = retracting
      ? a.accepted.filter((p) => p !== viewer.value)
      : [...a.accepted, viewer.value];
    if (retracting) {
      a.outcomes = {};
      a.archived = false;
    }
  });
}
function outcome(value) {
  commit((s) => {
    const a = s.hearts.find((h) => h.id === selectedId.value).agreement;
    a.outcomes[viewer.value] = value;
    a.archived =
      a.accepted.length === 2 &&
      Object.keys(PEOPLE).every((p) => a.outcomes[p] === "better");
  }, "感受已记录，可以随时调整");
}
function heartStatus(h) {
  if (!h.agreement) return "想聊聊";
  if (h.agreement.archived) return "我们都觉得好些了";
  if (Object.values(h.agreement.outcomes).includes("adjust"))
    return "还需要调整";
  if (h.agreement.accepted.length === 2) return "一起试试看";
  return "有一个小提议";
}
function removeHeartDraft() {
  if (
    commit((s) => {
      delete s.heartDrafts[viewer.value];
    }, "草稿已移除")
  )
    closeNow();
}

const selectedWeek = ref(weekStart(sortedMoments.value[0]?.date || today()));
const weeks = computed(() =>
  [
    ...new Set([
      weekStart(today()),
      ...state.value.moments.map((m) => weekStart(m.date)),
      ...Object.keys(state.value.letters),
    ]),
  ]
    .sort()
    .reverse(),
);
const weekMoments = computed(() =>
  sortedMoments.value.filter((m) => weekStart(m.date) === selectedWeek.value),
);
const weekSelection = computed(() => weekMoments.value.slice(0, 3));
const weeklyWords = ref("");
watch(
  [viewer, selectedWeek, () => state.value.letters],
  () => {
    weeklyWords.value =
      state.value.weekDrafts?.[selectedWeek.value]?.[viewer.value] ??
      state.value.letters[selectedWeek.value]?.notes?.[viewer.value] ??
      "";
  },
  { immediate: true, deep: true },
);
const weekDate = computed(
  () =>
    `${dateLabel(selectedWeek.value)} — ${dateLabel(weekEnd(selectedWeek.value))}`,
);
function saveWeeklyDraft(event) {
  weeklyWords.value = event.target.value;
  commit((s) => {
    s.weekDrafts ||= {};
    s.weekDrafts[selectedWeek.value] ||= {};
    s.weekDrafts[selectedWeek.value][viewer.value] = weeklyWords.value;
  });
}
function saveLetter() {
  commit((s) => {
    const letter = (s.letters[selectedWeek.value] ||= {});
    letter.notes ||= {};
    letter.notes[viewer.value] = weeklyWords.value.trim();
    if (s.weekDrafts?.[selectedWeek.value])
      delete s.weekDrafts[selectedWeek.value][viewer.value];
  }, "给这一周的话，已好好留下");
}
function printLetter() {
  window.print();
}
function exportPreview() {
  const raw = storageError.value
    ? localStorage.getItem(STORAGE_KEY) || JSON.stringify(state.value, null, 2)
    : JSON.stringify(state.value, null, 2);
  const url = URL.createObjectURL(
    new Blob([raw], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "我们这一页-预览备份.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function resetPreview() {
  try {
    const seed = createSeed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    state.value = seed;
    storageError.value = "";
    closeNow();
    page.value = "journal";
    selectedWeek.value = "2026-10-19";
    notify("已恢复示例内容");
  } catch {
    notify("浏览器禁止保存。请允许此页面使用本地存储后重试。");
  }
}
const modalTitle = computed(
  () =>
    ({
      moment: selectedId.value ? "再补一点细节" : "留住这一刻",
      "moment-detail": selectedMoment.value?.title,
      "heart-compose": "我有一句心里话",
      "heart-detail": "慢慢说，我们都在听",
      info: "关于这次预览",
      "draft-delete": "放下这段草稿？",
    })[modal.value],
);
</script>

<template>
  <div class="preview-bar">
    <span
      ><span class="preview-dot"></span>独立功能预览
      <span class="preview-description">· 照片与初始内容均为示例</span></span
    ><button @click="modal = 'info'">
      <Icon name="info" :size="14" />预览说明
    </button>
  </div>
  <div v-if="storageError" class="storage-alert" role="alert">
    {{ storageError }} <button @click="modal = 'info'">处理保存问题</button>
  </div>
  <header class="site-header">
    <div class="site-header-inner">
      <button class="brand" aria-label="返回生活首页" @click="go('life')">
        <Icon name="heart" :size="23" /><span>Aosen & 小悦</span>
      </button>
      <nav class="family-nav" aria-label="家庭网站导航">
        <button class="active" aria-current="page" @click="go('life')">
          生活</button
        ><span title="本次预览仅展示生活模块">理财</span
        ><span title="本次预览仅展示生活模块">画廊</span
        ><span title="本次预览仅展示生活模块">旅行</span>
      </nav>
      <span class="preview-tag">功能预览</span>
    </div>
  </header>
  <main id="page-content" class="main-shell" tabindex="-1">
    <LifePlacement
      v-if="page === 'life'"
      :latest="sortedMoments[0]"
      @open="go('journal')"
      @compose="composeMoment"
    />
    <template v-else>
      <nav class="breadcrumb" aria-label="当前位置">
        <button @click="go('life')">生活</button
        ><Icon name="chevron" :size="14" /><button
          v-if="page !== 'journal'"
          @click="go('journal')"
        >
          我们这一页</button
        ><span v-else>我们这一页</span
        ><template v-if="page !== 'journal'"
          ><Icon name="chevron" :size="14" /><span>{{
            { weekly: "每周回顾", favorites: "珍藏", heart: "心里话" }[page]
          }}</span></template
        >
      </nav>
      <header class="module-header">
        <div>
          <h1>我们这一页</h1>
          <p>记住小事，也听见彼此。</p>
        </div>
        <button class="primary-button" @click="composeMoment">
          <Icon name="plus" :size="18" />留住这一刻
        </button>
      </header>
      <div class="module-toolbar">
        <nav class="module-tabs" aria-label="我们的日常">
          <button :class="{ active: page !== 'heart' }" @click="go('journal')">
            日常</button
          ><button :class="{ active: page === 'heart' }" @click="go('heart')">
            心里话
          </button>
        </nav>
        <label class="viewer-switch"
          ><span>当前使用者</span
          ><select :value="viewer" @change="switchViewer">
            <option value="aosen">Aosen</option>
            <option value="xiaoyue">小悦</option>
          </select></label
        >
      </div>
    </template>
    <template v-if="page === 'journal'">
      <button
        v-if="state.momentDrafts[viewer]"
        class="draft-banner"
        @click="composeMoment"
      >
        <Icon name="pen" :size="17" />有一段没写完的回忆，继续写
        <Icon name="arrow" :size="16" />
      </button>
      <section class="journal-section" aria-labelledby="journal-heading">
        <div class="section-heading">
          <div>
            <h2 id="journal-heading">那天的小事</h2>
          </div>
          <div class="section-links">
            <button class="text-button" @click="go('weekly')">
              <Icon name="calendar" :size="17" />每周回顾</button
            ><button class="text-button" @click="go('favorites')">
              <Icon name="bookmark" :size="17" />珍藏
            </button>
          </div>
        </div>
        <div v-if="sortedMoments.length" class="moments-grid">
          <MomentCard
            v-for="moment in sortedMoments"
            :key="moment.id"
            :moment="moment"
            :viewer="viewer"
            @open="openMoment"
            @remember="remember"
            @favorite="favorite"
          />
        </div>
        <div v-else class="empty-state">
          <Icon name="book" :size="36" />
          <h3>这一页，等你慢慢写。</h3>
          <p>没有大事发生的日子，也可以留下一句喜欢。</p>
          <button class="primary-button" @click="composeMoment">
            写下第一件小事
          </button>
        </div>
      </section>
    </template>

    <template v-else-if="page === 'weekly'">
      <div class="page-heading">
        <h2>这一周，想留给你</h2>
        <p>每周自动留下最近三件小事，随时回来看看。</p>
      </div>
      <div class="weekly-toolbar">
        <label
          >翻到这一周
          <select v-model="selectedWeek">
            <option v-for="week in weeks" :key="week" :value="week">
              {{ dateLabel(week, true) }} 起
            </option>
          </select></label
        >
      </div>
      <article class="weekly-letter" id="weekly-letter">
        <div class="letter-topline">
          <span>AOSEN & 小悦</span><span>OUR LITTLE DAYS</span>
        </div>
        <span class="eyebrow">{{ weekDate }}</span>
        <h2>日子很平常，<br />有你就值得收藏。</h2>
        <div v-if="weekSelection.length" class="letter-moments">
          <button
            v-for="m in weekSelection"
            :key="m.id"
            class="letter-moment"
            @click="openMoment(m)"
          >
            <img
              v-if="m.photo"
              :src="m.photo"
              :alt="m.photoAlt || m.title"
            /><span v-else class="letter-text-photo"
              ><Icon name="heart" :size="32" /><span
                >{{ m.text.slice(0, 38)
                }}{{ m.text.length > 38 ? "…" : "" }}</span
              ></span
            ><span class="letter-date">{{ dateLabel(m.date) }}</span
            ><strong>{{ m.title }}</strong
            ><span>{{ PEOPLE[m.author] }} 记录</span>
          </button>
        </div>
        <div v-else class="letter-empty">
          <Icon name="leaf" :size="28" />
          <p>这一周还留着空白。<br />等有想记住的事，再慢慢写。</p>
          <button class="text-button" @click="composeMoment">
            留下一件小事 <Icon name="arrow" :size="16" />
          </button>
        </div>
        <div
          v-for="(note, person) in state.letters[selectedWeek]?.notes || {}"
          :key="person"
          class="saved-week-note"
        >
          <template v-if="note"
            ><p>{{ note }}</p>
            <span>— {{ PEOPLE[person] }}</span></template
          >
        </div>
        <div class="letter-bottom">
          <Icon name="leaf" :size="24" /><span
            >这一页，是我们一起过的日子。</span
          >
        </div>
      </article>
      <section class="weekly-compose">
        <AuthorPicker
          :model-value="viewer"
          label="写下这句话的人"
          @update:model-value="setViewer"
        /><label for="week-words">{{ viewerName }}，留一句亲手写的话</label
        ><textarea
          id="week-words"
          :value="weeklyWords"
          @input="saveWeeklyDraft"
          maxlength="800"
          rows="3"
          placeholder="这一周，最想对你说的是……"
        ></textarea>
        <div class="form-bottom">
          <span>文字会保留为草稿，点击右侧按钮后共享。</span
          ><button class="primary-button" @click="saveLetter">
            留在这一页 <Icon name="check" :size="16" />
          </button>
        </div>
      </section>
      <div class="letter-export">
        <button class="text-button" @click="printLetter">
          <Icon name="download" :size="17" />打印 / 存成 PDF
        </button>
      </div>
    </template>

    <template v-else-if="page === 'favorites'">
      <div class="page-heading">
        <h2>最想珍藏</h2>
        <p>有些很小的瞬间，在心里占了很大的位置。</p>
      </div>
      <div v-if="favoriteMoments.length" class="moments-grid">
        <MomentCard
          v-for="m in favoriteMoments"
          :key="m.id"
          :moment="m"
          :viewer="viewer"
          @open="openMoment"
          @remember="remember"
          @favorite="favorite"
        />
      </div>
      <div v-else class="empty-state">
        <Icon name="bookmark" :size="36" />
        <h3>给喜欢的瞬间，留一个位置。</h3>
        <p>在日常卡片上轻点书签，就能收藏到这里。</p>
        <button class="secondary-button" @click="go('journal')">
          去翻翻日常
        </button>
      </div>
    </template>

    <template v-else-if="page === 'heart'">
      <div class="heart-intro glass-card">
        <div>
          <h2>有句话，想让你听见</h2>
          <p>可以先存草稿，准备好以后再共享。</p>
        </div>
        <button class="primary-button" @click="composeHeart">
          <Icon name="pen" :size="17" />写一句心里话
        </button>
      </div>
      <div v-if="state.heartDrafts[viewer]" class="draft-banner">
        <span><Icon name="pen" :size="17" />你有一段还没共享的草稿。</span>
        <div>
          <button class="text-button" @click="composeHeart">继续写</button
          ><button
            class="icon-button"
            aria-label="删除心里话草稿"
            @click="modal = 'draft-delete'"
          >
            <Icon name="trash" :size="16" />
          </button>
        </div>
      </div>
      <div class="section-heading">
        <div>
          <h2>我们正在聊的事</h2>
        </div>
      </div>
      <div v-if="state.hearts.length" class="heart-list">
        <button
          v-for="h in state.hearts"
          :key="h.id"
          class="heart-card"
          @click="openHeart(h)"
        >
          <span class="heart-card-top"
            ><span class="avatar-dot" :class="h.author">{{
              h.author === "aosen" ? "A" : "悦"
            }}</span
            ><span>{{ PEOPLE[h.author] }} · {{ dateLabel(h.date) }}</span
            ><span class="status-pill">{{ heartStatus(h) }}</span></span
          ><strong>{{ h.event }}</strong
          ><span class="heart-feeling">{{ h.feeling }}</span
          ><span class="heart-card-bottom"
            >{{
              h.agreement
                ? "小约定：" + h.agreement.text
                : "愿意的时候，一起聊聊。"
            }}<Icon name="arrow" :size="18"
          /></span>
        </button>
      </div>
      <div v-else class="empty-state">
        <Icon name="leaf" :size="32" />
        <p>想说的时候，这里一直在。</p>
      </div>
    </template>
  </main>
  <footer class="site-footer">Aosen & 小悦的家庭空间</footer>
  <Transition name="toast"
    ><div v-if="toast" class="toast-message" role="status">
      <Icon name="check" :size="18" />{{ toast }}
    </div></Transition
  >

  <DialogShell
    v-if="modal"
    :title="modalTitle"
    :eyebrow="undefined"
    :wide="modal === 'moment-detail' || modal === 'heart-detail'"
    @close="requestClose"
  >
    <form
      v-if="modal === 'moment'"
      class="entry-form"
      @submit.prevent="saveMoment"
    >
      <AuthorPicker v-model="form.author" :locked="Boolean(selectedId)" />
      <p class="identity-hint">
        {{
          selectedId
            ? "编辑内容时，原记录人保持不变。"
            : `保存后会显示「${PEOPLE[form.author]} 记录」，下次自动沿用。`
        }}
      </p>
      <div class="form-row">
        <div>
          <label for="moment-title"
            >标题 <span class="quiet-text">可选</span></label
          ><input
            id="moment-title"
            v-model="form.title"
            maxlength="50"
            placeholder="比如：回家有一碗热汤"
          />
        </div>
        <div>
          <label for="moment-date">日期</label
          ><input
            id="moment-date"
            v-model="form.date"
            required
            type="date"
            :max="today()"
          />
        </div>
      </div>
      <label for="moment-text">记下一件小事</label
      ><textarea
        id="moment-text"
        v-model="form.text"
        required
        maxlength="1500"
        rows="4"
        placeholder="发生了什么？当时哪一个细节，让你想留住它？"
      ></textarea>
      <div class="photo-label">一张照片 <span>可选，没有也很好</span></div>
      <div v-if="form.photo" class="upload-preview">
        <img :src="form.photo" alt="即将保存的照片" /><button
          type="button"
          class="icon-button"
          aria-label="移除照片"
          @click="form.photo = ''"
        >
          <Icon name="close" />
        </button>
      </div>
      <label v-else class="photo-upload" :class="{ busy: photoBusy }"
        ><Icon name="image" :size="25" /><span>{{
          photoBusy ? "正在整理照片…" : "选一张照片，留住当时的样子"
        }}</span
        ><small>JPG / PNG / WebP · 12 MB 以内</small
        ><input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          :disabled="photoBusy"
          @change="uploadPhoto"
      /></label>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <div class="dialog-actions">
        <button
          v-if="!selectedId"
          class="secondary-button"
          type="button"
          :disabled="photoBusy"
          @click="saveMomentDraft"
        >
          先存草稿</button
        ><button class="primary-button" type="submit" :disabled="photoBusy">
          <Icon name="check" :size="17" />{{
            selectedId ? "保存修改" : "保存这段回忆"
          }}
        </button>
      </div>
    </form>

    <template v-else-if="modal === 'moment-detail' && selectedMoment">
      <div class="detail-meta">
        <span
          >{{ PEOPLE[selectedMoment.author] }} 记录 ·
          {{ dateLabel(selectedMoment.date, true) }}</span
        ><span v-if="selectedMoment.sample" class="sample-tag">示例回忆</span>
      </div>
      <img
        v-if="selectedMoment.photo"
        class="detail-photo"
        :src="selectedMoment.photo"
        :alt="selectedMoment.photoAlt || selectedMoment.title"
      />
      <p class="detail-story">{{ selectedMoment.text }}</p>
      <div class="detail-reactions">
        <button
          class="remember-button"
          :class="{ remembered: selectedMoment.reactions.includes(viewer) }"
          :aria-pressed="selectedMoment.reactions.includes(viewer)"
          @click="remember(selectedMoment)"
        >
          <Icon name="heart" :size="19" />{{
            selectedMoment.reactions.includes(viewer)
              ? "我记得这件事"
              : "这件事我记得"
          }}</button
        ><button
          class="text-button"
          :aria-pressed="selectedMoment.favorites.includes(viewer)"
          @click="favorite(selectedMoment)"
        >
          <Icon name="bookmark" :size="18" />{{
            selectedMoment.favorites.includes(viewer)
              ? "已放进珍藏"
              : "放进珍藏"
          }}
        </button>
      </div>
      <p
        v-if="selectedMoment.reactions.length"
        class="quiet-text remembered-names"
      >
        {{ selectedMoment.reactions.map((p) => PEOPLE[p]).join("、") }}
        留下了「我记得」。
      </p>
      <section class="conversation">
        <h3>留一句回应</h3>
        <p v-if="!selectedMoment.replies.length" class="quiet-text">
          想说的时候，留下一句就好。
        </p>
        <div
          v-for="reply in selectedMoment.replies"
          :key="reply.id"
          class="reply"
        >
          <span class="avatar-dot" :class="reply.author">{{
            reply.author === "aosen" ? "A" : "悦"
          }}</span>
          <div>
            <strong>{{ PEOPLE[reply.author] }}</strong>
            <p>{{ reply.text }}</p>
          </div>
        </div>
        <form @submit.prevent="addReply('moment')">
          <AuthorPicker
            :model-value="viewer"
            label="回应人"
            @update:model-value="setViewer"
          /><label for="memory-reply"
            >{{ viewerName }}，你记得的那一刻是什么样？</label
          ><textarea
            id="memory-reply"
            v-model="replyText"
            required
            maxlength="600"
            rows="3"
            placeholder="我还记得……"
          ></textarea>
          <div class="reply-form-bottom">
            <span>也可以只读一读，不必回应。</span
            ><button class="secondary-button" type="submit">
              留下一句 <Icon name="arrow" :size="16" />
            </button>
          </div>
        </form>
      </section>
      <div v-if="selectedMoment.author === viewer" class="owner-actions">
        <button class="text-button" @click="editMoment">
          <Icon name="pen" :size="15" />编辑这段回忆</button
        ><button class="text-button danger-text" @click="deletePrompt = true">
          删除
        </button>
      </div>
      <div v-if="deletePrompt" class="confirm-box" role="alert">
        <p>删除这段回忆，也会删除它的回应和珍藏关联。</p>
        <div>
          <button class="secondary-button" @click="deletePrompt = false">
            保留</button
          ><button class="danger-button" @click="deleteMoment">确定删除</button>
        </div>
      </div>
    </template>

    <form
      v-else-if="modal === 'heart-compose'"
      class="entry-form"
      @submit.prevent="saveHeart(false)"
    >
      <AuthorPicker v-model="form.author" label="写下这段话的人" />
      <p class="dialog-intro">
        把具体的事和感受说清楚，给彼此留一点理解的空间。
      </p>
      <button
        type="button"
        class="writing-prompt"
        @click="
          form = {
            author: form.author,
            event: '刚才听到「你从来不关心我」。',
            feeling: '我有点委屈，也担心最近的努力没有被看见。',
            wish: '我想听听这次具体哪里让你不舒服，也希望之前的心意没有因此被抹掉。',
          }
        "
      >
        <Icon
          name="leaf"
          :size="17"
        />不知道怎么开口？试试「我也想被看见」</button
      ><label for="heart-event">刚才发生了什么？</label
      ><textarea
        id="heart-event"
        v-model="form.event"
        required
        rows="2"
        maxlength="600"
        placeholder="只说具体的事，不必给对方下结论。"
      ></textarea
      ><label for="heart-feeling">我当时的感受是……</label
      ><textarea
        id="heart-feeling"
        v-model="form.feeling"
        required
        rows="2"
        maxlength="600"
        placeholder="比如：有点失落、委屈，或者担心。"
      ></textarea
      ><label for="heart-wish">我希望我们下次可以……</label
      ><textarea
        id="heart-wish"
        v-model="form.wish"
        required
        rows="2"
        maxlength="600"
        placeholder="一个具体、可以商量的小改变。"
      ></textarea>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <p class="quiet-text">
        存草稿不会放进共同列表。点击共享后，双方都能看见。
      </p>
      <div class="dialog-actions">
        <button class="secondary-button" type="button" @click="saveHeart(true)">
          先留作草稿</button
        ><button class="primary-button" type="submit">
          准备好了，共享这段话 <Icon name="arrow" :size="16" />
        </button>
      </div>
    </form>

    <template v-else-if="modal === 'heart-detail' && selectedHeart">
      <div class="detail-meta">
        <span
          >{{ PEOPLE[selectedHeart.author] }} ·
          {{ dateLabel(selectedHeart.date) }}</span
        ><span class="status-pill">{{ heartStatus(selectedHeart) }}</span>
      </div>
      <div class="heart-letter">
        <section>
          <span>发生的事</span>
          <p>{{ selectedHeart.event }}</p>
        </section>
        <section>
          <span>我的感受</span>
          <p>{{ selectedHeart.feeling }}</p>
        </section>
        <section>
          <span>我的期待</span>
          <p>{{ selectedHeart.wish }}</p>
        </section>
      </div>
      <section class="conversation">
        <h3>听见彼此</h3>
        <div
          v-for="reply in selectedHeart.replies"
          :key="reply.id"
          class="reply"
        >
          <span class="avatar-dot" :class="reply.author">{{
            reply.author === "aosen" ? "A" : "悦"
          }}</span>
          <div>
            <strong>{{ PEOPLE[reply.author] }}</strong>
            <p>{{ reply.text }}</p>
          </div>
        </div>
        <form @submit.prevent="addReply('heart')">
          <AuthorPicker
            :model-value="viewer"
            label="回应人"
            @update:model-value="setViewer"
          /><label for="heart-reply">{{ viewerName }}，你想说的话</label
          ><textarea
            id="heart-reply"
            v-model="replyText"
            required
            rows="2"
            maxlength="600"
            placeholder="我听到你说……我也想补充……"
          ></textarea>
          <div class="reply-form-bottom">
            <span>回应不等于必须同意。</span
            ><button class="secondary-button" type="submit">留下回应</button>
          </div>
        </form>
      </section>
      <details class="agreement-section">
        <summary>
          <Icon name="leaf" :size="18" />小约定
          <span class="quiet-text">可选，展开查看</span>
        </summary>
        <h3><Icon name="leaf" :size="20" />留下一条小约定</h3>
        <template v-if="selectedHeart.agreement"
          ><p class="agreement-text">{{ selectedHeart.agreement.text }}</p>
          <p class="quiet-text">
            {{ PEOPLE[selectedHeart.agreement.proposer] }} 的提议 ·
            {{
              selectedHeart.agreement.accepted.length
                ? selectedHeart.agreement.accepted
                    .map((p) => PEOPLE[p])
                    .join("、") + " 愿意试试"
                : "双方都可以选择是否接受"
            }}
          </p>
          <button
            class="secondary-button"
            :aria-pressed="selectedHeart.agreement.accepted.includes(viewer)"
            @click="acceptAgreement"
          >
            <Icon
              :name="
                selectedHeart.agreement.accepted.includes(viewer)
                  ? 'check'
                  : 'plus'
              "
              :size="16"
            />{{
              selectedHeart.agreement.accepted.includes(viewer)
                ? "我愿意试试（点击撤回）"
                : "我愿意试试"
            }}
          </button>
          <div
            v-if="selectedHeart.agreement.accepted.length === 2"
            class="outcome-section"
          >
            <h4>后来，你感觉怎么样？</h4>
            <div class="outcome-buttons">
              <button
                :aria-pressed="
                  selectedHeart.agreement.outcomes[viewer] === 'better'
                "
                @click="outcome('better')"
              >
                我感觉好些了</button
              ><button
                :aria-pressed="
                  selectedHeart.agreement.outcomes[viewer] === 'adjust'
                "
                @click="outcome('adjust')"
              >
                还需要调整</button
              ><button
                :aria-pressed="
                  selectedHeart.agreement.outcomes[viewer] === 'trying'
                "
                @click="outcome('trying')"
              >
                还在试着做
              </button>
            </div>
            <p
              v-for="(value, person) in selectedHeart.agreement.outcomes"
              :key="person"
              class="quiet-text"
            >
              {{ PEOPLE[person] }}：{{
                {
                  better: "感觉好些了",
                  adjust: "还需要调整",
                  trying: "还在试着做",
                }[value]
              }}
            </p>
            <p class="quiet-text">只有双方都感觉好些了，才会标记为一起走过。</p>
          </div></template
        ><button
          v-if="selectedHeart.agreement && !editingAgreement"
          class="text-button"
          @click="
            editingAgreement = true;
            agreementText = selectedHeart.agreement.text;
          "
        >
          再商量一下，修改约定
        </button>
        <form
          v-if="!selectedHeart.agreement || editingAgreement"
          @submit.prevent="proposeAgreement"
        >
          <p v-if="editingAgreement" class="quiet-text">
            新提议会保留旧约定，并请双方重新选择是否接受。
          </p>
          <label for="agreement">下次可以试试什么？</label
          ><textarea
            id="agreement"
            v-model="agreementText"
            required
            maxlength="300"
            rows="2"
            placeholder="比如：临时晚归时，提前发条消息。"
          ></textarea
          ><button class="secondary-button" type="submit">
            提出这个小约定
          </button>
        </form>
        <details
          v-if="selectedHeart.agreementHistory?.length"
          class="agreement-history"
        >
          <summary>之前商量过的约定</summary>
          <p v-for="(a, i) in selectedHeart.agreementHistory" :key="i">
            {{ a.text }}
          </p>
        </details>
      </details>
    </template>

    <template v-else-if="modal === 'draft-delete'"
      ><p class="dialog-intro">
        只会移除你当前的心里话草稿，共同列表里的内容会保留。
      </p>
      <div class="dialog-actions">
        <button class="secondary-button" @click="closeNow">保留草稿</button
        ><button class="danger-button" @click="removeHeartDraft">
          删除这段草稿
        </button>
      </div></template
    >
    <template v-else-if="modal === 'info'"
      ><div class="preview-info">
        <p>
          本功能放在家庭网站的「生活 →
          我们这一页」。点击顶部「生活」可查看入口位置。当前仍是独立预览，回忆、回应与约定的初始内容均为示例。
        </p>
        <ul>
          <li>
            记录时在表单顶部选择 Aosen /
            小悦，保存后记住最近使用的身份；回应和心里话也会明确标注作者。
          </li>
          <li>
            你写下的内容和选择的照片仅保存在当前浏览器，不连接正式家庭数据，也不发送提醒。
          </li>
          <li>
            身份切换只用于演示，不构成权限隔离；草稿不在共同列表展示，但本预览不提供个人隐私保障。
          </li>
          <li>目前不支持两部手机同步。正式接入时再实现可靠同步与访问权限。</li>
        </ul>
        <p>
          <a href="./mobile.html" target="_blank" rel="noopener noreferrer"
            >打开手机尺寸预览</a
          >
        </p>
        <div class="preview-info-actions">
          <button class="secondary-button" @click="exportPreview">
            <Icon name="download" :size="17" />导出预览记录</button
          ><button class="text-button danger-text" @click="deletePrompt = true">
            恢复示例内容
          </button>
        </div>
        <div v-if="deletePrompt" class="confirm-box">
          <p>
            这会清除当前浏览器里的预览记录与草稿，恢复最初的示例。正式网站不受影响。
          </p>
          <div>
            <button class="secondary-button" @click="deletePrompt = false">
              保留我的记录</button
            ><button class="danger-button" @click="resetPreview">
              确认恢复示例
            </button>
          </div>
        </div>
        <div class="photo-credits">
          示例摄影：<a
            href="https://unsplash.com/photos/2168FFDZKg8"
            target="_blank"
            rel="noopener noreferrer"
            >茶桌照片</a
          >、<a
            href="https://unsplash.com/photos/Sb5RfxYUUKg"
            target="_blank"
            rel="noopener noreferrer"
            >Dave Hoefler · 湖边日落</a
          >
          / Unsplash。
        </div>
      </div></template
    >
    <div v-if="discardPrompt" class="confirm-box unsaved-confirm" role="alert">
      <p>还有没有保存的文字。想继续写，还是放下这次修改？</p>
      <div>
        <button class="secondary-button" @click="discardPrompt = false">
          继续写</button
        ><button class="danger-button" @click="closeNow">放弃未保存修改</button>
      </div>
    </div>
  </DialogShell>
</template>
