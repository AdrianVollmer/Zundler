/*
 * Unit tests for the pure/DOM-lite helpers in zundler_common.js.
 *
 * These run under Node's built-in test runner (no extra dependencies).
 * zundler_common.js exposes its functions via a Node-only export guard.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { isVirtual, fixLink, fixForm } = require(
	path.join(__dirname, "..", "..", "src", "zundler", "assets", "zundler_common.js"),
);

// Minimal stand-in for a DOM element: just the attribute accessors used by
// fixLink/fixForm.
const makeElement = (attrs) => {
	const store = { ...attrs };
	return {
		getAttribute: (name) => (name in store ? store[name] : null),
		setAttribute: (name, value) => {
			store[name] = value;
		},
		_attrs: store,
	};
};

test("isVirtual returns false for null (anchor without href)", () => {
	assert.equal(isVirtual(null), false);
});

test("isVirtual returns false for empty string", () => {
	assert.equal(isVirtual(""), false);
});

test("isVirtual classifies relative paths as virtual", () => {
	assert.equal(isVirtual("foo/bar.html"), true);
});

test("isVirtual classifies external urls as non-virtual", () => {
	assert.equal(isVirtual("https://example.com"), false);
});

test("fixLink does not throw on an anchor without href", () => {
	// e.g. Sphinx named-target anchors: <a name="section"></a>
	const a = makeElement({ name: "section" });
	assert.doesNotThrow(() => fixLink(a));
	// A hrefless anchor is not a navigable link, so nothing should be rewritten.
	assert.equal(a.getAttribute("onclick"), null);
	assert.equal(a.getAttribute("target"), null);
});

test("fixForm does not throw on a form without an action", () => {
	const form = makeElement({ method: "get" });
	assert.doesNotThrow(() => fixForm(form));
	assert.equal(form.getAttribute("onsubmit"), null);
});
