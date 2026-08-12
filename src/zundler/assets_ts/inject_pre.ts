/// <reference path="./globals.d.ts" />
/*
 * This file will be inserted as the first child of the iframe's <head>
 * after `common.js` and the definition of the global context.
 */

import type { FileEntry } from "./types.ts";

/*
 * Monkeypatch URLSearchParams
 *
 * Sphinx documents that use `searchtool.js` rely on passing information via
 * GET parameters (aka search parameters). Unfortunately, this doesn't work
 * in our approach due to the same origin policy, so we have to get ...
 * creative.
 *
 * Here, we patch the `URLSearchParams` class so it returns the information
 * stored in `window.globalContext.getParameters`.
 */

const originalGet = URLSearchParams.prototype.get;

const myGet = function (this: URLSearchParams, arg: string): string | null {
	// If searchtools.js of sphinx is used
	if (
		window.globalContext?.getParameters &&
		window.location.search === "" &&
		Array.from(this.entries()).length === 0
	) {
		const params = new URLSearchParams(
			`?${window.globalContext.getParameters}`,
		);
		const result = params.get(arg);
		// console.log("Return virtual get parameter:", arg, result);
		return result;
	}
	const originalResult = originalGet.apply(this, [arg]);
	return originalResult;
};

const myDelete = (arg: string): void => {};

URLSearchParams.prototype.get = myGet;
URLSearchParams.prototype.delete = myDelete;

/*
 * Monkeypatch window.history
 */

const myReplaceState = (arg1: any, arg2: any, arg3?: any): void => {};
window.history.replaceState = myReplaceState;

/*
 * Monkeypatch window.fetch
 */

const { fetch: originalFetch } = window;

function waitForParentResponse(path: string): Promise<FileEntry> {
	return new Promise((resolve, reject) => {
		retrieveFile(path, (file) => {
			resolve(file);
		});
	});
}

window.fetch = async (...args: any[]): Promise<Response> => {
	const [resource, config] = args;
	const path = normalizePath(resource);
	let response: Response;
	if (isVirtual(path)) {
		const file = await waitForParentResponse(path);
		let data: any = file.data;
		if (file.base64encoded) {
			data = _base64ToArrayBuffer(data);
		}
		response = new Response(data);
		response.headers.set("content-type", file.mime_type);
	} else {
		response = await originalFetch(resource, config);
	}
	return response;
};

const embedImgFromParent = (img: Element): void => {
	function setSrc(img: Element, file: FileEntry) {
		if (file.mime_type === "image/svg+xml") {
			img.setAttribute(
				"src",
				`data:image/svg+xml;charset=utf-8;base64, ${btoa(file.data)}`,
			);
		} else {
			img.setAttribute("src", `data:${file.mime_type};base64, ${file.data}`);
		}
	}

	if (img.hasAttribute("src")) {
		const src = img.getAttribute("src");
		if (isVirtual(src)) {
			const path = normalizePath(src!);
			retrieveFile(path, (file) => setSrc(img, file));
		}
	}
};

const observer = new MutationObserver((mutationList) => {
	if (DEBUG) console.log("Fix mutated elements...", mutationList);
	for (const mutation of mutationList) {
		if (mutation.type === "childList") {
			const target = mutation.target as Element;
			for (const a of Array.from(target.querySelectorAll("a"))) {
				fixLink(a);
			}
			for (const img of Array.from(target.querySelectorAll("img"))) {
				embedImgFromParent(img);
			}
			for (const form of Array.from(target.querySelectorAll("form"))) {
				fixForm(form);
			}
			for (
				const scr of Array.from(
					target.querySelectorAll("script"),
				)
			) {
				fixScriptTag(document, scr);
			}
		}
	}
});

document.addEventListener("DOMContentLoaded", (event) => {
	observer.observe(window.document.body, { subtree: true, childList: true });
});
