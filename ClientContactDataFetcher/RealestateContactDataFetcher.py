import time
import requests
import csv
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

h = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive"
}

def write_agent_info_list_to_csv(agent_info_list, area_name):
    file_name = f"{area_name}_realestate_data.csv"
    with open(file_name, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        # Write header
        writer.writerow(["Phone Number", "Agent Name", "Agency Description"])
        # Write each agent's info
        for agent_info in agent_info_list:
            writer.writerow(agent_info)

def get_soup_page(url, headers=h, parser="html.parser"):
    time.sleep(1)
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive"
        }
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()  # This will raise an HTTPError for bad status codes

        try:
            soup = BeautifulSoup(res.content, parser)
            return soup
        except Exception as e:
            print(f"Error parsing HTML with BeautifulSoup: {e}")
            return None

    except requests.exceptions.HTTPError as e:
        print(f"HTTP error {res.status_code}: {e}")
    except requests.exceptions.ConnectionError:
        print("Connection error: Failed to connect to the server.")
    except requests.exceptions.Timeout:
        print("Timeout error: The request took too long.")
    except requests.exceptions.RequestException as e:
        print(f"General Request error: {e}")
    return None

def create_playwright_page():
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=True)  # set headless=False to watch it run
    context = browser.new_context()
    page = context.new_page()
    return playwright, browser, context, page

def get_phone_number(agent_url: str, page) -> str:
    try:
        page.goto(agent_url, timeout=10000)
        page.wait_for_selector('[data-testid="cta-call-button"]', timeout=5000)
        page.click('[data-testid="cta-call-button"]')
        page.wait_for_selector('a[href^="tel:"]', timeout=5000)
        phone_element = page.query_selector('a[href^="tel:"]')
        return phone_element.get_attribute("href") if phone_element else ""
    except Exception as e:
        print(f"Error getting phone number from {agent_url}: {e}")
        return ""

def process_agent_info_to_tuple(agent_url, page):
    soup = get_soup_page(agent_url)
    if not soup:
        print("found nothing on agent page")
        return ("", "")  # Skip or return empty

    phone_number = get_phone_number(agent_url, page)
    if not phone_number:
        print("could not find number")
        phone_number = ""

    name = soup.find('h1', attrs={'data-testid': 'trade-profile-hero-banner_name'}, recursive=True)
    name = name.get_text(strip=True) if name else ""
    print(phone_number + name)
    return (phone_number, name)

def process_agency_for_list_agent_info(agency_url, page):
    soup = get_soup_page(agency_url)
    if not soup:
        print("found nothing on agency page")
        return []

    article = soup.find("article", attrs={'data-testid': 'profile-description'}, recursive=True)
    agency_description_list = [p.get_text(strip=True) for p in article.find_all('p')] if article else []
    agency_description_str = '.'.join(agency_description_list)

    agent_to_process_list = soup.find_all("div", attrs={"data-testid": "profile-card"}, recursive=True)
    agent_found_info_list = []
    for agent in agent_to_process_list:
        agent_url = urljoin("https://www.domain.com.au", agent.find("a").get("href"))
        print("Going to: " + agent_url)
        agent_info_tuple = process_agent_info_to_tuple(agent_url, page)
        agent_found_info_list.append((agent_info_tuple[0], agent_info_tuple[1], agency_description_str))
    return agent_found_info_list

def get_all_agent_info_by_area(area):
    base_url = 'https://www.domain.com.au/real-estate-agencies/'
    page_number_url = '/?page='
    page_num = 1

    playwright, browser, context, page = create_playwright_page()
    print("Base url: " + base_url + area)

    agent_data_store = []

    try:
        while True:
            print("On page: " + str(page_num))
            full_url = base_url + area + page_number_url + str(page_num)
            agency_list_soup = get_soup_page(full_url)

            if not agency_list_soup:
                print("Failed to fetch page: " + full_url)
                break

            agency_list = agency_list_soup.find_all("div", attrs={"data-testid": "profile-card"}, recursive=True)
            if len(agency_list) == 0:
                break

            for agency in agency_list:
                agency_url = urljoin("https://www.domain.com.au", agency.find("a").get("href"))
                print("Going to agency url to scan for agents: " + agency_url)
                agent_info_list = process_agency_for_list_agent_info(agency_url, page)
                agent_data_store.extend(agent_info_list)

            page_num += 1

    finally:
        browser.close()
        playwright.stop()

    write_agent_info_list_to_csv(agent_data_store, area)

if __name__ == '__main__':
    get_all_agent_info_by_area('cairns-qld-4870')
