"""Playwright-basiertes Website-Crawling mit robots.txt-Beachtung."""

import asyncio
import logging
import re
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Browser, Page

from .config import settings

logger = logging.getLogger(__name__)

PRIORITY_PATTERNS = [
    r"/impressum",
    r"/kontakt",
    r"/contact",
    r"/about",
    r"/ueber-uns",
    r"/über-uns",
    r"/team",
    r"/ansprechpartner",
    r"/unternehmen",
    r"/company",
    r"/datenschutz",
]

SOCIAL_DOMAINS = {
    "instagram.com": "instagram",
    "linkedin.com": "linkedin",
    "xing.com": "xing",
    "facebook.com": "facebook",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _check_robots(base_url: str, path: str) -> bool:
    """Prüft robots.txt – gibt True zurück wenn Zugriff erlaubt oder robots.txt fehlt."""
    try:
        rp = RobotFileParser()
        rp.set_url(urljoin(base_url, "/robots.txt"))
        rp.read()
        return rp.can_fetch(USER_AGENT, urljoin(base_url, path))
    except Exception:
        return True


def _extract_text(html: str) -> str:
    """Extrahiert relevanten Text aus HTML (ohne Boilerplate)."""
    soup = BeautifulSoup(html, "lxml")

    for tag in soup(["script", "style", "nav", "header", "footer", "noscript", "svg", "iframe"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def _extract_social_links(html: str, base_url: str) -> dict[str, str]:
    """Extrahiert Social-Media-Links aus HTML."""
    soup = BeautifulSoup(html, "lxml")
    social: dict[str, str] = {}

    for a_tag in soup.find_all("a", href=True):
        href = str(a_tag["href"])
        if not href.startswith("http"):
            continue
        parsed = urlparse(href)
        hostname = parsed.hostname or ""
        for domain, key in SOCIAL_DOMAINS.items():
            if domain in hostname and key not in social:
                social[key] = href.split("?")[0]

    return social


def _collect_internal_links(html: str, base_url: str) -> list[str]:
    """Sammelt alle internen Links einer Seite."""
    soup = BeautifulSoup(html, "lxml")
    parsed_base = urlparse(base_url)
    links: set[str] = set()

    for a_tag in soup.find_all("a", href=True):
        href = str(a_tag["href"])
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        if parsed.hostname == parsed_base.hostname and parsed.scheme in ("http", "https"):
            clean = f"{parsed.scheme}://{parsed.hostname}{parsed.path}".rstrip("/")
            links.add(clean)

    return list(links)


def _prioritize_links(links: list[str]) -> list[str]:
    """Sortiert Links – priorisierte Seiten (Impressum, Kontakt, etc.) zuerst."""
    priority: list[str] = []
    rest: list[str] = []

    for link in links:
        path = urlparse(link).path.lower()
        if any(re.search(pattern, path) for pattern in PRIORITY_PATTERNS):
            priority.append(link)
        else:
            rest.append(link)

    return priority + rest


async def _fetch_page(page: Page, url: str, timeout_ms: int) -> str | None:
    """Lädt eine Seite und gibt den HTML-Inhalt zurück."""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        await page.wait_for_timeout(1000)
        return await page.content()
    except Exception as e:
        logger.warning("Fehler beim Laden von %s: %s", url, e)
        return None


async def scrape_website(url: str) -> dict:
    """
    Crawlt eine Website und sammelt Texte und Social-Media-Links.

    Returns:
        Dict mit 'texts' (dict[url, text]), 'social_links' (dict), 'sources' (list[str])
    """
    if not url.startswith("http"):
        url = f"https://{url}"

    base_url = f"{urlparse(url).scheme}://{urlparse(url).hostname}"
    timeout_ms = settings.scrape_timeout * 1000
    texts: dict[str, str] = {}
    all_social: dict[str, str] = {}
    sources: list[str] = []

    async with async_playwright() as pw:
        browser: Browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 720},
            locale="de-DE",
        )
        page = await context.new_page()

        html = await _fetch_page(page, url, timeout_ms)
        if not html:
            await browser.close()
            return {"texts": {}, "social_links": {}, "sources": []}

        main_text = _extract_text(html)
        if main_text:
            texts[url] = main_text
            sources.append(url)

        social = _extract_social_links(html, base_url)
        all_social.update(social)

        internal_links = _collect_internal_links(html, url)
        visited = {url.rstrip("/")}
        prioritized = _prioritize_links(internal_links)

        crawl_count = 0
        for link in prioritized:
            if crawl_count >= settings.max_subpages:
                break

            normalized = link.rstrip("/")
            if normalized in visited:
                continue

            path = urlparse(link).path
            if not _check_robots(base_url, path):
                logger.info("robots.txt blockiert: %s", link)
                continue

            visited.add(normalized)
            sub_html = await _fetch_page(page, link, timeout_ms)
            if sub_html:
                sub_text = _extract_text(sub_html)
                if sub_text and len(sub_text) > 50:
                    texts[link] = sub_text
                    sources.append(link)
                sub_social = _extract_social_links(sub_html, base_url)
                all_social.update(sub_social)
            crawl_count += 1

        await browser.close()

    return {"texts": texts, "social_links": all_social, "sources": sources}
