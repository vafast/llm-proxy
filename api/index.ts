// Vercel function (Node.js). Bundled at build time (tsdown) to dist/vercel.mjs to avoid path-alias/tracing issues.
// @ts-ignore generated at build
import { vercelHandler } from "../dist/vercel.mjs";
export default vercelHandler as { fetch: (req: Request) => Promise<Response> };
