// @vitest-environment node

import type { HandlerEvent } from "@netlify/functions";
import { describe, expect, it } from "vitest";
import { normalizeNetlifyEvent } from "../../service/netlifyEvent";

const event = (
  headers: HandlerEvent["headers"],
  multiValueHeaders: HandlerEvent["multiValueHeaders"] = {}
): HandlerEvent => ({
  body: null,
  headers,
  httpMethod: "GET",
  isBase64Encoded: false,
  multiValueHeaders,
  multiValueQueryStringParameters: null,
  path: "/healthz",
  queryStringParameters: null,
  rawQuery: "",
  rawUrl: "https://setup.example.test/healthz"
});

describe("Netlify setup service adapter", () => {
  it("uses Netlify's trusted client address and removes forwarded address chains", () => {
    const normalized = normalizeNetlifyEvent(
      event(
        {
          "x-forwarded-for": "198.51.100.8, 10.0.0.1",
          "x-nf-client-connection-ip": "203.0.113.10"
        },
        { "X-Forwarded-For": ["198.51.100.8", "10.0.0.1"] }
      )
    );

    expect(normalized?.requestContext.identity.sourceIp).toBe("203.0.113.10");
    expect(normalized?.headers).not.toHaveProperty("x-forwarded-for");
    expect(normalized?.multiValueHeaders).not.toHaveProperty("X-Forwarded-For");
  });

  it("allows a forwarded address fallback only during local Netlify development", () => {
    const localEvent = event({ "x-forwarded-for": "127.0.0.1" });

    expect(normalizeNetlifyEvent(localEvent)).toBeUndefined();
    expect(normalizeNetlifyEvent(localEvent, true)?.requestContext.identity.sourceIp).toBe(
      "127.0.0.1"
    );
  });

  it("rejects a missing or malformed trusted client address", () => {
    expect(normalizeNetlifyEvent(event({}))).toBeUndefined();
    expect(
      normalizeNetlifyEvent(event({ "x-nf-client-connection-ip": "not-an-ip-address" }))
    ).toBeUndefined();
  });
});
