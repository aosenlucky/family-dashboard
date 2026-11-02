export function createVaultStorage(DATABASE = "family-private-diary-v1") {
  let connection;
  function database() {
    if (!connection)
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("vault");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(new Error("浏览器无法打开日记存储，请检查浏览器设置。"));
      });
    return connection;
  }
  async function readVault() {
    const db = await database();
    return new Promise((resolve, reject) => {
      const request = db.transaction("vault").objectStore("vault").get("main");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error("未能读取加密日记。"));
    });
  }
  async function writeVault(value, expectedRevision) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("vault", "readwrite");
      const store = tx.objectStore("vault");
      let next,
        conflict = false;
      const request = store.get("main");
      request.onsuccess = () => {
        const previous = request.result;
        if ((previous?.revision ?? null) !== expectedRevision) {
          conflict = true;
          tx.abort();
          return;
        }
        next = { ...value, revision: (previous?.revision ?? 0) + 1 };
        store.put(next, "main");
      };
      tx.oncomplete = () => resolve(next);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            conflict
              ? "另一窗口更新了日记。请先导出当前加密副本，再通过「读取最新日记」重新解锁。"
              : "保存未完成，可能是浏览器空间不足。请保留此页面并导出加密备份。",
          ),
        );
    });
  }

  return { readVault, writeVault };
}
