"""
Embed HTML assets.

It creates an HTML file that has three script tags:

1. A virtual file tree containing all assets in zipped form
2. The pako JS library to unzip the assets
3. Some boostrap code that fixes the HTML so it loads all assets from the
virtual file tree instead of the file system

Also, two scripts are injected into all HTML files in the file tree. One as
the first child of <body>, one as the last. The first does some
monkeypatching, the last sets up all magic.

Author: Adrian Vollmer

"""

import base64
from fnmatch import fnmatch
import json
import logging
import os
from pathlib import Path
import zlib

SCRIPT_PATH = os.path.abspath(os.path.dirname(__file__))

logger = logging.getLogger(__name__)


def embed_assets(index_file):

    init_files = {}
    for filename in [
        'init.js',
        'inject.js',
        'init.css',
        'init.html',
        'monkeypatch.js',
        'pako.min.js',
    ]:
        path = os.path.join(SCRIPT_PATH, 'assets', filename)
        init_files[filename] = open(path, 'r').read()

    base_dir = os.path.dirname(index_file)
    base_name = os.path.basename(index_file)
    new_base_name = 'SELF_CONTAINED_' + base_name
    result_file = os.path.join(base_dir, new_base_name)

    file_tree = load_filetree(
        base_dir,
        before=init_files['monkeypatch.js'],
        after=init_files['inject.js'],
        exclude_pattern=new_base_name,
    )
    file_tree = json.dumps(file_tree)
    logger.debug('total asset size: %d' % len(file_tree))
    file_tree = deflate(file_tree)
    logger.debug('total asset size (compressed): %d' % len(file_tree))

    remote_resources = []

    data = {
        'current_path': base_name,
        'file_tree': file_tree,
        'remote_resources': remote_resources,
    }
    data = json.dumps(data)

    result = """
<!DOCTYPE html>
<html>
<head><style>{style}</style></head>
<body>{body}
<script>window.data = {data}</script>
<script>{pako} //# sourceURL=pako.js</script>
<script>{init_js}</script>
</body></html>
""".format(
        style=init_files['init.css'],
        init_js=init_files['init.js'],
        pako=init_files['pako.min.js'],
        body=init_files['init.html'],
        data=data,
    )

    with open(result_file, 'w') as fp:
        fp.write(result)

    return result_file


def prepare_file(filename, before, after):
    """Prepare a file for the file tree

    Referenced assets in CSS files will be embedded.
    HTML files will be injected with two scripts.

    `filename`: The name of the file
    `before`: Javascript code that will be inserted as the first child of
        `<body>` if the file is HTML.
    `after`: Javascript code that will be inserted as the last child of
        `<body>` if the file is HTML.

    """
    _, ext = os.path.splitext(filename)
    ext = ext.lower()[1:]
    data = open(filename, 'rb').read()

    if ext == 'css':
        # assuming all CSS files have names ending in '.css'
        data = embed_css_resources(data, filename)

    elif ext in [
        'png', 'jpg', 'jpeg', 'woff', 'woff2', 'eot', 'ttf', 'gif', 'ico',
    ]:
        # JSON doesn't allow binary data
        data = base64.b64encode(data)

    elif ext in ['html', 'htm']:
        data = embed_html_resources(
            data,
            os.path.dirname(filename),
            before,
            after,
        ).encode()

    if not isinstance(data, str):
        try:
            data = data.decode()
        except UnicodeError:
            data = base64.b64encode(data).decode()

    logger.debug('loaded file: %s [%d]' % (filename, len(data)))

    return data


def deflate(data):
    data = zlib.compress(data.encode())
    data = base64.b64encode(data).decode()
    return data


def embed_html_resources(html, base_dir, before, after):
    """Embed fonts in preload links to avoid jumps when loading"""
    # This cannot be done in JavaScript, it would be too late

    import bs4
    soup = bs4.BeautifulSoup(html, 'lxml')
    body = soup.find('body')

    if body and before:
        script = soup.new_tag("script")
        script.string = before
        body.insert(0, script)

    if body and after:
        script = soup.new_tag("script")
        script.string = after
        body.append(script)

    # TODO embed remote resources in case we want the entire file to be
    # usable in an offline environment

    return str(soup)


def to_data_uri(filename, mime_type=None):
    """Create a data URI from the contents of a file"""

    data = open(filename, 'br').read()
    data = base64.b64encode(data)
    if not mime_type:
        mime_type = 'application/octet-stream'
    return "data:%s;charset=utf-8;base64, %s" % (
        mime_type,
        data.decode(),
    )


def embed_css_resources(css, filename):
    """Replace url(<path>) with url(data:<mime_type>;base64, ...)"""
    # This uses some heuristics which could technically fail
    import re

    # Quotes are optional. But then URLs can contain escaped characters.
    regex = (
        rb'''(?P<url_statement>url\(['"]?(?P<url>.*?)['"]?\))'''
        rb'''(\s*format\(['"](?P<format>.*?)['"]\))?'''
    )

    replace_rules = {}

    for m in re.finditer(regex, css):
        if re.match(b'''['"]?data:.*''', m['url']):
            continue

        path = m['url'].decode()

        if '?' in path:
            path = path.split('?')[0]
        if '#' in path:
            path = path.split('#')[0]

        path = os.path.dirname(filename) + '/' + path

        content = open(path, 'rb').read()

        # If it's binary, determine mime type and encode in base64
        if m['format']:
            mime_type = 'font/' + m['format'].decode()
        elif path[-3:].lower() == 'eot':
            mime_type = 'font/eot'
        elif path[-3:].lower() == 'css':
            mime_type = 'text/css'
            content = embed_css_resources(content, filename)
        else:
            from io import BytesIO
            from sphinx.util.images import guess_mimetype_for_stream
            mime_type = guess_mimetype_for_stream(BytesIO(content))
        if not mime_type:
            logger.error('Unable to determine mime type: %s' % path)
            mime_type = 'application/octet-stream'
        content = base64.b64encode(content)

        replace_rules[m['url_statement']] = \
            b'url("data:%(mime_type)s;charset=utf-8;base64, %(content)s")' % {
                b'content': content,
                b'mime_type': mime_type.encode(),
        }

    for orig, new in replace_rules.items():
        css = css.replace(orig, new)

    return css


def load_filetree(base_dir, before=None, after=None, exclude_pattern=None):
    """Load entire directory in a dict"""

    result = {}
    base_dir = Path(base_dir)
    for path in base_dir.rglob('*'):
        if exclude_pattern and fnmatch(path.name, exclude_pattern):
            continue
        if path.is_file():
            key = path.relative_to(base_dir).as_posix()
            result[key] = prepare_file(
                path.as_posix(),
                before,
                after,
            )
            logger.debug('Packed file %s [%d]' % (key, len(result[key])))

    return result
