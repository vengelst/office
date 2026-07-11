"""Pydantic-Modelle für Request und Response."""

from pydantic import BaseModel, Field


class ResearchRequest(BaseModel):
    """Anfrage zur Firmenrecherche."""

    url: str = Field(..., min_length=5, description="Website-URL der Firma")
    include_social_media: bool = Field(True, description="Social-Media-Profile einbeziehen")
    language: str = Field("de", description="Sprache der Extraktion")


class CompanyData(BaseModel):
    """Extrahierte Firmendaten."""

    companyName: str | None = None
    legalForm: str | None = None
    industry: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    vatId: str | None = None
    taxNumber: str | None = None
    addressLine1: str | None = None
    postalCode: str | None = None
    city: str | None = None
    country: str | None = None


class ContactData(BaseModel):
    """Extrahierter Ansprechpartner."""

    firstName: str | None = None
    lastName: str | None = None
    role: str | None = None
    department: str | None = None
    email: str | None = None
    phoneMobile: str | None = None
    phoneLandline: str | None = None
    linkedInUrl: str | None = None


class SocialMediaData(BaseModel):
    """Social-Media-Profile."""

    instagram: str | None = None
    linkedin: str | None = None
    facebook: str | None = None
    xing: str | None = None


class ResearchResponse(BaseModel):
    """Vollständiges Recherche-Ergebnis."""

    company: CompanyData = Field(default_factory=CompanyData)
    contacts: list[ContactData] = Field(default_factory=list)
    socialMedia: SocialMediaData = Field(default_factory=SocialMediaData)
    sources: list[str] = Field(default_factory=list)
    confidence: float = 0.0
