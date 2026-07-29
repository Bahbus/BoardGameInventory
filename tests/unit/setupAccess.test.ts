import { describe, expect, it, vi } from "vitest";
import {
  clearSetupAccessSession,
  parseSetupServiceUrl,
  readSetupAccessSession,
  storeSetupAccessSession,
  verifySetupAccess
} from "../../src/lib/setupAccess";

describe("setup collaborator access", () => {
  it("accepts HTTPS services and local development HTTP only", () => {
    expect(parseSetupServiceUrl("https://auth.example.test/api")?.href).toBe(
      "https://auth.example.test/api/"
    );
    expect(parseSetupServiceUrl("http://127.0.0.1:4173/test")?.href).toBe(
      "http://127.0.0.1:4173/test/"
    );
    expect(parseSetupServiceUrl("http://auth.example.test")).toBeUndefined();
    expect(parseSetupServiceUrl("https://user:secret@auth.example.test")).toBeUndefined();
  });

  it("treats browser session storage as untrusted input", () => {
    const storage = {
      value: "",
      getItem() {
        return this.value;
      },
      setItem(_key: string, value: string) {
        this.value = value;
      },
      removeItem() {
        this.value = "";
      }
    };
    storage.value = '{"grant":7,"login":"owner","expiresAt":"tomorrow"}';
    expect(readSetupAccessSession(storage)).toBeUndefined();

    const session = {
      grant: "opaque-grant",
      login: "owner",
      expiresAt: "2099-01-01T00:00:00.000Z"
    };
    storeSetupAccessSession(session, storage);
    expect(readSetupAccessSession(storage)).toEqual(session);
    clearSetupAccessSession(storage);
    expect(readSetupAccessSession(storage)).toBeUndefined();
  });

  it("requires the service to reconfirm a stored grant", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          verified: true,
          login: "Bahbus",
          expiresAt: "2099-01-01T00:00:00.000Z"
        }),
        { status: 200 }
      )
    );
    const verified = await verifySetupAccess(
      new URL("https://auth.example.test/"),
      {
        grant: "opaque-grant",
        login: "untrusted-name",
        expiresAt: "2098-01-01T00:00:00.000Z"
      },
      fetcher
    );

    expect(verified.login).toBe("Bahbus");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://auth.example.test/api/setup/session"),
      expect.objectContaining({
        headers: { authorization: "Bearer opaque-grant" },
        method: "POST"
      })
    );
  });

  it("fails closed when verification is rejected", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(
      verifySetupAccess(
        new URL("https://auth.example.test/"),
        {
          grant: "expired",
          login: "someone",
          expiresAt: "2099-01-01T00:00:00.000Z"
        },
        fetcher
      )
    ).rejects.toThrow(/could not confirm collaborator access/i);
  });
});
