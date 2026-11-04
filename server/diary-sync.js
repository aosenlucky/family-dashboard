import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseConfig } from "../api/_data-store.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const matches = (value, expected) =>
  typeof expected === "string" &&
  /^[a-f0-9]{64}$/.test(expected) &&
  timingSafeEqual(Buffer.from(hash(value)), Buffer.from(expected));
const proof = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const base64 = (value) =>
  typeof value === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
const CHUNK = 192 * 1024;
const MAX_PARTS = 288;
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const conflict = () =>
  fail(409, "另一台设备已更新日记。请先导出当前加密副本，再读取最新日记。");

function cleanHeader(e) {
  const box = (b) =>
    b &&
    base64(b.iv) &&
    b.iv.length === 16 &&
    base64(b.ciphertext) &&
    b.ciphertext.length === 64;
  if (
    e?.format !== "family-private-diary" ||
    e.version !== 1 ||
    !/^[a-f0-9-]{36}$/.test(e.id) ||
    !box(e.wrappedRecovery) ||
    !box(e.wrappedPassword) ||
    !base64(e.iv) ||
    e.iv.length !== 16 ||
    e.kdf?.name !== "PBKDF2-SHA256" ||
    !base64(e.kdf.salt) ||
    e.kdf.salt.length !== 24 ||
    !Number.isSafeInteger(e.kdf.iterations) ||
    e.kdf.iterations < 600000 ||
    e.kdf.iterations > 2000000
  )
    fail(400, "日记密文格式无效。");
  const wrapper = (b) => ({ iv: b.iv, ciphertext: b.ciphertext });
  return {
    format: e.format,
    version: 1,
    id: e.id,
    kdf: { name: e.kdf.name, salt: e.kdf.salt, iterations: e.kdf.iterations },
    wrappedRecovery: wrapper(e.wrappedRecovery),
    wrappedPassword: wrapper(e.wrappedPassword),
    iv: e.iv,
  };
}

