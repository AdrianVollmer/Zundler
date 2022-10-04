import argparse

try:
    # importlib.metadata is present in Python 3.8 and later
    import importlib.metadata as importlib_metadata
except ImportError:
    # use the shim package importlib-metadata pre-3.8
    import importlib_metadata as importlib_metadata

try:
    __version__ = importlib_metadata.version(__package__ or __name__)
    #  __summary__ = importlib_metadata.metadata(__package__ or __name__)['summary']
    __summary__ = "Convert distributed HTML docs to completely self-contained HTML docs"
except importlib_metadata.PackageNotFoundError:
    __version__ = "??"
    __summary__ = "??"


parser = argparse.ArgumentParser(
    description=__summary__,
)

parser.add_argument(
    '-v', '--version', action='version',
    version=__version__,
)

parser.add_argument(
    'input_path',
    help='input path to the root HTML file',
)

parser.add_argument(
    '-o', '--output-path',
    help='output path to resulting HTML file',
)


def parse_args(argv=None):
    args = parser.parse_args(argv)

    return args
