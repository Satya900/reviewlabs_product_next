// The Cloudflare build copies every .env* file into the deployed Worker, so a
// deploy from a laptop would ship local secrets and test keys. Production is
// built by Cloudflare from GitHub, where only the committed, public-only
// .env.production exists.
import fs from "node:fs";

const found = fs.readdirSync(".").filter((f) => /^\.env(\..+)?$/.test(f) && ![".env.example", ".env.production"].includes(f));
if (found.length) {
  console.error(`Refusing to deploy: ${found.join(", ")} would be bundled into the Worker. Deploy by pushing to main instead.`);
  process.exit(1);
}