// Each settings table already has a primary key and is restricted to the server.
// Manifest replacement is a conditional PostgreSQL UPDATE, never a read-then-upsert.
function records() {
  const { url, key, mainTable } = getSupabaseConfig();
  return async (query, method = "GET", body, prefer = "return=minimal") => {
    const response = await fetch(
      url + "/rest/v1/" + encodeURIComponent(mainTable) + "?" + query,
      {
        method,
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          Prefer: prefer,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    if (response.status === 409) conflict();
    if (!response.ok) throw new Error("database unavailable");
    const value = await response.text();
    return value ? JSON.parse(value) : null;
  };
}

export default async function diarySync(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    if (req.method !== 'POST') { res.setHeader('Allow','POST'); fail(405,'请使用日记客户端同步。'); }
    if (req.body?.action !== 'private-diary') fail(400,'个人日记请求不完整。');
    const family = req.headers.authorization,
      secret = process.env.SYSTEM_PASSWORD;
    if (
      !secret ||
      !family ||
      family !== secret ||
      family === process.env.DEMO_PASSWORD ||
      family === "local_dummy_token"
    )
      fail(401, "请使用家庭正式账号登录后同步。");
    const b = req.body,
      token = req.headers["x-diary-access"];
    if (
      !proof(token) ||
      typeof b.account !== "string" ||
      !/^[\p{L}\p{N}_-]{2,32}$/u.test(b.account)
    )
      fail(400, "个人账号或登录凭证格式不正确。");
    const account =
      "private-diary-v1:" + hash(b.account.normalize("NFKC").toLowerCase());
    const db = records(),
      headFilter = "key=eq." + account;
    if (b.op === "register") {
      if (!proof(b.recovery)) fail(400, "缺少个人恢复凭证。");
      await db(
        "on_conflict=key",
        "POST",
        {
          key: account,
          value: {
            revision: 0,
            password: hash(token),
            recovery: hash(b.recovery),
          },
        },
        "resolution=ignore-duplicates,return=minimal",
      );
    }
    const head = (await db(headFilter + "&select=value&limit=1"))?.[0]?.value;
    if (
      !head ||
      !(matches(token, head.password) || matches(token, head.recovery))
    )
      fail(403, "账号、口令或恢复码不正确，或该账号已经被使用。");
    const ok = (body) => res.status(200).json(body);
    if (b.op === "register") {
      if (head.revision) fail(409, "账号已有日记，请登录或换一个账号。");
      return ok({ revision: 0 });
    }
    if (b.op === "head")
      return ok({ revision: head.revision, snapshot: head.snapshot || null });
    if (b.op === "version") return ok({ revision: head.revision });
    if (!Number.isSafeInteger(b.revision) || b.revision !== head.revision)
      conflict();
    if (typeof b.upload !== "string" || !/^[a-f0-9-]{36}$/.test(b.upload))
      fail(400, "同步批次无效。");
    const prefix = (revision, upload) =>
      account +
      ":part:" +
      String(revision).padStart(12, "0") +
      ":" +
      upload +
      ":";
    if (b.op === "readPart" || b.op === "stage") {
      if (!Number.isInteger(b.index) || b.index < 0 || b.index >= MAX_PARTS)
        fail(400, "分片序号无效。");
      if (b.op === "readPart") {
        if (
          b.upload !== head.snapshot?.upload ||
          b.index >= head.snapshot.parts
        )
          conflict();
        const rows = await db(
          "key=eq." +
            prefix(head.revision - 1, b.upload) +
            b.index +
            "&select=value",
        );
        if (!rows?.length) conflict();
        return ok({ ciphertext: rows[0].value });
      }
      if (!base64(b.ciphertext) || b.ciphertext.length > CHUNK)
        fail(400, "密文分片无效。");
      await db(
        "on_conflict=key",
        "POST",
        { key: prefix(b.revision, b.upload) + b.index, value: b.ciphertext },
        "resolution=ignore-duplicates,return=minimal",
      );
      return ok({ staged: true });
    }
    if (b.op !== "commit") fail(400, "未知的同步操作。");
    const snapshot = {
      header: cleanHeader(b.header),
      upload: b.upload,
      parts: b.parts,
    };
    if (head.snapshot && head.snapshot.header.id !== snapshot.header.id)
      fail(409, "不能用另一账号的密钥覆盖本日记。");
    if (!Number.isInteger(b.parts) || b.parts < 0 || b.parts > MAX_PARTS)
      fail(400, "日记超出同步容量。");
    if (!b.parts) {
      if (!base64(b.ciphertext) || b.ciphertext.length > CHUNK)
        fail(400, "日记密文无效。");
      snapshot.ciphertext = b.ciphertext;
    } else {
      const rows = await db(
        "key=like." +
          prefix(b.revision, b.upload) +
          "*&select=key&limit=" +
          MAX_PARTS,
      );
      const keys = new Set(rows.map((r) => r.key));
      for (let i = 0; i < b.parts; i++)
        if (!keys.has(prefix(b.revision, b.upload) + i))
          fail(409, "日记分片尚未传完，请重试。");
    }
    if (b.newAccess !== undefined && !proof(b.newAccess))
      fail(400, "新的登录凭证无效。");
    if (!head.revision && !proof(b.recovery)) fail(400, "缺少恢复凭证。");
    const next = {
      ...head,
      snapshot,
      revision: head.revision + 1,
      password: b.newAccess ? hash(b.newAccess) : head.password,
      recovery: !head.revision ? hash(b.recovery) : head.recovery,
    };
    const changed = await db(
      headFilter + "&value->>revision=eq." + head.revision + "&select=key",
      "PATCH",
      { value: next, updated_at: new Date().toISOString() },
      "return=representation",
    );
    if (!changed.length) conflict();
    // Only obsolete generations. Never remove chunks of an overlapping upload at or beyond this revision.
    if (head.revision > 0 && (head.snapshot?.parts || b.parts)) {
      try {
        await db(
          "key=like." +
            account +
            ":part:" +
            String(head.revision - 1).padStart(12, "0") +
            ":*",
          "DELETE",
        );
      } catch {
        /* a later save can clean old chunks */
      }
    }
    return ok({ revision: next.revision });
  } catch (e) {
    return res.status(e.status || 503).json({
      error: e.status
        ? e.message
        : "个人日记云存储暂不可用。请检查 Supabase 配置或稍后重试。",
    });
  }
}
