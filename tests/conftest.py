import pytest
import subprocess
from selenium import webdriver
from pathlib import Path


@pytest.fixture(scope="session")
def firefox_driver():
    _driver = webdriver.Firefox()
    yield _driver
    _driver.quit()


@pytest.fixture(scope="session")
def chrome_driver():
    _driver = webdriver.Chrome()
    yield _driver
    _driver.quit()


@pytest.fixture(autouse=True)
def run_make_commands(request):
    # Get the directory of the current test file
    test_dir = request.fspath.dirname
    cmd = """
    uv venv && \\
    . .venv/bin/activate && \\
    uv pip install -r requirements.txt && \\
    rm -rf _build && \\
    .venv/bin/sphinx-build -M zundler . _build
"""

    for d in ["copy-button", "mermaid", "multi-page"]:
        subprocess.run(cmd.strip(), shell=True, check=True, cwd=Path(test_dir) / d)
