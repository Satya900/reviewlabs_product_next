// The Cloudflare build copies every .env* file into the deployed Worker, so a
// deploy from a laptop would ship local secrets and test keys. Production is
// built by Cloudflare from GitHub, where these files don't exist.
import fs from "node:fs";

const found = fs.readdirSync(".").filter((f) => /^\.env(\..+)?$/.test(f) && f !== ".env.example");
if (found.length) {
  console.error(`Refusing to deploy: ${found.join(", ")} would be bundled into the Worker. Deploy by pushing to main instead.`);
  process.exit(1);
}
