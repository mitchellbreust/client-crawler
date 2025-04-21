from playwright.sync_api import sync_playwright
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from bs4 import BeautifulSoup
import csv
import sys
import argparse
import json
import os
import requests
import time

def extract_page_num(url):
    parsed_url = urlparse(url)
    query_params = parse_qs(parsed_url.query)
    page_list = query_params.get("page", [])
    return int(page_list[0]) if page_list else None

# Function to extract data from JSON-LD scripts
def extract_json_ld_biz_data(soup):
    scripts = soup.find_all("script", {"type": "application/ld+json"})
    businesses = []

    for script in scripts:
        try:
            data = json.loads(script.string)

            # Some pages might include unrelated structured data
            if isinstance(data, dict) and data.get("@type") == "LocalBusiness":
                name = data.get("name", "N/A")
                phone = data.get("telephone", "N/A")
                url = data.get("url", "N/A")

                address = data.get("address", {})
                street = address.get("streetAddress", "")
                suburb = address.get("addressLocality", "")
                state = address.get("addressRegion", "")
                postcode = address.get("postalCode", "")

                businesses.append({
                    "name": name,
                    "phone": phone,
                    "url": url,
                    "street": street,
                    "suburb": suburb,
                    "state": state,
                    "postcode": postcode,
                })

        except json.JSONDecodeError:
            continue

    return businesses

