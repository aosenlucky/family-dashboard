// Runs the real Vue component in an isolated DOM and IndexedDB implementation.
// No real browser vault, credentials, account, network or production data is used.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const qaRequire = createRequire(
  join(
    process.env.DIARY_QA_MODULES || join(tmpdir(), "family-diary-qa-deps"),
    "package.json",
  ),
);
const { JSDOM } = qaRequire("jsdom"),
  { indexedDB } = qaRequire("fake-indexeddb");
const dom = new JSDOM('<div id="app"></div>', {
  url: "http://diary.test/",
  pretendToBeVisual: true,
});
for (const k of [
  "window",
  "document",
  "location",
  "Document",
  "Element",
  "Node",
  "HTMLElement",
  "SVGElement",
  "Event",
  "CustomEvent",
])
  globalThis[k] = dom.window[k];
globalThis.indexedDB = indexedDB;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
  dom.window,
);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
dom.window.scrollTo = () => {};
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
dom.window.HTMLAnchorElement.prototype.click = function () {};
const { build } = await import("../../../node_modules/vite/dist/node/index.js");
const { default: vuePlugin } = await import(
  "../../../node_modules/@vitejs/plugin-vue/dist/index.mjs"
);
const output = await mkdtemp(join(tmpdir(), "family-diary-component-"));
await build({
  configFile: false,
  root,
  logLevel: "silent",
  plugins: [vuePlugin()],
  build: {
    outDir: output,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: join(root, "preview/diary/Diary.vue"),
      formats: ["es"],
      fileName: () => "component.mjs",
    },
    rolldownOptions: { external: ["vue"] },
  },
});
const source = (
  await readFile(join(output, "component.mjs"), "utf8")
).replaceAll(
  'from "vue"',
  `from "${pathToFileURL(join(root, "node_modules/vue/index.mjs")).href}"`,
);
await writeFile(join(output, "component.mjs"), source);
const { createApp, nextTick } = await import(
  "../../../node_modules/vue/index.mjs"
);
const { default: Diary } = await import(
  pathToFileURL(join(output, "component.mjs")).href
);
const { readVault, writeVault } = await import("../storage.js");
const { unlockVault } = await import("../crypto.js");
const downloads = [];
globalThis.URL.createObjectURL = (blob) => {
  downloads.push(blob);
  return "blob:test-export";
};
globalThis.URL.revokeObjectURL = () => {};
let app, idleCheck;
const nativeSetInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms, ...args) => {
  if (ms === 10000) idleCheck = fn;
  return nativeSetInterval(fn, ms, ...args);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(check, label, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    await nextTick();
    if (await check()) return;
    await sleep(30);
  }
  throw new Error(
    `Timeout: ${label}\n${document.body.textContent.slice(0, 1000)}`,
  );
}
function text() {
  return document.body.textContent;
}
function field(selector, value) {
  const el = document.querySelector(selector);
  assert.ok(el, selector);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return el;
}
function click(label) {
  const el = [...document.querySelectorAll("button")].find(
    (el) =>
      el.textContent.trim() === label ||
      el.getAttribute("aria-label") === label,
  );
  assert.ok(el, `Missing button ${label}`);
  assert.ok(!el.disabled, `${label} disabled`);
  el.click();
}
async function mount(url) {
  if (app) app.unmount();
  dom.reconfigure({ url });
  document.body.innerHTML = '<div id="app"></div>';
  app = createApp(Diary);
  app.mount("#app");
  await waitFor(() => !text().includes("正在打开日记…"), "mount");
}

