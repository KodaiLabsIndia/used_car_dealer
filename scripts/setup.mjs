import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
const root = new URL("../", import.meta.url);
const address =
  Object.values(networkInterfaces())
    .flat()
    .find((a) => a?.family === "IPv4" && !a.internal)?.address || "localhost";
const env = new URL(".env", root);
if (!existsSync(env)) {
  const template = readFileSync(new URL(".env.example", root), "utf8").replace(
    "replace-with-a-long-random-local-code",
    randomBytes(18).toString("base64url"),
  );
  writeFileSync(env, template, { mode: 0o600 });
  console.log(
    "Created private .env. Development sign-in code is DEV_ACCESS_CODE in that file.",
  );
}
const mobileEnv = new URL("apps/mobile/.env.local", root);
if (!existsSync(mobileEnv)) {
  writeFileSync(mobileEnv, `EXPO_PUBLIC_API_URL=http://${address}:4100\n`);
  console.log(`Configured Expo Go API address: http://${address}:4100`);
}
console.log(
  "Next: npm run db:up, npm run db:migrate, npm run db:seed, npm run dev:api, npm run dev:mobile.",
);
