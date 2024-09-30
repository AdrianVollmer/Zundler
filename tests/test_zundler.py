import time
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys


TEST_DIR = Path(__file__).resolve().parent


def test_copy_button(selenium_drivers):
    path = Path("//mnt//copy-button//_build//zundler//index.html")
    selenium = selenium_drivers["firefox"]
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


def test_mermaid(selenium_drivers):
    path = Path("//mnt//mermaid//_build//zundler//index.html")
    selenium = selenium_drivers["firefox"]
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "mermaid documentation" in selenium.title

    selenium.switch_to.frame("zundler-iframe")

    section = selenium.find_element(By.CSS_SELECTOR, "#section")
    svg = selenium.find_element(By.CSS_SELECTOR, "div.mermaid")

    # Check layout
    assert svg.size["height"] > 500
    assert section.location["y"] > 500


def test_multi_page(selenium_drivers):
    path = Path("//mnt//multi-page//_build//zundler//index.html")
    selenium = selenium_drivers["firefox"]
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "multi-page documentation" in selenium.title

    selenium.switch_to.frame("zundler-iframe")

    second_link = selenium.find_element(
        By.XPATH, "//a[text() = 'Second' and @class = 'reference internal']"
    )

    second_link.click()

    selenium.switch_to.parent_frame()
    time.sleep(1)

    assert selenium.title.startswith("Second")

    # Check link with anchor

    #  selenium.switch_to.frame("zundler-iframe")
#  
    #  third_link = selenium.find_element(By.CSS_SELECTOR, "#second a.internal")
#  
    #  third_link.click()
#  
    #  selenium.switch_to.parent_frame()
    #  time.sleep(1)
    #  selenium.switch_to.frame("zundler-iframe")
#  
    #  assert selenium.title.startswith("Third")
    #  scroll_height = int(selenium.execute_script("return window.pageYOffset"))
    #  assert scroll_height > 1000


def test_multi_page_search(selenium_drivers):
    path = Path("//mnt//multi-page//_build//zundler//index.html")
    selenium = selenium_drivers["firefox"]
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "multi-page documentation" in selenium.title

    selenium.switch_to.frame("zundler-iframe")

    # Search for "Lorem"
    searchbox = selenium.find_element(By.CSS_SELECTOR, "#searchbox input[type='text']")

    searchbox.send_keys("Lorem" + Keys.ENTER)

    selenium.switch_to.parent_frame()
    time.sleep(1)
    selenium.switch_to.frame("zundler-iframe")

    assert selenium.title.startswith("Search")

    span = selenium.find_element(By.CSS_SELECTOR, "span.highlighted")

    assert span.text == "Lorem"

    # Click on first result
    link = selenium.find_element(By.CSS_SELECTOR, "#search-results a")
    link.click()

    selenium.switch_to.parent_frame()
    time.sleep(1)
    selenium.switch_to.frame("zundler-iframe")

    header = selenium.find_element(By.CSS_SELECTOR, "#first h1")

    assert header.text.startswith("First")

    span = selenium.find_element(By.CSS_SELECTOR, "span.highlighted")

    assert span.text == "Lorem"

    # Click on "Hide Search Matches"
    hide_link = selenium.find_element(By.CSS_SELECTOR, "#searchbox a")

    hide_link.click()

    span = selenium.find_elements(By.CSS_SELECTOR, "span.highlighted")

    assert span == []


def test_dark_mode(selenium_drivers):
    path = Path("//mnt//dark-mode//_build//zundler//index.html")
    selenium = selenium_drivers["firefox"]
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "dark-mode documentation" in selenium.title


def test_pydata_theme(selenium_drivers):
    path = Path("//mnt//pydata-theme//_build//zundler//index.html")
    selenium = selenium_drivers["firefox"]
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "pydata-theme documentation" in selenium.title

    selenium.switch_to.frame("zundler-iframe")

    logo = selenium.find_element(By.CSS_SELECTOR, "img.logo__image.only-dark")

    assert logo.get_attribute("src").startswith("data:image/svg+xml;")


def test_rtd_theme(selenium_drivers):
    path = Path("//mnt//rtd-theme//_build//zundler//index.html")
    selenium = selenium_drivers["firefox"]
    selenium.get(path.as_uri())

    time.sleep(1)

    assert "rtd-theme documentation" in selenium.title

    selenium.switch_to.frame("zundler-iframe")

    searchbox = selenium.find_element(
        By.CSS_SELECTOR, "#rtd-search-form input[type='text']"
    )

    searchbox.send_keys("butterfly" + Keys.ENTER)

    selenium.switch_to.parent_frame()
    time.sleep(1)
    selenium.switch_to.frame("zundler-iframe")

    assert selenium.title.startswith("Search")

    span = selenium.find_element(By.CSS_SELECTOR, "span.highlighted")

    assert span.text == "butterfly"
