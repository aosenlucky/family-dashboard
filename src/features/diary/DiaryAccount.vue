<script setup>
import { ref, shallowRef, onMounted, watch } from "vue";
import { accessProof, createCloudStorage, normalizeAccount } from "./cloud.js";
import { createVault, unlockVault } from "./crypto.js";
import { newData } from "./model.js";
import { createVaultStorage } from "./storage.js";
import { pendingCopies } from "./pending.js";
import PrivateDiary from "./Diary.vue";

const emit = defineEmits(["show-demo"]);
const editor = ref(null),
  session = shallowRef(null),
  pending = shallowRef(null);
const account = ref(""),
  password = ref(""),
  repeat = ref(""),
  legacySecret = ref("");
const mode = ref("login"),
  recovery = ref(false),
  legacyRecovery = ref(false),
  legacy = shallowRef(null);
const legacyOpen = ref(false),
  acknowledged = ref(false),
  busy = ref(false),
  error = ref("");
const copies = ref([]),
  checkedCopies = ref(false),
  copiesFor = ref("");
watch([account, password, recovery], () => {
  copies.value = [];
  checkedCopies.value = false;
});
async function seeCopies() {
  error.value = "";
  checkedCopies.value = false;
  copies.value = [];
  try {
    const id = normalizeAccount(account.value),
      pass = password.value,
      recover = recovery.value;
    if (!pass) throw new Error("请先填写个人口令或恢复码，再打开加密暂存。");
    const found = await pendingCopies(id).list(),
      verified = [];
    for (const copy of found) {
      try {
        await unlockVault(copy.envelope, pass, recover);
        verified.push(copy);
      } catch {
        /* may require the former password */
      }
    }
    if (
      id !== normalizeAccount(account.value) ||
      pass !== password.value ||
      recover !== recovery.value
    )
      return;
    if (found.length && !verified.length)
      throw new Error("无法解锁这些暂存，请使用保存时的口令或恢复码。");
    copiesFor.value = id;
    copies.value = verified;
    checkedCopies.value = true;
  } catch (e) {
    error.value = e.message || "未能打开本机加密暂存。";
  }
}
function downloadCopy(copy) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(copy.envelope)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "未同步日记-" + copy.id + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function clearCopy(copy) {
  if (!window.confirm("确认已保存这份加密备份，清除本设备上的此份暂存？"))
    return;
  try {
    await pendingCopies(copiesFor.value).remove(copy.id);
    await seeCopies();
  } catch {
    error.value = "未能清除暂存，请重试。";
  }
}
const oldStore = createVaultStorage();
onMounted(async () => {
  try {
    account.value = localStorage.getItem("diary-last-account") || "";
  } catch {}
  try {
    legacy.value = await oldStore.readVault();
  } catch {
    /* cloud works without IndexedDB */
  }
});
function reset(next = "login") {
  copies.value = [];
  checkedCopies.value = false;
  mode.value = next;
  recovery.value = false;
  password.value = "";
  repeat.value = "";
  legacySecret.value = "";
  error.value = "";
  pending.value = null;
  acknowledged.value = false;
  legacyRecovery.value = false;
}
function enter(store, stored, opened) {
  try {
    localStorage.setItem("diary-last-account", store.account);
  } catch {}
  reset();
  session.value = {
    account: store.account,
    store,
    stored,
    opened,
  };
}
async function submit() {
  if (busy.value) return;
  error.value = "";
  busy.value = true;
  try {
    const id = normalizeAccount(account.value);
    if (!/^[\p{L}\p{N}_-]{2,32}$/u.test(id))
      throw new Error("账号请用 2 至 32 个汉字、字母、数字、下划线或短横线。");
    const token = await accessProof(
      id,
      password.value,
      mode.value === "login" && recovery.value,
    );
    const store = createCloudStorage(id, token);
    if (mode.value === "login") {
      const stored = await store.readVault();
      if (!stored)
        throw new Error(
          "这个账号还没有完成首次建立，请用同一账号和口令继续建立。",
        );
      const opened = await unlockVault(stored, password.value, recovery.value);
      enter(store, stored, opened);
    } else {
      if (password.value !== repeat.value)
        throw new Error("两次输入的新口令不一致。");
      let data = newData(account.value.trim());
      if (mode.value === "migrate") {
        const latest = await oldStore.readVault();
        if (!latest) throw new Error("此设备没有旧日记。请在原设备上迁移。");
        data = (
          await unlockVault(latest, legacySecret.value, legacyRecovery.value)
        ).data;
      }
      const vault = await createVault(password.value, data);
      const recoveryProof = await accessProof(id, vault.recovery, true);
      pending.value = { store, vault, data, recoveryProof };
      password.value = "";
      repeat.value = "";
      legacySecret.value = "";
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function finish() {
  if (!acknowledged.value || !pending.value || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const { store, vault, data, recoveryProof } = pending.value;
    await store.register(recoveryProof);
    const stored = await store.writeVault(vault.envelope, 0, {
      recovery: recoveryProof,
    });
    enter(store, stored, { key: vault.key, data });
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
function locked() {
  session.value = null;
  legacyOpen.value = false;
  reset();
}
defineExpose({
  prepareToLeave: () =>
    busy.value ? false : (editor.value?.prepareToLeave() ?? true),
});
</script>
<template>
  <PrivateDiary
    v-if="session"
    ref="editor"
    :cloud-session="session"
    @locked="locked"
  />
  <PrivateDiary
    v-else-if="legacyOpen"
    ref="editor"
    @locked="locked"
    @show-demo="emit('show-demo')"
  />
  <div v-else class="diary-surface diary-integrated">
    <main>
      <section class="vault-gate">
        <div class="gate-copy">
          <span class="eyebrow">PRIVATE JOURNAL</span>
          <h1>我的日记</h1>
          <p>
            在手机上写下，在电脑上翻开。<br />两台设备使用同一个个人日记账号和口令。
          </p>
          <button
            v-if="!pending"
            type="button"
            class="text-button"
            @click="emit('show-demo')"
          >
            看看示例
          </button>
        </div>
        <form
          v-if="pending"
          class="gate-form panel account-recovery"
          @submit.prevent="finish"
        >
          <h2>保存个人恢复码</h2>
          <p class="muted">
            请将账号
            {{ account }}
            和恢复码保存在自己的密码管理器中。忘记口令时可用它登录。
          </p>
          <code class="recovery-code">{{ pending.vault.recovery }}</code>
          <label class="check-label"
            ><input v-model="acknowledged" type="checkbox" />
            我已单独保存恢复码</label
          >
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button class="primary wide" :disabled="busy || !acknowledged">
            {{ busy ? "正在同步…" : "完成并同步日记" }}
          </button>
          <button
            type="button"
            class="text-button"
            :disabled="busy"
            @click="reset()"
          >
            返回登录
          </button>
        </form>
        <form v-else class="gate-form panel" @submit.prevent="submit">
          <h2>
            {{
              mode === "login"
                ? "打开个人日记"
                : mode === "migrate"
                  ? "迁移这台设备的旧日记"
                  : "建立个人日记"
            }}
          </h2>
          <p class="muted">
            {{
              mode === "migrate"
                ? "解锁旧日记后，将记录、照片、草稿和回顾复制到新账号，原件仍保留在这台设备。"
                : "每个人使用独立账号。日记在设备上加密后同步。"
            }}
          </p>
          <template v-if="mode === 'migrate'"
            ><label for="legacy-secret"
              >旧日记{{ legacyRecovery ? "恢复码" : "口令" }}</label
            >
            <input
              id="legacy-secret"
              v-model="legacySecret"
              type="password"
              required
              autocomplete="off"
            />
            <button
              class="text-button"
              type="button"
              @click="
                legacyRecovery = !legacyRecovery;
                legacySecret = '';
              "
            >
              {{ legacyRecovery ? "改用原口令" : "改用原恢复码" }}
            </button></template
          >
          <label for="diary-account">个人账号</label
          ><input
            id="diary-account"
            v-model="account"
            :disabled="busy"
            autocomplete="username"
            maxlength="32"
            placeholder="例如 Aosen"
            required
          />
          <label for="account-secret">{{
            mode === "login"
              ? recovery
                ? "个人恢复码"
                : "日记口令"
              : "设置日记口令（至少 12 个字符）"
          }}</label>
          <input
            id="account-secret"
            v-model="password"
            type="password"
            :autocomplete="
              mode === 'login' && !recovery
                ? 'current-password'
                : mode === 'login'
                  ? 'off'
                  : 'new-password'
            "
            required
          />
          <template v-if="mode !== 'login'"
            ><label for="account-repeat">再输入一次口令</label
            ><input
              id="account-repeat"
              v-model="repeat"
              type="password"
              autocomplete="new-password"
              required
          /></template>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button class="primary wide" :disabled="busy">
            {{
              busy
                ? "正在处理…"
                : mode === "login"
                  ? "登录日记"
                  : "继续并领取恢复码"
            }}
          </button>
          <div v-if="!busy" class="gate-extra">
            <button
              type="button"
              class="text-button"
              @click="reset(mode === 'login' ? 'create' : 'login')"
            >
              {{ mode === "login" ? "建立新账号" : "已有账号，去登录" }}
            </button>
            <button
              v-if="mode === 'login'"
              type="button"
              class="text-button"
              @click="
                recovery = !recovery;
                password = '';
                error = '';
              "
            >
              {{ recovery ? "使用口令" : "使用恢复码" }}
            </button>
          </div>
          <details v-if="mode === 'login' && account.trim() && !busy">
            <summary class="text-button" @click="seeCopies">
              找回本机未同步的修改
            </summary>
            <p
              v-if="
                checkedCopies &&
                copiesFor === normalizeAccount(account) &&
                !copies.length
              "
              class="small muted"
            >
              本机没有该账号的待保存副本。
            </p>
            <div
              v-for="copy in copiesFor === normalizeAccount(account)
                ? copies
                : []"
              :key="copy.id"
              class="small"
            >
              {{ new Date(copy.time).toLocaleString() }}
              <button
                type="button"
                class="text-button"
                @click="downloadCopy(copy)"
              >
                下载加密副本
              </button>
              <button
                type="button"
                class="text-button"
                @click="clearCopy(copy)"
              >
                清除暂存
              </button>
            </div>
            <p v-if="copies.length" class="small muted">
              恢复时先备份云端日记，再在设置中导入需要的副本。
            </p>
          </details>
          <div v-if="legacy && !busy && mode === 'login'" class="small muted">
            检测到本机旧日记。
            <button type="button" class="text-button" @click="reset('migrate')">
              迁入新账号
            </button>
            <button
              type="button"
              class="text-button"
              @click="legacyOpen = true"
            >
              打开旧版或导出
            </button>
          </div>
        </form>
      </section>
    </main>
  </div>
</template>
