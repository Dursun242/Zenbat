import { describe, it, expect, vi, beforeEach } from "vitest";

const lookupMock = vi.fn();
vi.mock("node:dns/promises", () => {
  const lookup = (...a) => lookupMock(...a);
  return { lookup, default: { lookup } };
});

import { isPrivateIp, assertPublicHost, safeFetch } from "./_ssrf.js";

describe("isPrivateIp", () => {
  it.each([
    "127.0.0.1", "127.255.255.254", "10.1.2.3", "192.168.0.1", "172.16.0.1", "172.31.255.255",
    "169.254.169.254", "0.0.0.0", "0.1.2.3", "100.64.0.1", "100.127.255.255",
    "224.0.0.1", "255.255.255.255",
    "::", "::1", "[::1]", "0:0:0:0:0:0:0:1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::ffff:10.0.0.1", "0:0:0:0:0:ffff:7f00:1",
    "::127.0.0.1", "64:ff9b::7f00:1",
    "fc00::1", "fd12:3456::1", "fe80::1", "fe80::1%eth0", "febf::1", "fec0::1", "ff02::1",
    "", null, undefined, "pas-une-ip",
  ])("bloque %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each([
    "1.1.1.1", "8.8.8.8", "100.63.255.255", "100.128.0.1", "172.15.255.255", "172.32.0.1",
    "169.253.0.1", "93.184.216.34",
    "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "::ffff:808:808", "64:ff9b::808:808",
  ])("laisse passer %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe("assertPublicHost", () => {
  beforeEach(() => lookupMock.mockReset());

  it("refuse une IPv6 littérale entre crochets (URL.hostname)", async () => {
    await expect(assertPublicHost(new URL("http://[::ffff:127.0.0.1]/").hostname)).rejects.toThrow(/privée/);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("refuse un domaine dont une des adresses est privée", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "::1", family: 6 }]);
    await expect(assertPublicHost("piege.example")).rejects.toThrow(/IP privée/);
    expect(lookupMock).toHaveBeenCalledWith("piege.example", { all: true });
  });

  it("accepte un domaine public", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(assertPublicHost("example.com")).resolves.toBeUndefined();
  });
});

describe("safeFetch : redirections revérifiées", () => {
  const redirect = (location, status = 302) => ({
    status, ok: false,
    headers: { get: (k) => (k.toLowerCase() === "location" ? location : null) },
    body: { cancel: vi.fn(async () => {}) },
  });
  const okResp = { status: 200, ok: true, headers: { get: () => "text/html" } };

  beforeEach(() => {
    lookupMock.mockReset();
    global.fetch = vi.fn();
  });

  it("refuse une redirection vers une IP privée sans la suivre", async () => {
    global.fetch.mockResolvedValueOnce(redirect("http://169.254.169.254/latest/meta-data/"));
    await expect(safeFetch("https://1.1.1.1/")).rejects.toThrow(/privée/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].redirect).toBe("manual");
  });

  it("refuse une redirection vers un domaine qui résout en privé", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    global.fetch.mockResolvedValueOnce(redirect("https://intranet.example/"));
    await expect(safeFetch("https://1.1.1.1/")).rejects.toThrow(/IP privée/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("refuse une redirection vers un autre protocole", async () => {
    global.fetch.mockResolvedValueOnce(redirect("file:///etc/passwd"));
    await expect(safeFetch("https://1.1.1.1/")).rejects.toThrow(/Protocole/);
  });

  it("suit une redirection publique relative", async () => {
    global.fetch
      .mockResolvedValueOnce(redirect("/contact", 301))
      .mockResolvedValueOnce(okResp);
    const r = await safeFetch("https://1.1.1.1/");
    expect(r).toBe(okResp);
    expect(global.fetch.mock.calls[1][0]).toBe("https://1.1.1.1/contact");
  });

  it("s'arrête après 3 redirections", async () => {
    global.fetch.mockResolvedValue(redirect("https://1.1.1.1/boucle"));
    await expect(safeFetch("https://1.1.1.1/")).rejects.toThrow(/Trop de redirections/);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });
});
