/*
 * Shared data-model types for the injected browser scripts.
 *
 * These are type-only: every import of this module uses `import type`, so the
 * transpiler erases it entirely and the emitted `.js` contains no import.
 */

/** A single entry in the virtual file tree. */
export interface FileEntry {
	data: string;
	mime_type: string;
	base64encoded: boolean;
}

/** The bundled JavaScript payloads injected at runtime. */
export interface ZundlerUtils {
	zundler_main: string;
	zundler_common: string;
	inject_pre: string;
	inject_post: string;
}

/** The global context shared between the parent document and the iframe. */
export interface GlobalContext {
	current_path: string;
	fileTree: Record<string, FileEntry>;
	utils: ZundlerUtils;
	getParameters?: string;
	anchor?: string;
}

/** Payload of the `postMessage` calls exchanged between parent and iframe. */
export interface ZundlerMessage {
	action: string;
	// Deliberately loose: each action carries a different argument shape.
	// deno-lint-ignore no-explicit-any
	argument?: Record<string, any>;
}
