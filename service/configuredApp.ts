import { createSetupService } from "./app";
import { parseServiceConfig } from "./config";
import { GitHubSetupGateway } from "./github";

export function createConfiguredSetupService(
  environment: Record<string, string | undefined> = process.env
) {
  const config = parseServiceConfig(environment);
  return {
    app: createSetupService({ config, gateway: new GitHubSetupGateway(config) }),
    config
  };
}
