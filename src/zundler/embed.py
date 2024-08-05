"""
Embed HTML assets.

It creates an HTML file that has these script tags:

1. A virtual file tree containing all assets in zipped form
2. Some boostrap code that fixes the HTML so it loads all assets from the
virtual file tree instead of the file system

Also, two scripts are injected into all HTML files in the file tree. One as
the first child of <head>, one as the last child of <body>. The first does some
monkeypatching, the last sets up all magic.

Author: Adrian Vollmer

"""

import base64
from fnmatch import fnmatch
import json
import logging
import mimetypes
import os
from pathlib import Path
import re
import zlib

try:
    import magic
except ImportError as e:
    logger = logging.getLogger(__name__)
    logger.error(str(e))
    logger.warning("Using `mimetypes` instead of `python-magic` for mime type guessing")
    magic = None

from zundler.args import __version__

SCRIPT_PATH = os.path.abspath(os.path.dirname(__file__))

logger = logging.getLogger(__name__)


def embed_assets(index_file, output_path=None, append_pre="", append_post=""):
    init_files = {}
    for filename in [
        "init.css",
        "init.html",
        "zundler_bootstrap.js",
        "zundler_common.js",
        "zundler_main.js",
        "inject_pre.js",
        "inject_post.js",
        "LICENSE",
    ]:
        path = os.path.join(SCRIPT_PATH, "assets", filename)
        init_files[filename] = open(path, "r").read()
        if filename == "inject_pre.js":
            init_files[filename] = append_pre + init_files[filename]
        if filename == "inject_post.js":
            init_files[filename] += append_post
        if filename.lower().endswith(".js"):
            init_files[filename] += "\n\n//# sourceURL=%s" % filename

    if not os.path.exists(index_file):
        raise FileNotFoundError("no such file: %s" % index_file)

    base_dir = os.path.dirname(index_file)
    base_name = os.path.basename(index_file)
    new_base_name = "SELF_CONTAINED_" + base_name

    if not output_path:
        output_path = os.path.join(base_dir, new_base_name)

    file_tree = load_filetree(
        base_dir,
        exclude_pattern=new_base_name,
    )

    global_context = {
        "current_path": base_name,
        "fileTree": file_tree,
        "utils": {
            "zundler_main": init_files["zundler_main.js"],
            "zundler_common": init_files["zundler_common.js"],
            "inject_pre": init_files["inject_pre.js"],
            "inject_post": init_files["inject_post.js"],
        },
    }

    global_context_serialized = json.dumps(global_context)
    logger.debug("total asset size: %d" % len(global_context_serialized))
    global_context_zipped = deflate(global_context_serialized)
    logger.debug("total asset size (compressed): %d" % len(global_context_zipped))

    result = """
<!DOCTYPE html>
<!--
This document has been prepared using Zundler {version}.
You can use zundler to inspect the files embedded below: `zundler -x <file>`
Alternatively, press CTRL-Shift-Z.
https://github.com/AdrianVollmer/Zundler
-->
<html>
<head><style>{style}</style></head>
<body>{body}
<script>const zundler_version = "{version}"</script>
<script>window.globalContext = "{global_context}"</script>
<script>{bootstrap}</script>
</body><!-- {license} --></html>
""".format(
        style=init_files["init.css"],
        body=init_files["init.html"],
        bootstrap=init_files["zundler_bootstrap.js"],
        license=init_files["LICENSE"],
        version=__version__,
        global_context=global_context_zipped,
    )

    if isinstance(output_path, str):
        with open(output_path, "w") as fp:
            fp.write(result)
    else:
        output_path.write(result)

    logger.info("Result written to: %s" % output_path)
    return output_path


def prepare_file(filename):
    """Prepare a file for the file tree

    Referenced assets in CSS files will be embedded.
    HTML files will be injected with two scripts.

    `filename`: The name of the file

    """
    _, ext = os.path.splitext(filename)
    ext = ext.lower()[1:]
    buffer = open(filename, "rb").read()
    mime_type = get_mime_type(filename, buffer)
    base64encoded = False

    if ext == "css":
        # assuming all CSS files have names ending in '.css'
        buffer = embed_css_resources(buffer, filename)

    try:
        data = buffer.decode()
    except UnicodeError:
        data = base64.b64encode(buffer).decode()
        base64encoded = True

    logger.debug("loaded file: %s [%s, %d bytes]" % (filename, mime_type, len(data)))

    result = {
        "data": data,
        "mime_type": mime_type,
        "base64encoded": base64encoded,
    }

    return result


def deflate(data: str) -> str:
    data_zipped = zlib.compress(data.encode())
    data_b64 = base64.b64encode(data_zipped).decode()
    return data_b64


