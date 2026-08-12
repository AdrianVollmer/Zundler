"""Unit tests for the embed module."""

from pathlib import Path

import pytest

from zundler.embed import (
    embed_assets,
    embed_css_resources,
    extract_assets,
    load_filetree,
)


@pytest.fixture
def css_tree(tmp_path):
    """Create a minimal CSS file tree with @import."""
    styles_dir = tmp_path / "styles"
    styles_dir.mkdir()

    basic_css = tmp_path / "basic.css"
    basic_css.write_bytes(b"body { margin: 0; }\n")

    theme_css = styles_dir / "theme.css"
    theme_css.write_bytes(b'@import "../basic.css";\n')

    return tmp_path


class TestEmbedCssImport:
    """Test that @import in CSS files is handled by inlining."""

    def test_import_bare_string(self, css_tree):
        """@import "../basic.css"; should be inlined."""
        theme_path = str(css_tree / "styles" / "theme.css")
        css = Path(theme_path).read_bytes()
        result = embed_css_resources(css, theme_path)

        assert b"@import" not in result
        assert b"body { margin: 0; }" in result

    def test_import_url_func(self, css_tree):
        """@import url("../basic.css"); should be inlined."""
        theme_path = str(css_tree / "styles" / "theme.css")
        css = b'@import url("../basic.css");\n'
        result = embed_css_resources(css, theme_path)

        assert b"@import" not in result
        assert b"body { margin: 0; }" in result

    def test_import_url_func_single_quotes(self, css_tree):
        """@import url('../basic.css'); should be inlined."""
        theme_path = str(css_tree / "styles" / "theme.css")
        css = b"@import url('../basic.css');\n"
        result = embed_css_resources(css, theme_path)

        assert b"@import" not in result
        assert b"body { margin: 0; }" in result

    def test_import_preserves_surrounding_css(self, css_tree):
        """Surrounding CSS rules should be preserved after inlining."""
        theme_path = str(css_tree / "styles" / "theme.css")
        css = b'/* comment */\n@import "../basic.css";\nh1 { color: red; }\n'
        result = embed_css_resources(css, theme_path)

        assert b"/* comment */" in result
        assert b"body { margin: 0; }" in result
        assert b"h1 { color: red; }" in result
        assert b"@import" not in result

    def test_import_recursive(self, css_tree):
        """Nested @import should be resolved recursively."""
        mid_css = css_tree / "styles" / "mid.css"
        mid_css.write_bytes(b'@import "../basic.css";\np { color: blue; }\n')

        top_css = css_tree / "styles" / "top.css"
        top_css.write_bytes(b'@import "mid.css";\n')

        top_path = str(top_css)
        css = Path(top_path).read_bytes()
        result = embed_css_resources(css, top_path)

        assert b"@import" not in result
        assert b"body { margin: 0; }" in result
        assert b"p { color: blue; }" in result

    def test_import_missing_file(self, css_tree):
        """Missing @import target should be skipped without crashing."""
        theme_path = str(css_tree / "styles" / "theme.css")
        css = b'@import "nonexistent.css";\nh1 { color: red; }\n'
        result = embed_css_resources(css, theme_path)

        # The broken import remains, but the rest is preserved
        assert b"h1 { color: red; }" in result

    def test_url_in_css_still_becomes_data_uri(self, css_tree):
        """Non-import url() references should still become data URIs."""
        img = css_tree / "bg.png"
        img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 20)

        theme_path = str(css_tree / "styles" / "theme.css")
        css = b'body { background: url("../bg.png"); }\n'
        result = embed_css_resources(css, theme_path)

        assert b"data:" in result
        assert b"base64" in result


class TestFileTreeWithImport:
    """Integration test: verify basic.css content ends up in theme.css in the file tree."""

    def test_basic_css_inlined_in_filetree(self, css_tree):
        tree = load_filetree(str(css_tree))

        theme_data = tree["styles/theme.css"]["data"]
        assert "body { margin: 0; }" in theme_data
        assert "@import" not in theme_data


class TestExtractAssets:
    """Round-trip: a file produced by embed_assets must be extractable."""

    def test_embed_extract_roundtrip(self, tmp_path):
        """extract_assets must recover the embedded files.

        The serialized blob is base64, which may end in '=' padding. The
        extraction regex must account for that, otherwise ~2/3 of inputs
        (those whose compressed size is not a multiple of 3) fail to extract.
        """
        src = tmp_path / "src"
        src.mkdir()
        (src / "index.html").write_text("<html><body><img src='a.png'></body></html>")
        (src / "a.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 20)

        bundle = src / "bundle.html"
        embed_assets(str(src / "index.html"), output_path=str(bundle))

        out = tmp_path / "out"
        out.mkdir()
        extract_assets(str(bundle), output_path=str(out))

        assert (out / "a.png").read_bytes() == b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
        assert (out / "index.html").exists()
        assert (out / "file_tree.json").exists()
