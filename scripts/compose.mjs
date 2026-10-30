import { spawnSync } from "node:child_process";
const plugin =
  spawnSync("docker", ["compose", "version"], { stdio: "ignore" }).status === 0;
const result = spawnSync(
  plugin ? "docker" : "docker-compose",
  plugin ? ["compose", ...process.argv.slice(2)] : process.argv.slice(2),
  { stdio: "inherit" },
);
if (result.error)
  console.error(
    "Install Docker Compose to start the local PostgreSQL service.",
  );
process.exit(result.status ?? 1);
