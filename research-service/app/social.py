"""Social-Media-Scraping (Instagram, LinkedIn) – öffentliche Profile."""

import logging

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from .config import settings

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


async def scrape_instagram(url: str) -> dict[str, str | None]:
    """Extrahiert Bio, Website und Kategorie von einem öffentlichen Instagram-Profil."""
    result: dict[str, str | None] = {"bio": None, "website": None, "category": None}
    timeout_ms = settings.social_timeout * 1000

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1280, "height": 720},
                locale="de-DE",
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            await page.wait_for_timeout(2000)

            html = await page.content()
            soup = BeautifulSoup(html, "lxml")

            meta_desc = soup.find("meta", {"property": "og:description"})
            if meta_desc and meta_desc.get("content"):
                result["bio"] = str(meta_desc["content"])

            meta_title = soup.find("meta", {"property": "og:title"})
            if meta_title and meta_title.get("content"):
                title = str(meta_title["content"])
                if " | " in title:
                    result["category"] = title.split(" | ")[-1].strip()

            for a_tag in soup.find_all("a", href=True):
                href = str(a_tag["href"])
                if "l.instagram.com" in href or (
                    href.startswith("http")
                    and "instagram.com" not in href
                    and "facebook.com" not in href
                ):
                    result["website"] = href
                    break

            await browser.close()
    except Exception as e:
        logger.warning("Instagram-Scraping fehlgeschlagen für %s: %s", url, e)

    return result


async def scrape_linkedin_company(url: str) -> dict[str, str | None]:
    """Extrahiert Beschreibung und Branche von einer öffentlichen LinkedIn-Firmenseite."""
    result: dict[str, str | None] = {"description": None, "industry": None, "employees": None}
    timeout_ms = settings.social_timeout * 1000

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1280, "height": 720},
                locale="de-DE",
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            await page.wait_for_timeout(2000)

            html = await page.content()
            soup = BeautifulSoup(html, "lxml")

            meta_desc = soup.find("meta", {"property": "og:description"})
            if meta_desc and meta_desc.get("content"):
                result["description"] = str(meta_desc["content"])

            for dt in soup.find_all("dt"):
                text = dt.get_text(strip=True).lower()
                dd = dt.find_next_sibling("dd")
                if dd:
                    val = dd.get_text(strip=True)
                    if "branche" in text or "industry" in text:
                        result["industry"] = val
                    elif "mitarbeiter" in text or "employees" in text:
                        result["employees"] = val

            await browser.close()
    except Exception as e:
        logger.warning("LinkedIn-Scraping fehlgeschlagen für %s: %s", url, e)

    return result


async def enrich_social_data(social_links: dict[str, str]) -> str:
    """
    Sammelt zusätzliche Informationen von Social-Media-Profilen.
    Gibt einen zusammengefassten Text zurück, der an den LLM-Kontext angehängt wird.
    """
    parts: list[str] = []

    if "instagram" in social_links:
        ig_data = await scrape_instagram(social_links["instagram"])
        if any(ig_data.values()):
            parts.append(f"Instagram-Profil ({social_links['instagram']}):")
            if ig_data["bio"]:
                parts.append(f"  Bio: {ig_data['bio']}")
            if ig_data["category"]:
                parts.append(f"  Kategorie: {ig_data['category']}")
            if ig_data["website"]:
                parts.append(f"  Website: {ig_data['website']}")

    if "linkedin" in social_links:
        li_data = await scrape_linkedin_company(social_links["linkedin"])
        if any(li_data.values()):
            parts.append(f"LinkedIn-Firmenseite ({social_links['linkedin']}):")
            if li_data["description"]:
                parts.append(f"  Beschreibung: {li_data['description']}")
            if li_data["industry"]:
                parts.append(f"  Branche: {li_data['industry']}")
            if li_data["employees"]:
                parts.append(f"  Mitarbeiter: {li_data['employees']}")

    return "\n".join(parts)