def to_data_uri(filename, mime_type=None):
    """Create a data URI from the contents of a file"""

    try:
        data = open(filename, "br").read()
    except FileNotFoundError as e:
        logger.error(str(e))
    data = base64.b64encode(data)
    if not mime_type:
        mime_type = "application/octet-stream"
    return "data:%s;charset=utf-8;base64, %s" % (
        mime_type,
        data.decode(),
    )


def embed_css_resources(css, filename):
    """Replace `url(<path>)` with `url(data:<mime_type>;base64, ...)`

    Also, handle @import."""
    # This uses some heuristics which will fail in general.
    # Eventually a library like tinycss2 might be preferable.

    # First, make sure all @import's are using url(), because these are both valid:
    # @import url("foo.css");
    # @import "foo.css";
    regex = rb"""(?P<rule>@import\s*['"]?(?P<url>.*?)['"]?\s*;)"""
    replace_rules = {}
    for m in re.finditer(regex, css, flags=re.IGNORECASE):
        if not m["url"].lower().startswith(b"url("):
            replace_rules[m["rule"]] = b"@import url('%s');" % m["url"]
    for orig, new in replace_rules.items():
        css = css.replace(orig, new)

    # Quotes are optional. But then URLs can contain escaped characters.
    regex = (
        rb"""(?P<url_statement>url\(['"]?(?P<url>.*?)['"]?\))"""
        rb"""(\s*format\(['"](?P<format>.*?)['"]\))?"""
    )

    replace_rules = {}

    for m in re.finditer(regex, css, flags=re.IGNORECASE):
        if re.match(b"""['"]?data:.*""", m["url"]):
            continue

        path = m["url"].decode()

        if "?" in path:
            path = path.split("?")[0]
        if "#" in path:
            path = path.split("#")[0]

        path = os.path.dirname(filename) + "/" + path

        try:
            content = open(path, "rb").read()
        except FileNotFoundError as e:
            logger.error(str(e))
            continue

        # If it's binary, determine mime type and encode in base64
        if m["format"]:
            mime_type = "font/" + m["format"].decode()
        elif path[-3:].lower() == "eot":
            mime_type = "font/eot"
        elif path[-3:].lower() == "css":
            mime_type = "text/css"
            content = embed_css_resources(content, filename)
        else:
            mime_type = get_mime_type(filename, content)
        if not mime_type:
            logger.error("Unable to determine mime type: %s" % path)
            mime_type = "application/octet-stream"
        content = base64.b64encode(content)

        replace_rules[m["url_statement"]] = (
            b'url("data:%(mime_type)s;charset=utf-8;base64, %(content)s")'
            % {
                b"content": content,
                b"mime_type": mime_type.encode(),
            }
        )

    for orig, new in replace_rules.items():
        css = css.replace(orig, new)

    return css


def get_mime_type(filename, buffer):
    mime_type, _ = mimetypes.guess_type(filename)

    if not mime_type and magic:
        mime_type = magic.Magic(mime=True).from_buffer(buffer)

    if not mime_type:
        logger.error(
            "Unknown mime type (%s): %s" % (filename, str(buffer[:10]) + "...")
        )
        mime_type = "application/octet-stream"

    return mime_type


def load_filetree(base_dir, exclude_pattern=None):
    """Load entire directory in a dict"""

    result = {}
    base_dir = Path(base_dir)
    for path in base_dir.rglob("*"):
        if exclude_pattern and fnmatch(path.name, exclude_pattern):
            continue
        if path.is_file():
            key = path.relative_to(base_dir).as_posix()
            result[key] = prepare_file(path.as_posix())
            logger.debug("Packed file %s [%d]" % (key, len(result[key])))

    return result


def extract_assets(input_path, output_path=None):
    """Split a file generated by Zundler into its constituents

    Important for debugging"""

    if not output_path:
        output_path = "."

    html = open(input_path, "r").read()

    try:
        # Find large base64 blob
        m = re.search(
            '.*<script>.*window.*"(?P<blob>[A-Za-z0-9/+]{128,})".*</script>.*', html
        )
        if not m:
            raise RuntimeError("No blob found")
        blob = m.group("blob")
        blob = base64.b64decode(blob)
        blob = zlib.decompress(blob).decode()
        blob = json.loads(blob)
        file_tree = blob["fileTree"]
    except Exception as e:
        logger.error(str(e))
        logger.error("Does not look like a Zundler output file: %s" % input_path)
        exit(1)

    for filename, file in file_tree.items():
        filename = os.path.join(output_path, filename)
        os.makedirs(os.path.dirname(filename) or ".", exist_ok=True)
        data = file["data"]
        if file["base64encoded"]:
            data = base64.b64decode(data)
        else:
            data = data.encode()
        open(filename, "wb").write(data)
        file["data"] = file["data"][:100] + "..."

    with open(os.path.join(output_path, "file_tree.json"), "w") as fp:
        json.dump(file_tree, fp, indent=2)