test("preview integration: direct writing, encrypted autosave, recovery, conflict safety and restore", async (t) => {
  t.after(() => {
    app?.unmount();
    dom.window.close();
    globalThis.setInterval = nativeSetInterval;
  });
  const password = "disposable-diary-test-password-987";
  let recovery;
  await t.test(
    "demo writes without prompts and never persists a vault",
    async () => {
      await mount("http://diary.test/?demo=1");
      assert.ok(document.querySelector("#diary-text"));
      assert.equal(
        document.querySelector("#diary-text").placeholder,
        "直接写在这里…",
      );
      assert.ok(!text().includes("换一个问题"));
      field("#diary-text", "只在内存中体验的一句话");
      await nextTick();
      click("留在日记");
      await nextTick();
      click("回看");
      await nextTick();
      field('[aria-label="搜索日记"]', "只在内存中");
      await nextTick();
      assert.equal(document.querySelectorAll(".entry-card").length, 1);
      click("回顾");
      await nextTick();
      click("月回顾");
      await nextTick();
      assert.ok(document.querySelectorAll(".recap-highlights>button").length);
      assert.equal(await readVault(), null);
    },
  );
  await t.test(
    "create a vault only after recovery acknowledgement, then autosave a draft encrypted",
    async () => {
      await mount("http://diary.test/");
      field("#diary-name", "测试日记");
      field("#new-secret", password);
      field("#repeat-secret", password);
      document
        .querySelector(".gate-form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await waitFor(
        () => document.querySelector(".recovery-code"),
        "recovery code",
      );
      recovery = document.querySelector(".recovery-code").textContent;
      assert.equal(await readVault(), null);
      const checkbox = document.querySelector(".check-label input");
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      await nextTick();
      click("开始写日记");
      await waitFor(() => document.querySelector("#diary-text"), "created");
      field("#diary-text", "绝不能出现在明文数据库的草稿");
      await waitFor(async () => {
        const record = await readVault();
        return record && record.revision >= 2;
      }, "autosave");
      const record = await readVault();
      assert.ok(!JSON.stringify(record).includes("绝不能"));
      assert.equal(
        (await unlockVault(record, password)).data.draft.text,
        "绝不能出现在明文数据库的草稿",
      );
      click("留在日记");
      await waitFor(
        () => text().includes("这一篇，已加密留在日记里"),
        "publish",
      );
      assert.equal(
        (await unlockVault(await readVault(), password)).data.entries.length,
        1,
      );
    },
  );
  await t.test(
    "locking removes plaintext from DOM, wrong password fails, recovery unlocks",
    async () => {
      click("锁定日记");
      await waitFor(() => document.querySelector("#unlock-secret"), "locked");
      assert.ok(!text().includes("绝不能"));
      field("#unlock-secret", "wrong-password");
      document
        .querySelector(".gate-form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await waitFor(() => text().includes("日记口令不正确"), "wrong secret");
      click("使用恢复码解锁");
      await nextTick();
      field("#unlock-secret", recovery);
      document
        .querySelector(".gate-form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await waitFor(
        () => document.querySelector("#diary-text"),
        "recovery unlock",
      );
      assert.ok(text().includes("绝不能出现在明文数据库的草稿"));
    },
  );
  await t.test(
    "local review persists encrypted and material export selects only chosen records",
    async () => {
      click("回顾");
      await nextTick();
      field("#review-text", "只属于我的本地回顾");
      await sleep(750);
      click("保存回顾");
      await waitFor(() => text().includes("回顾已加密保存"), "review saved");
      const record = await readVault();
      assert.ok(!JSON.stringify(record).includes("本地回顾"));
      click("选择记录，准备 AI 素材");
      await nextTick();
      assert.ok(text().includes("不连接外部 AI"));
      click("清空");
      await nextTick();
      assert.ok(text().includes("已选 0 篇"));
      click("关闭窗口");
      await nextTick();
    },
  );
  await t.test(
    "a stale window cannot overwrite newer storage or discard its unsaved draft on lock",
    async () => {
      const record = await readVault();
      await writeVault(record, record.revision);
      click("写下");
      await nextTick();
      field("#diary-text", "冲突后必须保留的未保存修改");
      await waitFor(() => text().includes("另一窗口更新了日记"), "conflict");
      const current = await unlockVault(await readVault(), password);
      assert.equal(current.data.draft.text, "");
      click("锁定日记");
      await waitFor(
        () => text().includes("日记已暂时遮盖"),
        "shielded without losing draft",
      );
      click("继续");
      await nextTick();
      assert.equal(
        document.querySelector("#diary-text").value,
        "冲突后必须保留的未保存修改",
      );
      click("读取最新日记");
      await nextTick();
      const checkbox = document.querySelector(".check-label input");
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      await nextTick();
      click("读取最新版本并重新解锁");
      await waitFor(
        () => document.querySelector("#unlock-secret"),
        "discard with acknowledgement",
      );
    },
  );
  await t.test(
    "IndexedDB revision checks prevent parallel lost updates",
    async () => {
      const record = await readVault();
      const results = await Promise.allSettled([
        writeVault(record, record.revision),
        writeVault(record, record.revision),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    },
  );
  await t.test(
    "backup export stays encrypted, verified import restores records, drafts and reviews",
    async () => {
      click("导出加密备份");
      await waitFor(() => downloads.length > 0, "backup download");
      const backupText = await downloads.at(-1).text();
      assert.ok(!backupText.includes("只属于我的本地回顾"));
      const candidate = JSON.parse(backupText),
        previous = await readVault();
      const input = document.querySelector(".gate-extra input[type=file]");
      Object.defineProperty(input, "files", {
        value: [{ size: backupText.length, text: async () => backupText }],
        configurable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await waitFor(
        () => document.querySelector("#import-secret"),
        "import form",
      );
      field("#import-secret", password);
      document
        .querySelector(".dialog form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await waitFor(
        () => text().includes("确认替换并导入"),
        "import validated",
      );
      assert.equal((await readVault()).revision, previous.revision);
      click("确认替换并导入");
      await waitFor(() => document.querySelector("#diary-text"), "restored");
      const restored = await readVault();
      assert.equal(restored.id, candidate.id);
      assert.ok(restored.revision > previous.revision);
      const result = await unlockVault(restored, password);
      assert.equal(result.data.entries[0].text, "绝不能出现在明文数据库的草稿");
      assert.ok(
        Object.values(result.data.reviews).some(
          (r) => r.text === "只属于我的本地回顾",
        ),
      );
    },
  );
  await t.test(
    "reopening a new component loads the persisted vault and encrypted draft",
    async () => {
      field("#diary-text", "刷新后还在的草稿");
      await waitFor(
        async () =>
          (await unlockVault(await readVault(), password)).data.draft.text ===
          "刷新后还在的草稿",
        "draft saved",
      );
      await mount("http://diary.test/");
      field("#unlock-secret", password);
      document
        .querySelector(".gate-form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await waitFor(() => document.querySelector("#diary-text"), "reopened");
      assert.equal(
        document.querySelector("#diary-text").value,
        "刷新后还在的草稿",
      );
    },
  );
  await t.test(
    "background cover hides the editor and idle locking saves the latest draft first",
    async () => {
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await nextTick();
      assert.ok(text().includes("日记已暂时遮盖"));
      assert.equal(document.querySelector("#diary-text"), null);
      Object.defineProperty(document, "hidden", {
        value: false,
        configurable: true,
      });
      click("继续");
      await nextTick();
      field("#diary-text", "自动锁定前的最后一段文字");
      const nativeNow = Date.now;
      try {
        Date.now = () => nativeNow() + 6 * 60 * 1000;
        idleCheck();
      } finally {
        Date.now = nativeNow;
      }
      await waitFor(
        () => document.querySelector("#unlock-secret"),
        "idle lock",
      );
      assert.ok(!text().includes("自动锁定前的最后一段文字"));
      assert.equal(
        (await unlockVault(await readVault(), password)).data.draft.text,
        "自动锁定前的最后一段文字",
      );
    },
  );
});
