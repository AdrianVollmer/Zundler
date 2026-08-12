package_name := "zundler"

# List available recipes
default:
    @just --list

# Lint the code with ruff
lint:
    uv run ruff check src tests

# Format the code with ruff
format:
    uv run ruff format src tests

# Run the test suite
test:
    uv run pytest

# Remove build artifacts and caches
clean:
    rm -rf build __pycache__ *.egg-info docs/_build .docvenv .nox dist \
        {{package_name}}/*.egg-info {{package_name}}/__pycache__

# Build the distribution packages
build:
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
