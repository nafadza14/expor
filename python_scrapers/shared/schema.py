"""Canonical BuyerRecord for the Python crawlers. Mirrors
src/sources/normalizer.js so both workers write the same shape."""

from __future__ import annotations
from typing import Optional, Any
from pydantic import BaseModel, Field


class BuyerRecord(BaseModel):
    source: str
    source_id: str
    name: str
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    size_bucket: Optional[str] = None
    description: Optional[str] = None
    hs_codes: list[str] = Field(default_factory=list)
    data_confidence: int = 60
    raw: Optional[Any] = None

    def as_dict(self) -> dict:
        return self.model_dump(mode="json")
