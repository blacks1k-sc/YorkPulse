"""Schemas for the Ask (RAG) endpoint."""

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    """Request schema for asking a question."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="The question to ask about York University",
        examples=["When do classes start for Fall 2025?"],
    )


class Source(BaseModel):
    """A source document used to answer the question."""

    title: str
    url: str


class AskResponse(BaseModel):
    """Response schema for the ask endpoint."""

    answer: str = Field(..., description="The AI-generated answer")
    sources: list[Source] = Field(
        default_factory=list,
        description="Source documents used to generate the answer",
    )
    chunks_used: int = Field(..., description="Number of context chunks used")


class AskError(BaseModel):
    """Error response for the ask endpoint."""

    detail: str
    error_code: str | None = None
