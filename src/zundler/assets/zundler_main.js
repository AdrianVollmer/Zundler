const iFrameId = "zundler-iframe";

const setFavicon = (href) => {
	if (!href) {
		return;
	}
	const favicon = document.createElement("link");
	favicon.setAttribute("rel", "shortcut icon");
	href_ = normalizePath(href);
	const file = window.globalContext.fileTree[href_];
	if (!file) {
		return;
	}
	if (file.mime_type === "image/svg+xml") {
		favicon.setAttribute(
			"href",
			`data:${file.mime_type};charset=utf-8;base64,${btoa(file.data)}`,
		);
		favicon.setAttribute("type", file.mime_type);
	} else {
		if (file.base64encoded) {
			favicon.setAttribute(
				"href",
				`data:${file.mime_type};base64,${file.data}`,
			);
		}
	}
	document.head.appendChild(favicon);
};

const createIframe = (html) => {
	const iframe = document.createElement("iframe");
	iframe.setAttribute("src", "#");
	iframe.setAttribute("name", iFrameId);
	iframe.setAttribute("id", iFrameId);
	iframe.setAttribute("srcdoc", html);
	return iframe;
};

function deepCopyExcept(obj, skipProps) {
	if (obj === null || typeof obj !== "object") {
		return obj;
	}

	const result = Array.isArray(obj) ? [] : {};

	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			if (!skipProps.includes(key)) {
				result[key] = deepCopyExcept(obj[key], skipProps);
			}
		}
	}

	return result;
}

