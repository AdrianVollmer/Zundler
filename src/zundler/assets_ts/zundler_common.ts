/// <reference path="./globals.d.ts" />
/*
 * Functions that will be needed by several files
 */

import type { FileEntry } from "./types.ts";

const _base64ToArrayBuffer = (base64: string): ArrayBuffer | never[] => {
	if (!base64) {
		return [];
	}
	const binary_string = window.atob(base64);
	const len = binary_string.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binary_string.charCodeAt(i);
	}
	return bytes.buffer;
};

const isVirtual = (url: string | URL | null | undefined): boolean => {
	// Return true if the url should be retrieved from the virtual file tree.
	// A missing attribute (e.g. `getAttribute("href")` on a named-target
	// anchor) yields null; such elements are not virtual links.
	if (url == null) {
		return false;
	}
	const _url = url.toString().toLowerCase();
	return !(
		_url === "" ||
		_url[0] === "#" ||
		_url.startsWith("https:/") ||
		_url.startsWith("http:/") ||
		_url.startsWith("data:") ||
		_url.startsWith("javascript:") ||
		_url.startsWith("about:srcdoc") ||
		_url.startsWith("blob:")
	);
};

const splitUrl = (url: string): [string, string, string] => {
	// Return a list of three elements: path, GET parameters, anchor
	const anchor = url.split("#")[1] || "";
	const getParameters = url.split("#")[0].split("?")[1] || "";
	let path = url.split("#")[0];
	path = path.split("?")[0];
	const result: [string, string, string] = [path, getParameters, anchor];
	if (DEBUG) console.log("Split URL", url, result);
	return result;
};

const retrieveFileFromFileTree = (
	path: string,
	callback: (file: FileEntry) => void,
): void => {
	if (DEBUG) console.log("Retrieving file: " + path);
	const fileTree = window.globalContext.fileTree;
	const file = fileTree[path];
	if (!file) {
		console.warn(`File not found: ${path}`);
	} else {
		callback(file);
	}
};

const retrieveFileFromParent = (
	path: string,
	callback: (file: FileEntry) => void,
): void => {
	// Get the file into the iframe by messaging the parent document
	if (DEBUG) console.log("Retrieving file from parent: " + path);

	function messageHandler(event: MessageEvent) {
		if (event.data.action === "sendFile" && event.data.argument.path === path) {
			callback(event.data.argument.file);
			window.removeEventListener("message", messageHandler);
		}
	}

	window.addEventListener("message", messageHandler);

	window.parent.postMessage(
		{
			action: "retrieveFile",
			argument: {
				path: path,
			},
		},
		"*",
	);
};

const retrieveFile = (
	path: string,
	callback: (file: FileEntry) => void,
): void => {
	if (window.globalContext.fileTree) {
		retrieveFileFromFileTree(path, callback);
	} else {
		retrieveFileFromParent(path, callback);
	}
};

const fixLink = (a: Element): void => {
	const href = a.getAttribute("href");
	if (href == null) {
		// e.g. named-target anchors (<a name="section">): nothing to rewrite.
		return;
	}
	if (isVirtual(href)) {
		// virtualClick will be defined in the iFrame, but fixLink may be
		// called in the parent document, so we use `onclick`, because we
		// can define the function as a string
		a.setAttribute("onclick", "virtualClick(event)");
	} else if (href.startsWith("#")) {
		a.setAttribute("href", `about:srcdoc${a.getAttribute("href")}`);
	} else if (
		!href.startsWith("about:srcdoc") &&
		!href.startsWith("javascript:")
	) {
		// External links should open in a new tab. Browsers block links to
		// sites of different origin within an iframe for security reasons.
		a.setAttribute("target", "_blank");
	}
};

const fixForm = (form: Element): void => {
	const href = form.getAttribute("action");
	if (isVirtual(href) && form.getAttribute("method")!.toLowerCase() === "get") {
		form.setAttribute("onsubmit", "virtualClick(event)");
	}
};

