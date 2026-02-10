"""RAG (Retrieval-Augmented Generation) service for answering York University questions."""

import asyncio
import logging
import os
import time
from dataclasses import dataclass

import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env with override to ensure we get the correct keys
load_dotenv(override=True)

from app.core.config import settings

logger = logging.getLogger(__name__)

# Constants
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSION = 768
EMBEDDING_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent"

LLM_MODEL = "gemini-2.5-flash"
LLM_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{LLM_MODEL}:generateContent"

MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0  # seconds

SYSTEM_PROMPT = """You are LionGuide, York University's helpful AI assistant.
Answer questions using ONLY the context provided below.
If the answer isn't in the context, say "I don't have specific information about that. You can check the York University website at yorku.ca or contact the relevant department."
Always mention the source page when providing information.
Be conversational and helpful.

Context from York University:
{context}

Question: {question}

Provide a clear, helpful answer with source references."""


@dataclass
class SearchResult:
    """A search result from the vector database."""
    content: str
    title: str
    source_url: str
    similarity: float


@dataclass
class RAGResult:
    """Result from the RAG pipeline."""
    answer: str
    sources: list[dict]
    chunks_used: int
    query_time_ms: float


class RAGService:
    """Service for RAG-based question answering."""

    def __init__(self):
        # Use os.getenv to get the correct key from .env (already loaded with override)
        self.api_key = os.getenv("GEMINI_API_KEY") or settings.gemini_api_key
        self.supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
        self.supabase_key = os.getenv("SUPABASE_KEY") or settings.supabase_key
        self._supabase: Client | None = None
        self._http_client: httpx.AsyncClient | None = None

    def _get_supabase(self) -> Client:
        """Get or create Supabase client."""
        if self._supabase is None:
            if not self.supabase_url or not self.supabase_key:
                raise ValueError("Supabase credentials not configured")
            self._supabase = create_client(self.supabase_url, self.supabase_key)
        return self._supabase

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def _retry_with_backoff(self, func, *args, **kwargs):
        """Execute a function with exponential backoff retry."""
        last_exception = None
        delay = INITIAL_RETRY_DELAY

        for attempt in range(MAX_RETRIES):
            try:
                return await func(*args, **kwargs)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:  # Rate limited
                    logger.warning(f"Rate limited, waiting {delay}s before retry...")
                    await asyncio.sleep(delay)
                    delay *= 2
                    last_exception = e
                else:
                    raise
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                logger.warning(f"Network error (attempt {attempt + 1}): {e}")
                await asyncio.sleep(delay)
                delay *= 2
                last_exception = e

        raise last_exception or Exception("Max retries exceeded")

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding for text using Gemini API.

        Args:
            text: The text to embed

        Returns:
            768-dimensional embedding vector
        """
        if not self.api_key:
            raise ValueError("Gemini API key not configured")

        client = await self._get_http_client()

        async def _call_api():
            response = await client.post(
                f"{EMBEDDING_API_URL}?key={self.api_key}",
                json={
                    "model": f"models/{EMBEDDING_MODEL}",
                    "content": {"parts": [{"text": text}]},
                    "outputDimensionality": EMBEDDING_DIMENSION,
                },
            )
            response.raise_for_status()
            data = response.json()
            embedding = data.get("embedding", {}).get("values", [])

            if len(embedding) != EMBEDDING_DIMENSION:
                raise ValueError(f"Unexpected embedding dimension: {len(embedding)}")

            return embedding

        return await self._retry_with_backoff(_call_api)

    async def search_knowledge_base(
        self,
        query_embedding: list[float],
        match_threshold: float = 0.7,
        match_count: int = 5,
    ) -> list[SearchResult]:
        """Search the knowledge base for relevant chunks.

        Args:
            query_embedding: The query embedding vector
            match_threshold: Minimum similarity threshold
            match_count: Maximum number of results to return

        Returns:
            List of search results
        """
        supabase = self._get_supabase()

        try:
            result = supabase.rpc(
                "match_york_knowledge",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": match_threshold,
                    "match_count": match_count,
                },
            ).execute()

            if not result.data:
                return []

            return [
                SearchResult(
                    content=item.get("content", ""),
                    title=item.get("title", ""),
                    source_url=item.get("source_url", ""),
                    similarity=item.get("similarity", 0.0),
                )
                for item in result.data
            ]

        except Exception as e:
            logger.error(f"Knowledge base search error: {e}")
            raise

    async def generate_answer(
        self,
        question: str,
        context_chunks: list[SearchResult],
    ) -> str:
        """Generate an answer using the LLM.

        Args:
            question: The user's question
            context_chunks: Relevant context chunks

        Returns:
            The generated answer
        """
        if not self.api_key:
            raise ValueError("Gemini API key not configured")

        # Format context
        context_parts = []
        for i, chunk in enumerate(context_chunks, 1):
            context_parts.append(
                f"[Source {i}: {chunk.title}]\n{chunk.content}\n"
            )
        context = "\n".join(context_parts)

        # Build prompt
        prompt = SYSTEM_PROMPT.format(context=context, question=question)

        client = await self._get_http_client()

        async def _call_api():
            response = await client.post(
                f"{LLM_API_URL}?key={self.api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 500,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()

            # Extract answer from response
            candidates = data.get("candidates", [])
            if not candidates:
                raise ValueError("No response generated")

            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if not parts:
                raise ValueError("Empty response")

            return parts[0].get("text", "")

        return await self._retry_with_backoff(_call_api)

    async def ask(self, question: str) -> RAGResult:
        """Answer a question using RAG.

        Args:
            question: The user's question

        Returns:
            RAGResult with answer, sources, and metadata
        """
        start_time = time.time()

        logger.info(f"Processing question: {question[:100]}...")

        # Step 1: Generate embedding for the question
        query_embedding = await self.generate_embedding(question)

        # Step 2: Search for relevant chunks
        search_results = await self.search_knowledge_base(query_embedding)

        if not search_results:
            # No relevant chunks found
            return RAGResult(
                answer="I don't have specific information about that topic in my knowledge base. "
                       "You can check the York University website at yorku.ca or contact the "
                       "appropriate department for more information.",
                sources=[],
                chunks_used=0,
                query_time_ms=(time.time() - start_time) * 1000,
            )

        # Step 3: Generate answer using LLM
        answer = await self.generate_answer(question, search_results)

        # Step 4: Deduplicate sources
        seen_urls = set()
        unique_sources = []
        for result in search_results:
            if result.source_url not in seen_urls:
                seen_urls.add(result.source_url)
                unique_sources.append({
                    "title": result.title,
                    "url": result.source_url,
                })

        query_time_ms = (time.time() - start_time) * 1000
        logger.info(
            f"Question answered in {query_time_ms:.0f}ms using {len(search_results)} chunks"
        )

        return RAGResult(
            answer=answer,
            sources=unique_sources,
            chunks_used=len(search_results),
            query_time_ms=query_time_ms,
        )

    async def close(self):
        """Close the HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()


# Singleton instance
rag_service = RAGService()
