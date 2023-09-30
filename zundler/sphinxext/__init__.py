import os
from pathlib import Path

from sphinx import version_info as sphinx_version_info
from sphinx.builders.html import StandaloneHTMLBuilder
from sphinx.locale import get_translation
from sphinx.util import logging, progress_message
from sphinx.util.osutil import relpath


__ = get_translation(__name__, 'console')
logger = logging.getLogger(__name__)


class ZundlerBuilder(StandaloneHTMLBuilder):
    name = 'zundler'
    epilog = ""

    def __init__(self, app, env=None):
        if sphinx_version_info[0] >= 5:
            super().__init__(app, env)
        else:
            super().__init__(app)

        self.epilog = (
            'Your self-contained HTML file is now in %s.' %
            relpath(self.app.original_outdir)
        )

    def finish(self):
        super().finish()

        from zundler.embed import embed_assets

        root_doc = self.config.zundler_root_doc
        if not root_doc:
            root_doc = self.config.root_doc

        input_path = os.path.join(
            self.outdir,
            root_doc + '.html',
        )

        output_path = os.path.join(
            self.app.original_outdir,
            root_doc + '.html',
        )

        with progress_message(__('embedding HTML assets')):
            embed_assets(
                input_path,
                output_path=output_path,
                append_pre=self.config.zundler_append_pre,
                append_post=self.config.zundler_append_post,
            )


def setup(app):
    # Fix the outdir. We want to build the files into $builddir/html first,
    # then $builddir/$target second.
    outdir = os.path.join(
        os.path.dirname(app.outdir),
        'html',
    )
    doctreedir = os.path.join(
        os.path.dirname(app.outdir),
        'doctree',
    )
    app.original_outdir = app.outdir

    # Preserve types of app.outdir and app.doctreedir.
    # Sphinx changed the types from str to Path around v7.2.
    # This way it should be compatible with either way.
    app.outdir = type(app.outdir)(outdir)
    app.doctreedir = type(app.doctreedir)(doctreedir)
    Path(app.outdir).mkdir(parents=True, exist_ok=True)

    app.add_config_value(
        'zundler_root_doc',
        None,
        '',
    )

    app.add_config_value(
        'zundler_append_pre',
        '',
        '',
    )

    app.add_config_value(
        'zundler_append_post',
        '',
        '',
    )

    app.add_builder(ZundlerBuilder)

    return {
       'version': '0.1',
       'parallel_read_safe': True,
       'parallel_write_safe': True,
    }
