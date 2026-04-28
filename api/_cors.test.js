import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

function makeRes() {
  const headers = {};
  return {
    headers,
    setHeader: (k, v) => { headers[k] = v; },
    getHeader: (k) => headers[k],
  };
}

function makeReq(origin) {
  return { headers: { origin } };
}

const ENV_KEYS = ["VERCEL_ENV", "ALLOWED_ORIGINS"];
let snapshot;

beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else                            process.env[k] = snapshot[k];
  }
  vi.resetModules();
});

async function loadCors() {
  // Le module lit ALLOWED_ORIGINS au top-level → reload à chaque test pour
  // appliquer le nouveau process.env.
  return (await import("./_cors.js")).cors;
}

describe("cors helper", () => {
  it("autorise une origine présente dans ALLOWED_ORIGINS en prod", async () => {
    process.env.VERCEL_ENV       = "production";
    process.env.ALLOWED_ORIGINS  = "https://zenbat.fr,https://app.zenbat.fr";
    const cors = await loadCors();
    const res = makeRes();
    cors(makeReq("https://zenbat.fr"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://zenbat.fr");
  });

  it("rejette une origine non whitelisted en prod (header absent)", async () => {
    process.env.VERCEL_ENV       = "production";
    process.env.ALLOWED_ORIGINS  = "https://zenbat.fr";
    const cors = await loadCors();
    const res = makeRes();
    cors(makeReq("https://attacker.example.com"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("autorise localhost en dev même hors whitelist", async () => {
    process.env.VERCEL_ENV       = "preview";
    process.env.ALLOWED_ORIGINS  = "";
    const cors = await loadCors();
    const res = makeRes();
    cors(makeReq("http://localhost:5173"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });

  it("autorise 127.0.0.1 en dev", async () => {
    process.env.VERCEL_ENV       = "preview";
    process.env.ALLOWED_ORIGINS  = "";
    const cors = await loadCors();
    const res = makeRes();
    cors(makeReq("http://127.0.0.1:3000"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("http://127.0.0.1:3000");
  });

  it("rejette une origine random en preview", async () => {
    process.env.VERCEL_ENV       = "preview";
    process.env.ALLOWED_ORIGINS  = "";
    const cors = await loadCors();
    const res = makeRes();
    cors(makeReq("https://attacker.example.com"), res);
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("ajoute Vary: Origin", async () => {
    const cors = await loadCors();
    const res = makeRes();
    cors(makeReq("https://x.com"), res);
    expect(res.headers["Vary"]).toBe("Origin");
  });

  it("inclut Authorization dans Allow-Headers quand auth=true (default)", async () => {
    const cors = await loadCors();
    const res = makeRes();
    cors(makeReq(""), res);
    expect(res.headers["Access-Control-Allow-Headers"]).toContain("Authorization");
  });

  it("exclut Authorization quand auth=false", async () => {
    const cors = await loadCors();
    const res = makeRes();
    cors(makeReq(""), res, { auth: false });
    expect(res.headers["Access-Control-Allow-Headers"]).not.toContain("Authorization");
  });

  it("propage la liste des methods passée en option", async () => {
    const cors = await loadCors();
    const res = makeRes();
    cors(makeReq(""), res, { methods: "GET, OPTIONS" });
    expect(res.headers["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
  });
});
