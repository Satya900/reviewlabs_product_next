import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page renders per request (no ISR or cached fetches), so there is
// nothing for an incremental cache to store and we don't configure one.
export default defineCloudflareConfig({});
