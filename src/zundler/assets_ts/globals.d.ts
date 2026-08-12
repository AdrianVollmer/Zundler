/*
 * Ambient declarations for the runtime globals shared across the injected
 * scripts.
 *
 * At runtime the five asset scripts are injected as plain `<script>` elements
 * that share one global lexical scope, so a `const` defined in
 * `zundler_common` is visible by name in `inject_pre`, `inject_post` and
 * `zundler_main`. The transpiler cannot see across files, so we declare the
 * shared surface here. Each source file references this via a triple-slash
 * directive.
 *
 * A file that also *defines* one of these symbols locally simply shadows the
 * ambient declaration within that file; there is no conflict.
 */

import type { FileEntry, GlobalContext } from "./types.ts";

declare global {
	/** Injected by `embed.py` as `const DEBUG = true|false;`. */
	const DEBUG: boolean;

	/** Injected by `embed.py` as `const zundler_version = "...";`. */
	const zundler_version: string;

	/** Present only when the embedded document ships jQuery. */
	// deno-lint-ignore no-explicit-any
	const jQuery: any;

	/** CommonJS shim, defined only when loaded under Node for unit tests. */
	const module: { exports: Record<string, unknown> } | undefined;

	interface Window {
		globalContext: GlobalContext;
	}

	// --- zundler_common ---
	function retrieveFile(
		path: string,
		callback: (file: FileEntry) => void,
	): void;
	function normalizePath(path: string | URL | { href: string }): string;
	function isVirtual(url: string | URL | null | undefined): boolean;
	function splitUrl(url: string): [string, string, string];
	function fixLink(a: Element): void;
	function fixForm(form: Element): void;
	function fixLinks(doc: Document): void;
	function fixForms(doc: Document): void;
	function embedImg(img: Element): void;
	function embedImgs(doc: Document): void;
	function embedJs(doc: Document): void;
	function embedCss(doc: Document): void;
	function fixScriptTag(doc: Document, oldScript: Element): void;
	const _base64ToArrayBuffer: (base64: string) => ArrayBuffer | never[];

	// --- inject_post ---
	function virtualClick(event: Event): boolean | undefined;

	// --- zundler_main ---
	function showPopup(): void;
	function hidePopup(): void;
	function setUpPopup(): void;
	function showLoadingIndicator(): void;
	function hideLoadingIndicator(): void;
	function downloadVirtualFile(path: string): Promise<void>;
}

export {};