# Function to create Playwright page
def create_playwright_page():
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(
        headless=True,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-infobars",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ]
    )
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        viewport={'width': 1280, 'height': 800},
        locale="en-AU",
        timezone_id="Australia/Brisbane",
        geolocation={"longitude": 153.02, "latitude": -27.47},  # Brisbane area
        permissions=["geolocation"],
        java_script_enabled=True,
        bypass_csp=True
    )

    page = context.new_page()
    page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'languages', { get: () => ['en-AU', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    """)

    return playwright, browser, context, page

def get_soup_page_with_numbers(page, url, attempt=1, max_attempts=2):
    original_page_num = extract_page_num(url)

    page.goto(url)
    page.wait_for_load_state("networkidle")

    final_url = page.url
    final_page_num = extract_page_num(final_url)
    print("final url: " + final_url)
    
    if ((original_page_num is not None and final_page_num is None) or (final_page_num != original_page_num)) and original_page_num != 1:
        if attempt < max_attempts:
            # Parse the redirected URL and its query params
            parsed = urlparse(final_url)
            query_params = parse_qs(parsed.query)
            query_params["page"] = [str(original_page_num)]

            # Rebuild the query string
            new_query = urlencode(query_params, doseq=True)

            # Build retry URL with the updated query
            retry_url = urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                parsed.fragment
            ))

            print(f"🔁 Retrying with updated URL: {retry_url}")
            return get_soup_page_with_numbers(page, retry_url, attempt=attempt + 1)
        else:
            print("❌ Redirected again and no page number found. Assuming end of pages.")
            return None

    try:
        page.wait_for_selector('[data-profileid]', timeout=10000)
    except:
        print("⚠️ Warning: Couldn't find '[data-profileid]'")
        return None

    # Scroll to bottom to load lazy content
    page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
    page.wait_for_timeout(5000)

    return BeautifulSoup(page.content(), 'html.parser')

# Helper function to classify a business via DeepSeek
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
def classify_business(business_info):
    headers = {
        'Authorization': f'Bearer {DEEPSEEK_API_KEY}',
        'Content-Type': 'application/json'
    }
    # Prompt user for only category name
    system_msg = (
        "Please output only the category for the business. Only output the category name, nothing else. Nothing else at all. Just the category name. Before you decide on the category, think critically about the name, for example: the business name 'Alphacool Port Douglas' is actually HVAC & Appliance Services not Travel & Tourism. If very unsure, output 'Uncategorized'."
        "Categories to use: Real Estate Services, Cleaning Services, Trades & Maintenance, Building & Renovation, Landscaping & Outdoor Services, "
        "HVAC & Appliance Services, Automotive Services, IT & Web Services, Health Wellness & Beauty, Pet Services, Moving & Transport Services, "
        "Professional Services, Legal Services, Retail & E-commerce, Travel & Tourism."
    )
    payload = {
        'model': 'deepseek-chat',
        'messages': [
            {'role': 'system', 'content': system_msg},
            {'role': 'user', 'content': f'Business info: {business_info}'}
        ],
        'temperature': 0.1
    }
    time.sleep(0.2)
    resp = requests.post('https://api.deepseek.com/v1/chat/completions', headers=headers, json=payload)
    data = resp.json()
    print(data)
    return data['choices'][0]['message']['content'].strip()

def search_businesses(what, where, state, callback=None):
    """
    Search for businesses and return the results.
    
    Args:
        what: Type of business to search (e.g., 'plumber')
        where: Location to search in (e.g., 'bungalow')
        state: State abbreviation (e.g., 'qld')
        callback: Optional callback function to report progress
                  callback(progress_pct, status_message, businesses_found_so_far)
    
    Returns:
        A list of dictionaries containing business information
    """
    base_url = f'https://www.localsearch.com.au/find/{what}/{where}-{state}'
    print("Starting URL: " + base_url)
    
    playwright, browser, context, page = create_playwright_page()
    all_businesses = []
    
    try:
        page_num = 1
        
        while True:
            # Create URL with page number
            url = f'{base_url}?page={page_num}'
            
            status_message = f"Scraping page {page_num}: {url}"
            print(status_message)
            
            if callback:
                # Calculate approximate progress (assuming ~5 pages total as estimate)
                progress = min(95, int((page_num / 5) * 95))
                callback(progress, status_message, all_businesses)
            
            page_soup = get_soup_page_with_numbers(page, url)
            if not page_soup:
                print(f"Could not get data from page {page_num}")
                break
                
            # Use the function to extract JSON-LD business data
            businesses = extract_json_ld_biz_data(page_soup)
            print(f"Found {len(businesses)} businesses on page {page_num}")
            
            if len(businesses) == 0:
                break
                
            all_businesses.extend(businesses)
            page_num += 1
            
        # Sort businesses by phone number for consistency
        all_businesses = sorted(all_businesses, key=lambda x: x["phone"])
        # Classify each business to enrich with a category
        for biz in all_businesses:
            info = ",".join([biz.get(k, '') for k in ['name','phone','url','street','suburb','state','postcode']])
            try:
                biz['category'] = classify_business(info)
            except Exception:
                biz['category'] = 'Uncategorized'
        
        if callback:
            callback(100, f"Completed search for {what} in {where}, {state}. Found {len(all_businesses)} businesses.", all_businesses)
            
        return all_businesses
        
    finally:
        browser.close()
        playwright.stop()

def save_to_csv(businesses, what, where):
    """Save business data to CSV file"""
    # Ensure directories exist
    data_dir = "../ClientContactData"
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        
    file_name = f"{data_dir}/{where}_{what}_data.csv"
    
    with open(file_name, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["name", "phone", "url", "street", "suburb", "state", "postcode"])
        writer.writeheader()
        writer.writerows(businesses)
        
    print(f"Saved {len(businesses)} businesses to {file_name}")
    return file_name

def main(what, where, state, save_results=True, callback=None):
    """
    Main function to search for businesses and optionally save to CSV.
    
    Args:
        what: Type of business to search (e.g., 'plumber')
        where: Location to search in (e.g., 'bungalow')
        state: State abbreviation (e.g., 'qld')
        save_results: Whether to save results to CSV (default: True)
        callback: Optional callback function to report progress
    
    Returns:
        tuple: (list of business dictionaries, csv_path if saved or None)
    """
    # Run the search
    businesses = search_businesses(what, where, state, callback)
    
    return businesses

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape business listings from LocalSearch.")
    parser.add_argument("what", type=str, help="The type of business (e.g., 'plumber')")
    parser.add_argument("where", type=str, help="The location to search in (e.g., 'bungalow')")
    parser.add_argument("state", type=str, help="The state to search in (e.g., 'qld')")
    parser.add_argument("--no-save", action="store_true", help="Don't save to CSV, just print results")
    
    args = parser.parse_args()

    # Use the main function
    businesses, csv_path = main(args.what, args.where, args.state, not args.no_save)
    
    # Print output if --no-save flag is used
    if args.no_save:
        print(f"Found {len(businesses)} businesses:")
        for business in businesses:
            print(f"{business['name']} - {business['phone']}")

