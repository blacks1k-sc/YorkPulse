"""Ask endpoint for RAG-based question answering about York University."""

import logging

from fastapi import APIRouter, HTTPException, status

from app.schemas.ask import AskRequest, AskResponse, Source
from app.services.rag_service import rag_service

router = APIRouter(prefix="/ask", tags=["Ask"])
logger = logging.getLogger(__name__)


@router.post("", response_model=AskResponse, status_code=status.HTTP_200_OK)
async def ask_question(request: AskRequest) -> AskResponse:
    """Ask a question about York University.

    Uses RAG (Retrieval-Augmented Generation) to:
    1. Convert the question to an embedding
    2. Search the knowledge base for relevant information
    3. Generate an answer using an LLM

    Returns the answer along with source documents used.
    """
    question = request.question.strip()

    # Validate question
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty",
        )

    if len(question) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question is too long (max 500 characters)",
        )

    try:
        # Process the question through RAG pipeline
        result = await rag_service.ask(question)

        # Format response
        sources = [
            Source(title=s["title"], url=s["url"])
            for s in result.sources
        ]

        return AskResponse(
            answer=result.answer,
            sources=sources,
            chunks_used=result.chunks_used,
        )

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Service configuration error. Please try again later.",
        )

    except Exception as e:
        logger.exception(f"Error processing question: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing your question. Please try again.",
        )


@router.get("/health", status_code=status.HTTP_200_OK)
async def ask_health():
    """Health check for the ask endpoint."""
    return {"status": "ok", "service": "ask"}
