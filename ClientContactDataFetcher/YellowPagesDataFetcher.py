from ClientContactDataFetcher.LocalSearchDataFetcher import classify_business
from ClientContactDataFetcher.LocalSearchDataFetcher import create_playwright_page
from bs4 import BeautifulSoup
import re

def scrape_yellowpages(what, where, state):
    base_url = f"https://www.yellowpages.com.au/search/listings?clue={what}&locationClue={where}%2C+{state}&pageNumber="
    playwright, browser, context, page = create_playwright_page()

    print("Scraping YellowPages for " + what + " in " + where + ", " + state + "on page: " + base_url + "1")
    page.goto(base_url + "1")
    page.wait_for_load_state("networkidle")

    # Continuously expand "More info" panels until none remain
    while True:
        count = page.locator("a:has-text('More info'):visible").count()
        if count == 0:
            break
        print(f"Clicking expand on 1 of {count} remaining")
        link = page.locator("a:has-text('More info'):visible").first
        try:
            link.scroll_into_view_if_needed()
            link.click(force=True, timeout=2000)
        except Exception as e:
            print(f"Failed to click expand-link: {e}")
            break

    page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
    page.wait_for_timeout(5000)

    # Parse listings from the loaded page
    html = page.content()
    soup = BeautifulSoup(html, 'html.parser')

    # Iterate each listing container to correctly pair name/info with its phone
    containers = soup.findall('div', class_='Box__Div-sc-dws99b-0 dAyAhR')
    businesses = []
    
    # Clean up Playwright resources and return
    browser.close()
    playwright.stop()
    return businesses

if __name__ == "__main__":
    scrape_yellowpages("plumber", "cairns", "QLD")
