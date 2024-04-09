import time
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys


TEST_DIR = Path(__file__).resolve().parent


def test_copy_button(selenium):
    path = TEST_DIR / "copy-button//_build//zundler//index.html"
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "copy-button documentation" in selenium.title

    selenium.switch_to.frame("zundler-iframe")

    button = selenium.find_element(By.CSS_SELECTOR, "button.copybtn")

    assert button.get_attribute("data-tooltip") == "Copy"
    assert "success" not in button.get_attribute("class")

    button.click()

    assert button.get_attribute("data-tooltip") == "Copied!"
    assert "success" in button.get_attribute("class")

    # Check layout
    assert button.location["y"] < 55
    assert button.location["y"] > 45


def test_mermaid(selenium):
    path = TEST_DIR / "mermaid//_build//zundler//index.html"
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "mermaid documentation" in selenium.title

    selenium.switch_to.frame("zundler-iframe")

    section = selenium.find_element(By.CSS_SELECTOR, "#section")
    svg = selenium.find_element(By.CSS_SELECTOR, "div.mermaid")

    # Check layout
    assert svg.size["height"] > 500
    assert section.location["y"] > 500


def test_multi_page(selenium):
    path = TEST_DIR / "multi-page//_build//zundler//index.html"
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "multi-page documentation" in selenium.title

    selenium.switch_to.frame("zundler-iframe")

    second_link = selenium.find_element(
        By.XPATH, "//a[text() = 'Second' and @class = 'reference internal']"
    )

    second_link.click()

    time.sleep(1)

    assert selenium.title.startswith("Second")


def test_multi_page_search(selenium):
    path = TEST_DIR / "multi-page//_build//zundler//index.html"
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "multi-page documentation" in selenium.title

    selenium.switch_to.frame("zundler-iframe")

    searchbox = selenium.find_element(By.CSS_SELECTOR, "#searchbox input[type='text']")

    searchbox.send_keys("Lorem" + Keys.ENTER)
    selenium.switch_to.parent_frame()
    time.sleep(2)
    selenium.switch_to.frame("zundler-iframe")

    assert selenium.title.startswith("Search")

    span = selenium.find_element(By.CSS_SELECTOR, "span.highlighted")

    assert span.text == "Lorem"
