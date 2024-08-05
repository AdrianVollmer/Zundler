/*
 * Functions that will be needed by several files
 */

const _base64ToArrayBuffer = (base64) => {
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

const isVirtual = (url) => {
	// Return true if the url should be retrieved from the virtual file tree
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

const splitUrl = (url) => {
	// Return a list of three elements: path, GET parameters, anchor
	var anchor = url.split("#")[1] || "";
	var getParameters = url.split("#")[0].split("?")[1] || "";
	var path = url.split("#")[0];
	path = path.split("?")[0];
	const result = [path, getParameters, anchor];
	// console.log("Split URL", url, result);
	return result;
};

const retrieveFileFromFileTree = (path, callback) => {
	// console.log("Retrieving file: " + path);
	var fileTree = window.globalContext.fileTree;
	var file = fileTree[path];
	if (!file) {
		console.warn("File not found: " + path);
	} else {
		callback(file);
	}
};

const retrieveFileFromParent = (path, callback) => {
	// Get the file into the iframe by messaging the parent document
	// console.log("Retrieving file from parent: " + path);

	function messageHandler(event) {
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

const retrieveFile = (path, callback) => {
	if (window.globalContext.fileTree) {
		retrieveFileFromFileTree(path, callback);
	} else {
		retrieveFileFromParent(path, callback);
	}
};

const fixLink = (a) => {
	const href = a.getAttribute("href");
	if (isVirtual(href)) {
		// virtualClick will be defined in the iFrame, but fixLink may be
		// called in the parent document, so we use `onclick`, because we
		// can define the function as a string
		a.setAttribute("onclick", "virtualClick(event)");
	} else if (href.startsWith("#")) {
		a.setAttribute("href", "about:srcdoc" + a.getAttribute("href"));
	} else if (
		!href.startsWith("about:srcdoc") &&
		!href.startsWith("javascript:")
	) {
		// External links should open in a new tab. Browsers block links to
		// sites of different origin within an iframe for security reasons.
		a.setAttribute("target", "_blank");
	}
};

const fixForm = (form) => {
	var href = form.getAttribute("action");
	if (isVirtual(href) && form.getAttribute("method").toLowerCase() == "get") {
		form.setAttribute("onsubmit", "virtualClick(event)");
	}
};

const embedImg = (img) => {
	if (img.hasAttribute("src")) {
		const src = img.getAttribute("src");
		if (isVirtual(src)) {
			var path = normalizePath(src);
			retrieveFile(path, (file) => {
				const mime_type = file.mime_type;
				if (mime_type == "image/svg+xml") {
					img.setAttribute(
						"src",
						"data:image/svg+xml;charset=utf-8;base64, " + btoa(file.data),
					);
				} else {
					img.setAttribute("src", `data:${mime_type};base64, ${file.data}`);
				}
			});
		}
	}
};

const fixScriptTag = (doc, oldScript) => {
	const newScript = doc.createElement("script");
	Array.from(oldScript.attributes).forEach((attr) => {
		newScript.setAttribute(attr.name, attr.value);
	});
	try {
		if (
			newScript.hasAttribute("src") &&
			isVirtual(newScript.getAttribute("src"))
		) {
			const src = newScript.getAttribute("src");
			let [path, getParameters, anchor] = splitUrl(src);
			path = normalizePath(path);
			console.debug("Embed script: " + path);
			retrieveFile(path, (file) => {
				const src = file.data + " \n//# sourceURL=" + path;
				newScript.appendChild(doc.createTextNode(src));
				newScript.removeAttribute("src");
				oldScript.parentNode.replaceChild(newScript, oldScript);
			});
		}
	} catch (e) {
		// Make sure all scripts are loaded
		console.error("Caught error in " + oldScript.getAttribute("src"), e);
	}
};

const embedJs = (doc) => {
	Array.from(doc.querySelectorAll("script")).forEach((oldScript) => {
		fixScriptTag(doc, oldScript);
	});
};

const embedCss = (doc) => {
	Array.from(doc.querySelectorAll("link")).forEach((link) => {
		if (link.getAttribute("rel") == "stylesheet" && link.getAttribute("href")) {
			var href = link.getAttribute("href");
			let [path, getParameters, anchor] = splitUrl(href);
			path = normalizePath(path);
			retrieveFile(path, (file) => {
				const style = doc.createElement("style");
				style.textContent = file.data;
				link.replaceWith(style);
			});
		}
	});
};

const fixLinks = (doc) => {
	Array.from(doc.querySelectorAll("a")).forEach((a) => {
		fixLink(a);
	});
};

const fixForms = (doc) => {
	Array.from(doc.querySelectorAll("form")).forEach((form) => {
		fixForm(form);
	});
};

const embedImgs = (doc) => {
	Array.from(doc.querySelectorAll("img")).forEach((img) => {
		embedImg(img);
	});
};

const normalizePath = (path) => {
	// make relative paths absolute
	var result = window.globalContext.current_path;
	result = result.split("/");
	result.pop();
	// path can be a request object
	if (!(typeof path === "string" || path instanceof String)) {
		path = path.href;
	}
	result = result.concat(path.split("/"));

	// resolve relative directories
	var array = [];
	Array.from(result).forEach((component) => {
		if (component == "..") {
			if (array) {
				array.pop();
			}
		} else if (component == ".") {
		} else {
			if (component) {
				array.push(component);
			}
		}
	});

	result = array.join("/");
	// console.log(`Normalized path: ${path} -> ${result} (@${window.globalContext.current_path})`);
	return result;
};
