"""
Embed HTML assets.

It creates an HTML file that has three script tags:

1. A virtual file tree containing all assets in zipped form
2. The pako JS library to unzip the assets
3. Some boostrap code that fixes the HTML so it loads all assets from the
virtual file tree instead of the file system

TODO:
* JS dependencies like mathjax don't work
* CSS delay noticable when using fonts
* CSS files can import other files with `@import`

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
    base_dir = os.path.dirname(index_file)
    base_name = os.path.basename(index_file)
    new_base_name = 'SELF_CONTAINED_' + base_name
    result_file = os.path.join(base_dir, new_base_name)
    file_tree = load_filetree(base_dir, exclude_pattern=new_base_name)

    file_tree = json.dumps(file_tree)
    logger.debug('total asset size: %d' % len(file_tree))
    file_tree = deflate(file_tree)
    logger.debug('total asset size (compressed): %d' % len(file_tree))

    remote_resources = []

    data = {
        'start_page': base_name,
        'file_tree': file_tree,
        'remote_resources': remote_resources,
    }

    init_script = os.path.join(SCRIPT_PATH, 'init.js')
    init_script = open(init_script, 'r').read()

    init_css = os.path.join(SCRIPT_PATH, 'init.css')
    init_css = open(init_css, 'r').read()

    pako = os.path.join(SCRIPT_PATH, 'pako.min.js')
    pako = open(pako, 'r').read()

    data = json.dumps(data)

    body = os.path.join(SCRIPT_PATH, 'init.html')
    body = open(body, 'r').read()

    result = """
<!DOCTYPE html>
<html lang="{lang}">
<head>{head}<style>{style}</style></head>
<body>{body}
<script>window.data = {data}</script>
<script>{pako} //# sourceURL=pako.js</script>
<script>{init_script} //# sourceURL=init.js</script>
</body></html>
""".format(
        lang='en',
        head='',
        style=init_css,
        data=data,
        pako=pako,
        body=body,
        init_script=init_script,
    )

    with open(result_file, 'w') as fp:
        fp.write(result)

    return result_file


def pack_file(filename):
    _, ext = os.path.splitext(filename)
    ext = ext.lower()[1:]
    data = open(filename, 'rb').read()
    if ext == 'css':
        # assuming all CSS files have names ending in '.css'
        data = embed_css_resources(data, filename)

    if ext in [
        'png', 'jpg', 'jpeg', 'woff', 'woff2', 'eot', 'ttf', 'gif', 'ico',
    ]:
        # JSON doesn't allow binary data
        data = base64.b64encode(data)
    try:
        data = data.decode()
    except UnicodeError:
        data = base64.b64encode(data).decode()
    print(len(data), filename)
    return data


def deflate(data):
    data = zlib.compress(data.encode())
    data = base64.b64encode(data).decode()
    return data


def embed_css_resources(css, rel_dir):
    """Replace url(<path>) with url(data:<mime_type>;base64, ...)"""
    # TODO handle @import
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

        path = os.path.dirname(rel_dir) + '/' + path

        content = open(path, 'rb').read()

        # If it's binary, determine mime type and encode in base64
        if m['format']:
            mime_type = 'font/' + m['format'].decode()
        elif path[-3:].lower() == 'eot':
            mime_type = 'font/eot'
        elif path[-3:].lower() == 'css':
            mime_type = 'text/css'
            content = embed_css_resources(content, rel_dir)
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


def load_filetree(base_dir, exclude_pattern=None):
    """Load entire directory in a dict"""

    result = {}
    base_dir = Path(base_dir)
    for path in base_dir.rglob('*'):
        if exclude_pattern and fnmatch(path.name, exclude_pattern):
            continue
        if path.is_file():
            key = '/' + path.relative_to(base_dir).as_posix()
            result[key] = pack_file(
                path.as_posix()
            )
            logger.debug('Packed file %s [%d]' % (key, len(result[key])))

    return result