const embedImg = (img: Element): void => {
	if (img.hasAttribute("src")) {
		const src = img.getAttribute("src");
		if (isVirtual(src)) {
			const path = normalizePath(src!);
			retrieveFile(path, (file) => {
				const mime_type = file.mime_type;
				if (mime_type === "image/svg+xml") {
					img.setAttribute(
						"src",
						`data:image/svg+xml;charset=utf-8;base64, ${btoa(file.data)}`,
					);
				} else {
					img.setAttribute("src", `data:${mime_type};base64, ${file.data}`);
				}
			});
		}
	}
};

const fixScriptTag = (doc: Document, oldScript: Element): void => {
	const newScript = doc.createElement("script");
	for (const attr of Array.from(oldScript.attributes)) {
		newScript.setAttribute(attr.name, attr.value);
	}
	try {
		if (
			newScript.hasAttribute("src") &&
			isVirtual(newScript.getAttribute("src"))
		) {
			const src = newScript.getAttribute("src");
			let [path, getParameters, anchor] = splitUrl(src!);
			path = normalizePath(path);
			console.debug(`Embed script: ${path}`);
			retrieveFile(path, (file) => {
				const src = `${file.data}\n//# sourceURL=${path}`;
				newScript.appendChild(doc.createTextNode(src));
				newScript.removeAttribute("src");
				oldScript.parentNode!.replaceChild(newScript, oldScript);
			});
		}
	} catch (e) {
		// Make sure all scripts are loaded
		console.error(`Caught error in ${oldScript.getAttribute("src")}`, e);
	}
};

const embedJs = (doc: Document): void => {
	for (const oldScript of Array.from(doc.querySelectorAll("script"))) {
		fixScriptTag(doc, oldScript);
	}
};

const embedCss = (doc: Document): void => {
	for (const link of Array.from(doc.querySelectorAll("link"))) {
		if (
			link.getAttribute("rel") === "stylesheet" &&
			link.getAttribute("href")
		) {
			const href = link.getAttribute("href");
			let [path, getParameters, anchor] = splitUrl(href!);
			path = normalizePath(path);
			retrieveFile(path, (file) => {
				const style = doc.createElement("style");
				style.textContent = file.data;
				link.replaceWith(style);
			});
		}
	}
};

const fixLinks = (doc: Document): void => {
	for (const a of Array.from(doc.querySelectorAll("a"))) {
		fixLink(a);
	}
};

const fixForms = (doc: Document): void => {
	for (const form of Array.from(doc.querySelectorAll("form"))) {
		fixForm(form);
	}
};

const embedImgs = (doc: Document): void => {
	for (const img of Array.from(doc.querySelectorAll("img"))) {
		embedImg(img);
	}
};

const normalizePath = (path: string | URL | { href: string }): string => {
	// make relative paths absolute
	let result: any = window.globalContext.current_path;
	result = result.split("/");
	result.pop();
	// path can be a request object
	let path_: any = path;
	if (!(typeof path === "string" || path instanceof String)) {
		path_ = path.href;
	}
	result = result.concat(path_.split("/"));

	// resolve relative directories
	const array: string[] = [];
	for (const component of Array.from(result) as string[]) {
		if (component === "..") {
			if (array) {
				array.pop();
			}
		} else if (component === ".") {
		} else {
			if (component) {
				array.push(component);
			}
		}
	}

	result = array.join("/");
	if (DEBUG) {
		console.log(
			`Normalized path: ${path} -> ${result} (@${window.globalContext.current_path})`,
		);
	}
	return result;
};

// Expose helpers for unit tests when loaded under Node. In the browser this
// script is injected as a <script> textContent, where `module` is undefined,
// so the guard is a no-op there.
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		isVirtual,
		splitUrl,
		normalizePath,
		fixLink,
		fixForm,
	};
}
