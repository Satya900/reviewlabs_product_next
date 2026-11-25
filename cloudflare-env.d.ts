// Bindings from wrangler.jsonc, as seen by getCloudflareContext().env.
// Settings and secrets are read through process.env as before.
interface CloudflareEnv {
  ASSETS: { fetch(request: Request | string): Promise<Response> };
  IMAGES: {
    input(stream: ReadableStream<Uint8Array>): {
      transform(options: { width?: number; height?: number; fit?: "scale-down" | "contain" | "cover" }): {
        output(options: { format: "image/webp" | "image/gif" | "image/jpeg" | "image/png"; quality?: number; anim?: boolean }): Promise<{ response(): Response }>;
      };
    };
  };
}
