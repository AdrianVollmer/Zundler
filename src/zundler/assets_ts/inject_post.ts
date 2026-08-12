/// <reference path="./globals.d.ts" />
/*
 * This file will be inserted as the last child of the iframe's <body>
 */

const virtualClick = (evnt: Event): boolean | undefined => {
	// Handle GET parameters and anchors
	// console.log("Virtual click", evnt);

	const el = evnt.currentTarget as HTMLElement;
	const name = el.tagName.toLowerCase();
	let path: any;
	let getParameters: any;
	let anchor: any;

	if (name === "a") {
		[path, getParameters, anchor] = splitUrl(el.getAttribute("href")!);
	} else if (name === "form") {
		[path, getParameters, anchor] = splitUrl(el.getAttribute("action")!);
		const formData = new FormData(el as HTMLFormElement);
		getParameters = new URLSearchParams(formData as any).toString();
	} else {
		console.error("Invalid element", el);
	}

	path = normalizePath(path);

	window.parent.postMessage(
		{
			action: "virtualClick",
			argument: {
				path: path,
				getParameters: getParameters,
				anchor: anchor,
			},
		},
		"*",
	);
	evnt.preventDefault();
	evnt.stopPropagation();
	return false;
};

const onScrollToAnchor = (): void => {
	if (window.globalContext.anchor) {
		document.location.replace(`about:srcdoc#${window.globalContext.anchor}`);
	}
};

const monkeyPatch = (): void => {
	if (typeof jQuery === "undefined") {
		return;
	} // Only for jQuery at the moment
	/**
	 * Monkey patch getQueryParameters
	 * This function is defined in Sphinx' (v4) doctools.js and incompatible with our
	 * approach.
	 * This is a copy with effectively only the third line changed.
	 * See: https://github.com/sphinx-doc/sphinx/blob/2329fdef8c20c6c75194f5d842b8f62ebad5c79d/sphinx/themes/basic/static/doctools.js#L54
	 */
	jQuery._getQueryParameters = jQuery.getQueryParameters;
	jQuery.getQueryParameters = (s: any) => {
		let ss = s;
		if (typeof s === "undefined") ss = `?${window.globalContext.getParameters}`;
		return jQuery._getQueryParameters(s);
	};

	/**
	 * Monkey patch jQuery.ajax
	 * Only settings.url and settings.complete are supported for virtual
	 * URLs.
	 */
	jQuery._ajax = jQuery.ajax;
	jQuery.ajax = (settings: any) => {
		const url = normalizePath(settings.url);
		if (isVirtual(url)) {
			retrieveFile(url, (file) => {
				settings.complete({ responseText: file.data }, "");
			});
			return; // Return value not actually needed in searchtools.js
		}
		return jQuery.ajax(settings);
	};
};

monkeyPatch();

// Set up message listener
window.addEventListener(
	"message",
	(evnt: MessageEvent) => {
		if (DEBUG) console.log("Received message in iframe", evnt.data);
		if (evnt.data.action === "scrollToAnchor") {
			onScrollToAnchor();
		}
	},
	false,
);

window.parent.postMessage(
	{
		action: "ready",
	},
	"*",
);

document.addEventListener("keyup", (event) => {
	if (event.key === "Z" && event.ctrlKey) {
		window.parent.postMessage(
			{
				action: "showMenu",
			},
			"*",
		);
	}
});

document.addEventListener("DOMContentLoaded", (event) => {
	// Look for fixable nodes because scripts may have altered the DOM with
	// document.write()
	embedJs(document);
	embedCss(document);
	embedImgs(document);
	fixLinks(document);
	fixForms(document);
});
