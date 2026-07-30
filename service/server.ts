import { createServer } from "node:http";
import { createSetupService } from "./app";
import { parseServiceConfig } from "./config";
import { GitHubSetupGateway } from "./github";

const config = parseServiceConfig(process.env);
const app = createSetupService({ config, gateway: new GitHubSetupGateway(config) });
const server = createServer(app);

server.requestTimeout = 15_000;
server.headersTimeout = 20_000;
server.keepAliveTimeout = 5_000;
server.on("clientError", (_error, socket) => socket.destroy());

server.listen(config.port, config.host, () => {
  console.log(`Setup service listening on ${config.host}:${config.port}.`);
});

const shutdown = () => {
  server.close((error) => {
    if (error) {
      console.error("Setup service shutdown failed.");
      process.exitCode = 1;
    }
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
