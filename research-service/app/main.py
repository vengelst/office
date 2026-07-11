"""FastAPI-Applikation für den Firmenrecherche-Microservice."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import ResearchRequest, ResearchResponse
from .scraper import scrape_website
from .social import enrich_social_data
from .llm import extract_structured_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup/Shutdown-Events für die App."""
    logger.info("Research-Service gestartet")
    yield
    logger.info("Research-Service wird heruntergefahren")


app = FastAPI(
    title="Research-Microservice",
    description="Firmenrecherche via Website-Crawling und LLM-Extraktion",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def verify_api_key(x_api_key: str = Header(..., alias="x-api-key")) -> str:
    """Prüft den API-Key aus dem x-api-key Header."""
    if not settings.api_key:
        raise HTTPException(status_code=500, detail="API_KEY nicht konfiguriert")
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Ungültiger API-Key")
    return x_api_key


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health-Check-Endpoint."""
    return {"status": "ok"}


@app.post("/research/company", response_model=ResearchResponse)
async def research_company(
    request: ResearchRequest,
    _api_key: str = Depends(verify_api_key),
) -> ResearchResponse:
    """
    Recherchiert Firmendaten anhand einer Website-URL.
    Crawlt die Website, extrahiert Social-Media-Daten (optional)
    und nutzt LLM zur strukturierten Datenextraktion.
    """
    logger.info("Starte Recherche für: %s", request.url)

    try:
        scrape_result = await scrape_website(request.url)
    except Exception as e:
        logger.error("Scraping fehlgeschlagen: %s", e)
        raise HTTPException(status_code=502, detail=f"Website nicht erreichbar: {e}")

    texts = scrape_result["texts"]
    social_links = scrape_result["social_links"]
    sources = scrape_result["sources"]

    if not texts:
        logger.warning("Keine Texte von %s extrahiert", request.url)
        return ResearchResponse(sources=sources)

    social_text = ""
    if request.include_social_media and social_links:
        try:
            social_text = await enrich_social_data(social_links)
        except Exception as e:
            logger.warning("Social-Media-Enrichment fehlgeschlagen: %s", e)

    try:
        result = await extract_structured_data(texts, social_text, social_links, sources)
    except Exception as e:
        logger.error("LLM-Extraktion fehlgeschlagen: %s", e)
        raise HTTPException(status_code=502, detail=f"Datenextraktion fehlgeschlagen: {e}")

    if result.company.website is None:
        result.company.website = request.url

    logger.info(
        "Recherche abgeschlossen für %s (Konfidenz: %.0f%%)",
        request.url,
        result.confidence * 100,
    )
    return result
