export function testRecords() {
  const rows = new Map();
  async function request(url, options = {}) {
    const q = new URL(url).searchParams,
      method = options.method || "GET";
    const matches = [...rows].filter(
      ([key, r]) =>
        q.getAll("key").every((filter) => {
          if (filter.startsWith("eq.")) return key === filter.slice(3);
          if (filter.startsWith("lt.")) return key < filter.slice(3);
          if (filter.startsWith("like."))
            return key.startsWith(filter.slice(5, -1));
          throw Error("unhandled filter " + filter);
        }) &&
        (!q.has("value->>revision") ||
          "eq." + r.value.revision === q.get("value->>revision")),
    );
    const value = options.body ? JSON.parse(options.body) : null;
    if (method === "GET")
      return Response.json(
        matches.map(([key, r]) => (q.get("select") === "key" ? { key } : r)),
      );
    if (method === "POST") {
      if (!rows.has(value.key)) rows.set(value.key, value);
      return new Response(null, { status: 201 });
    }
    if (method === "PATCH") {
      for (const [k, r] of matches) rows.set(k, { ...r, ...value });
      return Response.json(matches.map(([key]) => ({ key })));
    }
    if (method === "DELETE") {
      for (const [k] of matches) rows.delete(k);
      return new Response(null, { status: 204 });
    }
    throw Error("unhandled method " + method);
  }
  return { rows, request };
}
