/**
 * Bundles every node action entrypoint into a self-contained dist/ bundle
 * with @vercel/ncc. GitHub runs node actions straight from the committed
 * dist/ output, so `npm run build` must be re-run (and dist/ committed)
 * whenever src/ changes — .github/workflows/check-dist.yml enforces this.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ncc from "@vercel/ncc";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** dist/<name>/index.js → the action entrypoint it is bundled from. */
const ACTION_ENTRIES = {
  "portainer-deploy": "src/application/portainer/actions/deploy-action.ts",
  "portainer-stack-exists": "src/application/portainer/actions/stack-exists-action.ts",
  "portainer-rollback": "src/application/portainer/actions/rollback-action.ts",
  "docker-metadata": "src/application/docker/actions/docker-metadata-action.ts",
};

await rm(join(root, "dist"), { recursive: true, force: true });

for (const [name, entry] of Object.entries(ACTION_ENTRIES)) {
  const outDir = join(root, "dist", name);
  await mkdir(outDir, { recursive: true });

  const { code, assets } = await ncc(join(root, entry), {
    minify: false,
    quiet: true,
    target: "es2022",
  });

  await writeFile(join(outDir, "index.js"), code);
  for (const [assetName, asset] of Object.entries(assets ?? {})) {
    const assetPath = join(outDir, assetName);
    await mkdir(dirname(assetPath), { recursive: true });
    await writeFile(assetPath, asset.source);
  }

  console.log(`bundled ${entry} -> dist/${name}/index.js`);
}