const prepare = (html) => {
	function unicodeToBase64(string) {
		const utf8EncodedString = unescape(encodeURIComponent(string));
		return btoa(utf8EncodedString);
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Insert the global context into the iframe's DOM, but without the file
	// tree or utils. They are not necessary; the iframe will message the
	// parent document to retrieve files.
	//
	// Convert JSON object to b64 because it contain all kinds of
	// problematic characters: `, ", ', &, </script>, ...
	// atob is insufficient, because it only deals with ASCII - we have
	// unicode
	const gcTag = doc.createElement("script");
	const strippedGC = deepCopyExcept(window.globalContext, [
		"fileTree",
		"utils",
	]);

	const serializedGC = unicodeToBase64(JSON.stringify(strippedGC));

	gcTag.textContent = `
        function base64ToUnicode(base64String) {
            const utf8EncodedString = atob(base64String);
            return decodeURIComponent(escape(utf8EncodedString));
        }

        window.globalContext = JSON.parse(base64ToUnicode("${serializedGC}"));
    `;

	const commonTag = doc.createElement("script");
	commonTag.textContent = window.globalContext.utils.zundler_common;
	const injectPreTag = doc.createElement("script");
	injectPreTag.textContent = window.globalContext.utils.inject_pre;
	const injectPostTag = doc.createElement("script");
	injectPostTag.textContent = window.globalContext.utils.inject_post;

	doc.head.prepend(commonTag);
	doc.head.prepend(gcTag);
	doc.head.prepend(injectPreTag);
	doc.body.append(injectPostTag);

	embedJs(doc);
	embedCss(doc);
	embedImgs(doc);

	fixLinks(doc);
	fixForms(doc);

	window.document.title = doc.title;

	return doc.documentElement.outerHTML;
};

const loadVirtualPage = (path, getParams, anchor) => {
	// fill the iframe with the new page
	// return True if it worked
	// return False if loading indicator should be removed right away
	const file = window.globalContext.fileTree[path];

	if (!file) {
		console.error("File not found:", path, getParams, anchor);
		return false;
	}

	const data = file.data;
	window.globalContext.getParameters = getParams;

	// libmagic doesn't properly recognize mimetype of HTMl files that start
	// with empty lines. It thinks it's javascript. So we also consider the
	// filename when determining the file type.
	if (file.mime_type === "text/html" || path.toLowerCase().endsWith(".html")) {
		window.globalContext.current_path = path;
		window.globalContext.anchor = anchor;
		const html = prepare(data);
		window.history.pushState({ path, getParams, anchor }, "", "#");

		const oldIframe = document.getElementById(iFrameId);
		if (oldIframe) {
			oldIframe.setAttribute("id", `old-${iFrameId}`);
		}

		const iframe = createIframe(html);
		window.document.body.append(iframe);

		return true;
	}
	const blob = new Blob([data], { type: file.mime_type });
	const url = URL.createObjectURL(blob);
	const myWindow = window.open(url, "_blank");
	return false;
};

function main() {
	setUpPopup();

	// Set up message listener
	window.addEventListener(
		"message",
		(evnt) => {
			console.log("Received message in parent", evnt.data);
			const iframe = document.getElementById(iFrameId);

			if (evnt.data.action === "ready") {
				// iframe is ready
				hideLoadingIndicator();
				iframe.contentWindow.postMessage(
					{
						action: "scrollToAnchor",
					},
					"*",
				);
				const oldIframe = document.getElementById(`old-${iFrameId}`);
				if (oldIframe) {
					oldIframe.remove();
				}
				iframe.contentWindow.document.body.focus();
			} else if (evnt.data.action === "retrieveFile") {
				const path = evnt.data.argument.path;
				retrieveFile(path, (file) => {
					iframe.contentWindow.postMessage(
						{
							action: "sendFile",
							argument: {
								path: path,
								file: file,
							},
						},
						"*",
					);
				});
			} else if (evnt.data.action === "showMenu") {
				showPopup();
			} else if (evnt.data.action === "set_title") {
				// iframe has finished loading and sent us its title
				// parent sets the title and responds with the globalContext object
				window.document.title = evnt.data.argument.title;
				setFavicon(evnt.data.argument.favicon);
			} else if (evnt.data.action === "virtualClick") {
				// user has clicked on a link in the iframe
				// showLoadingIndicator();
				const loaded = loadVirtualPage(
					evnt.data.argument.path,
					evnt.data.argument.getParameters,
					evnt.data.argument.anchor,
				);
				if (!loaded) {
					hideLoadingIndicator();
				}
			}
		},
		false,
	);

	// Set up history event listener
	window.addEventListener("popstate", (evnt) => {
		loadVirtualPage(evnt.state.path, evnt.state.get_params, evnt.state.anchor);
	});

	// Load first page
	loadVirtualPage(window.globalContext.current_path, "", "");
}

const showLoadingIndicator = () => {
	const loading = document.getElementById("loading-indicator");
	loading.style.display = "";
};

const hideLoadingIndicator = () => {
	const loading = document.getElementById("loading-indicator");
	loading.style.display = "none";
};

/***** Code for the popup menu *****/

function showPopup() {
	document.getElementById("zundler-popup").style.display = "block";
}

function hidePopup() {
	document.getElementById("zundler-popup").style.display = "none";
}

function fromHTML(html, trim = true) {
	html_ = trim ? html.trim() : html;
	if (!html_) return null;
	const template = document.createElement("template");
	template.innerHTML = html_;
	const result = template.content.children;
	if (result.length === 1) return result[0];
	return result;
}

function setUpPopup() {
	document.addEventListener("keyup", (event) => {
		if (event.key === "Z" && event.ctrlKey) {
			showPopup();
		}
	});

	const popupHTML = `
    <div id="zundler-popup" class="zundler-popup">
        <div class="zundler-popup-sidebar">
            <h3>Zundler</h3>
            <ul>
                <li><a href="#" data-target="info">Info</a>
                <li><a href="#" data-target="file-tree">Embedded Files</a>
            </ul>
        </div>
        <div class="zundler-popup-content">
            <button class="zundler-popup-close-btn" onclick="hidePopup()">
    <svg fill="#000000" height="1em" width="1em" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"> <g> <g> <polygon points="512,59.076 452.922,0 256,196.922 59.076,0 0,59.076 196.922,256 0,452.922 59.076,512 256,315.076 452.922,512 512,452.922 315.076,256"/> </g> </g> </svg>
            </button>
            <div class="content-frame">
                <div id="content-info" class="content-section">
                    <h1>Info</h1>
                    <p>This file has been prepared using <a target="_blank" title="Zundler" href="https://github.com/AdrianVollmer/Zundler">Zundler</a>.</p>
                    <p>Version: ${zundler_version}</p>
                </div>
                <div id="content-file-tree" class="content-section">
                    <h1>Embedded Files</h1>
                    <div id="file-tree"><ul></ul></div>
                </div>
            </div>
        </div>
    </div>`;
	const popup = fromHTML(popupHTML);

	// Set visibility of content
	popup.querySelectorAll(".content-section").forEach((div, i) => {
		if (i > 0) {
			div.style.display = "none";
		}
	});

	// Set up events
	for (const a of popup.querySelectorAll(".zundler-popup-sidebar li a")) {
		a.addEventListener("click", (e) => {
			const target = e.target.dataset.target;
			// Hide all content divs
			for (const div of document.querySelectorAll(".content-section")) {
				div.style.display = "none";
			}

			// Show the selected content div
			document.getElementById(`content-${target}`).style.display = "block";
		});
	}

	for (const [path, file] of Object.entries(window.globalContext.fileTree)) {
		const listitem = document.createElement("li");
		const link = document.createElement("a");
		listitem.append(link);
		link.setAttribute("href", "#");
		link.addEventListener("click", (e) => downloadVirtualFile(path));
		link.innerText = path;
		popup.querySelector("#file-tree ul").append(listitem);
	}

	document.body.append(popup);
}

async function downloadVirtualFile(path) {
	retrieveFile(path, (file) => {
		let data;
		if (file.base64encoded) {
			data = _base64ToArrayBuffer(file.data);
		} else {
			data = file.data;
		}
		const blob = new Blob([data], { type: file.mime_type });
		const url = URL.createObjectURL(blob);
		// var myWindow = window.open(url, "_blank");
		// Create link and click it so file is downloaded
		const link = document.createElement("a");
		link.href = window.URL.createObjectURL(blob);
		const fileName = path;
		link.download = fileName;
		link.click();
	});
}

main();
