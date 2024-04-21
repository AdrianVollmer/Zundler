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


@pytest.fixture(scope="session")
def docker_compose_command() -> str:
    return "podman-compose"


def is_responsive(port):
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1',port))
        if result == 0:
           return True
        else:
           return False
        sock.close()
    except Exception:
        return False


@pytest.fixture(scope="session")
def selenium_service(docker_ip, docker_services):
    # `port_for` takes a container port and returns the corresponding host port
    port = docker_services.port_for("firefox", 5900)
    docker_services.wait_until_responsive(
        timeout=30.0, pause=0.1, check=lambda: is_responsive(port)
    )

    options = webdriver.FirefoxOptions()
    driver = webdriver.Remote(
        command_executor='http://localhost:4444/wd/hub',
        options=options,
    )

    yield driver

    driver.quit()


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
