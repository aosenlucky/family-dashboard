// Isolated production-route checks. Never uses a real browser profile or account.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postcss from "postcss";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const qaRequire = createRequire(
  join(
    process.env.DIARY_QA_MODULES || join(tmpdir(), "family-diary-qa-deps"),
    "package.json",
  ),
);
const { JSDOM } = qaRequire("jsdom");
const { indexedDB } = qaRequire("fake-indexeddb");
const dom = new JSDOM('<div id="app"></div>', {
  url: "https://diary.test/diary",
  pretendToBeVisual: true,
});
for (const key of [
  "window",
  "document",
  "location",
  "history",
  "Document",
  "Element",
  "Node",
  "HTMLElement",
  "SVGElement",
  "Event",
  "CustomEvent",
])
  globalThis[key] = dom.window[key];
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

const { build } = await import("vite");
const { default: vuePlugin } = await import("@vitejs/plugin-vue");
const output = await mkdtemp(join(tmpdir(), "family-diary-route-"));
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
      entry: join(root, "src/views/Diary.vue"),
      formats: ["es"],
      fileName: () => "route.mjs",
    },
    rolldownOptions: { external: ["vue", "vue-router"] },
  },
});
let source = await readFile(join(output, "route.mjs"), "utf8");
for (const [name, file] of [
  ["vue", "vue/index.mjs"],
  ["vue-router", "vue-router/dist/vue-router.mjs"],
]) {
  source = source.replaceAll(
    `from "${name}"`,
    `from "${pathToFileURL(join(root, "node_modules", file)).href}"`,
  );
}
await writeFile(join(output, "route.mjs"), source);
const { createApp, h, ref, nextTick } = await import("vue");
const { createRouter, createMemoryHistory, RouterView, isNavigationFailure } =
  await import("vue-router");
const { default: DiaryRoute } = await import(
  pathToFileURL(join(output, "route.mjs")).href
);
const { createVaultStorage } = await import(
  "../../../src/features/diary/storage.js"
);
const { createVault, unlockVault } = await import(
  "../../../src/features/diary/crypto.js"
);
const { newData, publishDraft } = await import(
  "../../../src/features/diary/model.js"
);
const store = createVaultStorage();
const previewStore = createVaultStorage("family-private-diary-preview-v1");
const password = "disposable-route-fixture-password";
let app, router;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(check) {
  for (let i = 0; i < 150; i++) {
    await nextTick();
    if (await check()) return;
    await sleep(20);
  }
  throw new Error("Expected diary state was not reached");
}
async function openLegacy() {
  await waitFor(() => [...document.querySelectorAll('button')].find(b=>b.textContent.includes('打开旧版或导出')));
  [...document.querySelectorAll('button')].find(b=>b.textContent.includes('打开旧版或导出')).click();
  await waitFor(()=>document.querySelector('#unlock-secret'));
}
async function mount(demo = false, path = "/diary") {
  app?.unmount();
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/diary", component: DiaryRoute },
      { path: "/life", component: { render: () => h("p", "家庭生活") } },
    ],
  });
  await router.push(path);
  app = createApp({ render: () => h(RouterView) });
  app.provide("isDemoMode", ref(demo));
  app.use(router);
  app.mount("#app");
  await router.isReady();
  if (!demo) await openLegacy();
  await waitFor(
    () =>
      document.querySelector("#unlock-secret") ||
      document.querySelector("#diary-text"),
  );
}
async function unlock() {
  const input = document.querySelector("#unlock-secret");
  input.value = password;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  document
    .querySelector(".gate-form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => document.querySelector("#diary-text"));
}
function write(text) {
  const input = document.querySelector("#diary-text");
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

test("production diary navigation and storage isolation", async (t) => {
  t.after(() => {
    app?.unmount();
    dom.window.close();
  });
  const data = newData("正式日记用户");
  data.draft.text = "真实模式独有的私密记录";
  publishDraft(data);
  const vault = await createVault(password, data);
  await store.writeVault(vault.envelope, null);
  const preview = await createVault(password, newData("仅预览用户"));
  await previewStore.writeVault(preview.envelope, null);

  await t.test(
    "integrated page uses the production vault and no duplicate or localhost navigation",
    async () => {
      await mount();
      assert.equal(document.querySelector(".site-header"), null);
      assert.equal(document.querySelector(".site-footer"), null);
      assert.equal(document.querySelector(".preview-bar"), null);
      assert.equal(document.querySelector('a[href*="127.0.0.1"]'), null);
      assert.ok(!document.body.textContent.includes("真实模式独有的私密记录"));
      await unlock();
      assert.ok(document.body.textContent.includes("正式日记用户"));
      assert.ok(!document.body.textContent.includes("仅预览用户"));
      document.querySelector(".skip-link").click();
      assert.equal(router.currentRoute.value.path, "/diary");
      assert.equal(location.hash, "");
    },
  );

  await t.test(
    "immediate route navigation saves the latest draft and returns locked",
    async () => {
      write("离开页面之前没有等自动保存的文字");
      await router.push("/life");
      await nextTick();
      assert.equal(router.currentRoute.value.path, "/life");
      assert.equal(document.querySelector("#diary-text"), null);
      const saved = await unlockVault(await store.readVault(), password);
      assert.equal(saved.data.draft.text, "离开页面之前没有等自动保存的文字");
      await router.push("/diary");
      await openLegacy();
      await waitFor(() => document.querySelector("#unlock-secret"));
      assert.ok(
        !document.body.textContent.includes("离开页面之前没有等自动保存的文字"),
      );
    },
  );

  await t.test(
    "a conflicting save cancels navigation and keeps the unsaved draft",
    async () => {
      await unlock();
      const current = await store.readVault();
      await store.writeVault(current, current.revision);
      write("冲突时不可丢失的当前文字");
      const navigation = await router.push("/life");
      assert.ok(isNavigationFailure(navigation));
      assert.equal(router.currentRoute.value.path, "/diary");
      assert.equal(
        document.querySelector("#diary-text").value,
        "冲突时不可丢失的当前文字",
      );
      assert.ok(document.body.textContent.includes("另一窗口更新了日记"));
    },
  );

  await t.test(
    "family demo cannot read, change or open the private vault",
    async () => {
      const before = await store.readVault();
      await mount(true);
      assert.ok(!document.body.textContent.includes("真实模式独有的私密记录"));
      assert.ok(!document.body.textContent.includes("正式日记用户"));
      write("演示不进入本机私人日记");
      await sleep(700);
      assert.deepEqual(await store.readVault(), before);
      document.querySelector('[aria-label="日记设置"]').click();
      await nextTick();
      assert.ok(!document.body.textContent.includes("建立自己的加密日记"));
    },
  );

  await t.test(
    "all diary CSS selectors are confined to the diary surface",
    async () => {
      const css = postcss.parse(
        await readFile(join(root, "src/features/diary/style.css"), "utf8"),
      );
      css.walkRules((rule) => {
        for (const selector of rule.selectors)
          assert.ok(selector.startsWith(".diary-surface"), selector);
      });
    },
  );
});
