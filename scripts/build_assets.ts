/*
 * Transpile the TypeScript asset sources to the plain `.js` files that
 * `embed.py` injects at runtime.
 *
 * The output is a pure type-strip: no bundling, no module wrapper. The five
 * scripts share a single global scope when injected as `<script>` elements, so
 * the emitted JS must keep its top-level declarations at the top level. Any
 * `import type` is erased, leaving no runtime import.
 */

import { transpile } from "@deno/emit";

const SRC_DIR = new URL("../src/zundler/assets_ts/", import.meta.url);
const OUT_DIR = new URL("../src/zundler/assets/", import.meta.url);

const ENTRYPOINTS = [
	"zundler_common.ts",
	"zundler_main.ts",
	"inject_pre.ts",
	"inject_post.ts",
	"zundler_bootstrap.ts",
];

/** Drop the triple-slash reference directive; it points at a dev-only .d.ts. */
function stripReferences(code: string): string {
	return code.replace(/^\/\/\/\s*<reference[^\n]*>\n/gm, "");
}

for (const entry of ENTRYPOINTS) {
	const url = new URL(entry, SRC_DIR);
	const result = await transpile(url);
	const code = result.get(url.href);
	if (code === undefined) {
		throw new Error(`No transpiled output for ${entry}`);
	}
	const outName = entry.replace(/\.ts$/, ".js");
	const outPath = new URL(outName, OUT_DIR);
	await Deno.writeTextFile(outPath, stripReferences(code));
	console.log(`transpiled ${entry} -> assets/${outName}`);
}
