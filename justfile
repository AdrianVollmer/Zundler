package_name := "zundler"

# List available recipes
default:
    @just --list

# Lint Python (ruff) and the TypeScript assets (deno)
lint:
    uv run ruff check src tests
    uv run deno lint
    uv run deno check src/zundler/assets_ts/*.ts

# Format Python (ruff) and the TypeScript assets (deno)
format:
    uv run ruff format src tests
    uv run deno fmt

# Run the Python test suite
test:
    uv run pytest

# Run the JavaScript unit tests (Node's built-in test runner)
test-js:
    node --test tests/js/*.test.js

# Remove build artifacts and caches
clean:
    rm -rf build __pycache__ *.egg-info docs/_build .docvenv .nox dist \
        {{package_name}}/*.egg-info {{package_name}}/__pycache__

# Transpile the TypeScript assets to plain JS
build-assets:
    uv run deno task build

# Transpile the TypeScript assets, then build the distribution packages
build: build-assets
    uv run hatch build

# Upload the latest sdist to TestPyPI
test-publish:
    #!/usr/bin/env bash
    set -euo pipefail
    file=$(ls -1t dist/{{package_name}}-*.tar.gz | head -n1)
    read -p "[TEST] Ready to upload $file? Type yes: " ans
    [ "$ans" = "yes" ] && twine upload -r testpypi "$file"

# Upload the latest sdist to PyPI
publish:
    #!/usr/bin/env bash
    set -euo pipefail
    file=$(ls -1t dist/{{package_name}}-*.tar.gz | head -n1)
    read -p "Ready to upload $file? Type yes: " ans
    [ "$ans" = "yes" ] && uv publish "$file"
