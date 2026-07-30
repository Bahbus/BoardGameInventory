import { isIP } from "node:net";
import type { HandlerEvent } from "@netlify/functions";

const localClientAddress = (event: HandlerEvent) =>
  event.headers["client-ip"] ??
  event.headers["x-forwarded-for"]?.split(",", 1)[0]?.trim() ??
  undefined;

export function normalizeNetlifyEvent(event: HandlerEvent, localDevelopment = false) {
  const sourceIp =
    event.headers["x-nf-client-connection-ip"] ??
    (localDevelopment ? localClientAddress(event) : undefined);
  if (!sourceIp || !isIP(sourceIp)) return undefined;

  const headers = Object.fromEntries(
    Object.entries(event.headers).filter(([name]) => name.toLowerCase() !== "x-forwarded-for")
  );
  const multiValueHeaders = Object.fromEntries(
    Object.entries(event.multiValueHeaders).filter(
      ([name]) => name.toLowerCase() !== "x-forwarded-for"
    )
  );

  return {
    ...event,
    headers,
    multiValueHeaders,
    requestContext: { identity: { sourceIp } }
  };
}
