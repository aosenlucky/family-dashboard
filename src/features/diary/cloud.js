import { pendingCopies } from "./pending.js";
import { ITERATIONS, validateEnvelope } from "./crypto.js";

const encoder = new TextEncoder();
const PART_SIZE = 192 * 1024;
export const normalizeAccount = (value) =>
  value.trim().normalize("NFKC").toLowerCase();

// Independent purposes: the API never receives the password or recovery code used by AES.
export async function accessProof(account, secret, recovery = false) {
  const input = recovery ? secret.replace(/[\s-]/g, "").toLowerCase() : secret;
  if (recovery && !/^[a-f0-9]{64}$/.test(input))
    throw new Error("恢复码格式不正确。");
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(input),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: ITERATIONS,
      salt: encoder.encode(
        "family-diary:personal-access:v1:" +
          normalizeAccount(account) +
          ":" +
          (recovery ? "recovery" : "password"),
      ),
    },
    material,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function createCloudStorage(
  account,
  initialProof,
  request = fetch,
  familyToken = () => sessionStorage.getItem("family_auth_token"),
) {
  account = normalizeAccount(account);
  const rescue = pendingCopies(account),
    writer = crypto.randomUUID();
  let token = initialProof;
  async function call(op, values = {}) {
    let response;
    try {
      response = await request("/api/diary-sync", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: familyToken() || "",
          "X-Diary-Access": token,
        },
        body: JSON.stringify({
          action: "private-diary",
          account,
          op,
          ...values,
        }),
        signal: AbortSignal.timeout(35000),
      });
    } catch {
      throw new Error(
        "网络未连通，日记尚未同步。请保留此页重试，或导出加密备份。",
      );
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result)
      throw Object.assign(
        new Error(result?.error || "同步服务暂不可用，请稍后重试。"),
        { status: response.status },
      );
    return result;
  }
  async function readVault() {
    for (let attempt = 0; ; attempt++) {
      try {
        const { revision, snapshot } = await call("head");
        if (!snapshot) return null;
        const { header, upload, parts } = snapshot;
        let ciphertext = snapshot.ciphertext;
        if (parts) {
          const chunks = [];
          for (let start = 0; start < parts; start += 4) {
            const batch = await Promise.all(
              Array.from({ length: Math.min(4, parts - start) }, (_, i) =>
                call("readPart", { revision, upload, index: start + i }),
              ),
            );
            chunks.push(...batch.map((b) => b.ciphertext));
          }
          ciphertext = chunks.join("");
        }
        const { iv, ...meta } = header;
        return validateEnvelope({
          ...meta,
          revision,
          payload: { iv, ciphertext },
        });
      } catch (e) {
        if (attempt || e.status !== 409) throw e;
      }
    }
  }
  async function writeVault(value, expectedRevision, options = {}) {
    const revision = expectedRevision ?? 0,
      upload = crypto.randomUUID();
    const { payload, revision: ignored, ...meta } = value;
    const ciphertext = payload.ciphertext;
    const parts =
      ciphertext.length > PART_SIZE
        ? Math.ceil(ciphertext.length / PART_SIZE)
        : 0;
    if (JSON.stringify(value).length > 50 * 1024 * 1024)
      throw new Error("本日记已达到50 MiB 同步上限。请先导出加密备份。");
    // Persist before the network request. A killed mobile tab or a conflict leaves a downloadable encrypted backup.
    const canRescue =
      typeof indexedDB !== "undefined" &&
      !options.recovery &&
      !options.password;
    if (canRescue) await rescue.save(writer, value).catch(() => {});
    for (let start = 0; start < parts; start += 4) {
      await Promise.all(
        Array.from({ length: Math.min(4, parts - start) }, (_, i) => {
          const index = start + i;
          return call("stage", {
            revision,
            upload,
            index,
            ciphertext: ciphertext.slice(
              index * PART_SIZE,
              (index + 1) * PART_SIZE,
            ),
          });
        }),
      );
    }
    const newAccess = options.password
      ? await accessProof(account, options.password)
      : undefined;
    const saved = await call("commit", {
      revision,
      upload,
      header: { ...meta, iv: payload.iv },
      parts,
      ciphertext: parts ? undefined : ciphertext,
      newAccess,
      recovery: options.recovery,
    });
    if (canRescue) await rescue.remove(writer).catch(() => {});
    if (newAccess) token = newAccess;
    return { ...value, revision: saved.revision };
  }
  return {
    account,
    readVault,
    writeVault,
    readRevision: async () => (await call("version")).revision,
    register: (recovery) => call("register", { recovery }),
  };
}
