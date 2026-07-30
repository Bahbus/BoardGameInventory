import { describe, expect, it } from "vitest";
import { setupServiceOrigin } from "../../vite.config";

describe("setup service browser policy", () => {
  it("allows only HTTPS origins and loopback HTTP development", () => {
    expect(setupServiceOrigin("https://setup.example.test/api/")).toBe(
      "https://setup.example.test"
    );
    expect(setupServiceOrigin("http://127.0.0.1:8787/")).toBe("http://127.0.0.1:8787");
    expect(setupServiceOrigin("http://setup.example.test/")).toBeUndefined();
    expect(setupServiceOrigin("https://user:secret@setup.example.test/")).toBeUndefined();
  });
});
