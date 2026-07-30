import type { Handler, HandlerResponse } from "@netlify/functions";
import serverless from "serverless-http";
import { createConfiguredSetupService } from "../../service/configuredApp";
import { normalizeNetlifyEvent } from "../../service/netlifyEvent";

const { app } = createConfiguredSetupService();
const expressHandler = serverless(app);

export const handler: Handler = async (event, context): Promise<HandlerResponse> => {
  const normalizedEvent = normalizeNetlifyEvent(event, process.env.NETLIFY_DEV === "true");
  if (!normalizedEvent) {
    return {
      statusCode: 503,
      headers: { "cache-control": "no-store", "content-type": "application/json" },
      body: JSON.stringify({
        code: "client_address_unavailable",
        message: "Setup is temporarily unavailable."
      })
    };
  }

  return (await expressHandler(normalizedEvent, context)) as HandlerResponse;
};
