"""LLM-basierte Datenextraktion (Claude als Primär, GPT als Fallback)."""

import json
import logging

import anthropic
import openai

from .config import settings
from .models import CompanyData, ContactData, ResearchResponse, SocialMediaData

logger = logging.getLogger(__name__)

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "company": {
            "type": "object",
            "properties": {
                "companyName": {"type": ["string", "null"]},
                "legalForm": {"type": ["string", "null"]},
                "industry": {"type": ["string", "null"]},
                "phone": {"type": ["string", "null"]},
                "email": {"type": ["string", "null"]},
                "website": {"type": ["string", "null"]},
                "vatId": {"type": ["string", "null"]},
                "taxNumber": {"type": ["string", "null"]},
                "addressLine1": {"type": ["string", "null"]},
                "postalCode": {"type": ["string", "null"]},
                "city": {"type": ["string", "null"]},
                "country": {"type": ["string", "null"]},
            },
        },
        "contacts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "firstName": {"type": ["string", "null"]},
                    "lastName": {"type": ["string", "null"]},
                    "role": {"type": ["string", "null"]},
                    "department": {"type": ["string", "null"]},
                    "email": {"type": ["string", "null"]},
                    "phoneMobile": {"type": ["string", "null"]},
                    "phoneLandline": {"type": ["string", "null"]},
                    "linkedInUrl": {"type": ["string", "null"]},
                },
            },
        },
    },
}

SYSTEM_PROMPT = (
    "Du bist ein Datenextraktions-Assistent für ein CRM-System. "
    "Extrahiere aus den folgenden Webseitentexten strukturierte Firmendaten und Ansprechpartner. "
    "Antworte ausschließlich als JSON im vorgegebenen Schema. "
    "Wenn du eine Information nicht findest, setze den Wert auf null. "
    "Erfinde keine Daten."
)


def _build_user_prompt(texts: dict[str, str], social_text: str) -> str:
    """Erstellt den User-Prompt aus den gecrawlten Texten."""
    parts = ["Extrahiere die Firmendaten und Ansprechpartner aus folgenden Webseitentexten.\n"]
    parts.append(f"Antwort-Schema:\n```json\n{json.dumps(RESPONSE_SCHEMA, indent=2)}\n```\n")

    for url, text in texts.items():
        truncated = text[:4000] if len(text) > 4000 else text
        parts.append(f"--- Seite: {url} ---\n{truncated}\n")

    if social_text:
        parts.append(f"--- Social-Media-Informationen ---\n{social_text}\n")

    parts.append("Antworte NUR mit dem JSON-Objekt, ohne Erklärungen oder Markdown-Codeblöcke.")
    return "\n".join(parts)


def _parse_llm_response(content: str) -> dict:
    """Parst die LLM-Antwort als JSON."""
    content = content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        content = "\n".join(lines)
    return json.loads(content)


def _calculate_confidence(data: dict, has_impressum: bool) -> float:
    """Berechnet den Konfidenz-Score basierend auf der Anzahl gefüllter Felder."""
    company = data.get("company", {})
    contacts = data.get("contacts", [])

    company_fields = [
        "companyName", "legalForm", "industry", "phone", "email",
        "website", "vatId", "taxNumber", "addressLine1", "postalCode",
        "city", "country",
    ]
    filled = sum(1 for f in company_fields if company.get(f))
    total = len(company_fields)

    if contacts:
        contact_fields = ["firstName", "lastName", "role", "email", "phoneMobile", "phoneLandline"]
        for c in contacts:
            filled += sum(1 for f in contact_fields if c.get(f))
            total += len(contact_fields)

    score = filled / total if total > 0 else 0.0
    if has_impressum:
        score = min(1.0, score + 0.1)

    return round(score, 2)


async def extract_with_claude(texts: dict[str, str], social_text: str) -> dict:
    """Extrahiert Daten via Anthropic Claude."""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_prompt = _build_user_prompt(texts, social_text)

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
        timeout=settings.llm_timeout,
    )

    content = response.content[0].text
    return _parse_llm_response(content)


async def extract_with_openai(texts: dict[str, str], social_text: str) -> dict:
    """Fallback-Extraktion via OpenAI GPT."""
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    user_prompt = _build_user_prompt(texts, social_text)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=4096,
        timeout=settings.llm_timeout,
    )

    content = response.choices[0].message.content or "{}"
    return _parse_llm_response(content)


async def extract_structured_data(
    texts: dict[str, str],
    social_text: str,
    social_links: dict[str, str],
    sources: list[str],
) -> ResearchResponse:
    """
    Extrahiert strukturierte Firmendaten via LLM.
    Nutzt Claude als primären Anbieter, OpenAI GPT als Fallback.
    """
    if not texts:
        return ResearchResponse()

    has_impressum = any(
        "impressum" in url.lower() for url in texts
    )

    data: dict = {}
    try:
        if settings.anthropic_api_key:
            data = await extract_with_claude(texts, social_text)
        elif settings.openai_api_key:
            data = await extract_with_openai(texts, social_text)
        else:
            logger.error("Kein API-Key konfiguriert (ANTHROPIC_API_KEY oder OPENAI_API_KEY)")
            return ResearchResponse(sources=sources)
    except Exception as e:
        logger.warning("Primärer LLM-Aufruf fehlgeschlagen: %s", e)
        if settings.openai_api_key and settings.anthropic_api_key:
            try:
                data = await extract_with_openai(texts, social_text)
                logger.info("Fallback auf OpenAI GPT erfolgreich")
            except Exception as fallback_err:
                logger.error("Auch OpenAI-Fallback fehlgeschlagen: %s", fallback_err)
                return ResearchResponse(sources=sources)
        else:
            return ResearchResponse(sources=sources)

    company_data = data.get("company", {})
    contacts_data = data.get("contacts", [])

    company = CompanyData(**{k: v for k, v in company_data.items() if k in CompanyData.model_fields})
    contacts = [
        ContactData(**{k: v for k, v in c.items() if k in ContactData.model_fields})
        for c in contacts_data
        if isinstance(c, dict) and (c.get("firstName") or c.get("lastName"))
    ]

    social_media = SocialMediaData(**social_links)
    confidence = _calculate_confidence(data, has_impressum)

    return ResearchResponse(
        company=company,
        contacts=contacts,
        socialMedia=social_media,
        sources=sources,
        confidence=confidence,
    )
