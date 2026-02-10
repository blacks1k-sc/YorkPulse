#!/usr/bin/env python3
"""
Generate Gemini embeddings for York University scraped data and upload to Supabase.

Usage:
    python scripts/generate_embeddings.py

Requirements:
    - GEMINI_API_KEY in .env
    - SUPABASE_URL and SUPABASE_KEY in .env
    - york_data.json in data/scraped/
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm

# Load environment variables (override=True to use .env over shell env)
load_dotenv(override=True)

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")  # Service role key

# Gemini embedding config
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSION = 768  # Configured via outputDimensionality
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent"

# Rate limiting: 15 requests/minute = 4 seconds between requests
REQUEST_DELAY = 4.5  # seconds (slightly more than 4 for safety)
MAX_RETRIES = 3
RETRY_DELAY = 10  # seconds

# Batch size for Supabase inserts
BATCH_SIZE = 10

# Paths
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_FILE = BACKEND_DIR / "data" / "scraped" / "york_data.json"
FAILED_CHUNKS_FILE = SCRIPT_DIR / "failed_chunks.json"
PROGRESS_FILE = SCRIPT_DIR / "embedding_progress.json"


def validate_environment() -> bool:
    """Validate required environment variables exist."""
    missing = []

    if not GEMINI_API_KEY or GEMINI_API_KEY == "placeholder":
        missing.append("GEMINI_API_KEY")
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_KEY")

    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}")
        print("Please set these in your .env file")
        return False

    return True


def load_scraped_data() -> list[dict]:
    """Load and flatten scraped data into chunks."""
    if not DATA_FILE.exists():
        print(f"ERROR: Data file not found: {DATA_FILE}")
        sys.exit(1)

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        pages = json.load(f)

    chunks = []
    for page in pages:
        url = page.get("url", "")
        title = page.get("title", "")

        for chunk in page.get("chunks", []):
            chunks.append({
                "content": chunk.get("text", ""),
                "source_url": url,
                "title": title,
                "section": f"chunk_{chunk.get('chunk_index', 0)}",
                "chunk_index": chunk.get("chunk_index", 0),
            })

    return chunks


def generate_embedding(text: str, client: httpx.Client) -> list[float] | None:
    """Generate embedding for a single text using Gemini API."""
    headers = {
        "Content-Type": "application/json",
    }

    payload = {
        "model": f"models/{EMBEDDING_MODEL}",
        "content": {
            "parts": [{"text": text}]
        },
        "outputDimensionality": EMBEDDING_DIMENSION
    }

    for attempt in range(MAX_RETRIES):
        try:
            response = client.post(
                f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                headers=headers,
                json=payload,
                timeout=30.0
            )

            if response.status_code == 200:
                data = response.json()
                embedding = data.get("embedding", {}).get("values", [])

                # Validate dimension
                if len(embedding) != EMBEDDING_DIMENSION:
                    print(f"WARNING: Unexpected embedding dimension: {len(embedding)} (expected {EMBEDDING_DIMENSION})")

                return embedding

            elif response.status_code == 429:
                # Rate limited - wait and retry
                print(f"Rate limited. Waiting {RETRY_DELAY}s before retry...")
                time.sleep(RETRY_DELAY)
                continue

            else:
                print(f"API error (attempt {attempt + 1}): {response.status_code} - {response.text[:200]}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)

        except httpx.TimeoutException:
            print(f"Timeout (attempt {attempt + 1})")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)

        except Exception as e:
            print(f"Error (attempt {attempt + 1}): {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)

    return None


def upload_batch(supabase: Client, batch: list[dict]) -> tuple[int, int]:
    """Upload a batch of records to Supabase. Returns (success_count, fail_count)."""
    try:
        # Prepare records for insertion
        records = []
        for item in batch:
            records.append({
                "content": item["content"],
                "embedding": item["embedding"],
                "source_url": item["source_url"],
                "title": item["title"],
                "section": item["section"],
            })

        result = supabase.table("york_knowledge").insert(records).execute()

        if result.data:
            return len(result.data), 0
        return 0, len(batch)

    except Exception as e:
        print(f"Supabase upload error: {e}")
        return 0, len(batch)


def save_progress(processed: int, successful: int, failed: int, failed_chunks: list):
    """Save progress to files."""
    progress = {
        "processed": processed,
        "successful": successful,
        "failed": failed,
        "timestamp": datetime.now().isoformat(),
    }

    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2)

    if failed_chunks:
        with open(FAILED_CHUNKS_FILE, "w") as f:
            json.dump(failed_chunks, f, indent=2)


def load_progress() -> dict:
    """Load previous progress if exists."""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"processed": 0, "successful": 0, "failed": 0}


def main():
    """Main entry point."""
    print("=" * 60)
    print("York University Knowledge Base Embedding Generator")
    print("=" * 60)

    # Validate environment
    if not validate_environment():
        sys.exit(1)

    print(f"\nGemini Model: {EMBEDDING_MODEL}")
    print(f"Embedding Dimension: {EMBEDDING_DIMENSION}")
    print(f"Rate Limit Delay: {REQUEST_DELAY}s between requests")

    # Load data
    print(f"\nLoading data from: {DATA_FILE}")
    chunks = load_scraped_data()
    total_chunks = len(chunks)
    print(f"Found {total_chunks} chunks to process")

    # Initialize clients
    print("\nInitializing API clients...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    http_client = httpx.Client()

    # Track progress
    successful = 0
    failed = 0
    failed_chunks = []
    batch_buffer = []

    start_time = time.time()

    # Process chunks with progress bar
    print(f"\nProcessing {total_chunks} chunks...")
    print("(This will take approximately {:.1f} minutes due to rate limiting)\n".format(
        total_chunks * REQUEST_DELAY / 60
    ))

    try:
        with tqdm(total=total_chunks, desc="Generating embeddings", unit="chunk") as pbar:
            for i, chunk in enumerate(chunks):
                pbar.set_postfix({
                    "success": successful,
                    "failed": failed,
                    "batch": len(batch_buffer)
                })

                # Generate embedding
                embedding = generate_embedding(chunk["content"], http_client)

                if embedding:
                    chunk["embedding"] = embedding
                    batch_buffer.append(chunk)

                    # Upload batch when full
                    if len(batch_buffer) >= BATCH_SIZE:
                        s, f = upload_batch(supabase, batch_buffer)
                        successful += s
                        failed += f
                        batch_buffer = []

                        # Save progress periodically
                        if (i + 1) % 50 == 0:
                            save_progress(i + 1, successful, failed, failed_chunks)
                else:
                    failed += 1
                    failed_chunks.append({
                        "index": i,
                        "content": chunk["content"][:200],
                        "source_url": chunk["source_url"],
                        "error": "Failed to generate embedding"
                    })

                pbar.update(1)

                # Rate limiting delay
                if i < total_chunks - 1:
                    time.sleep(REQUEST_DELAY)

        # Upload remaining batch
        if batch_buffer:
            s, f = upload_batch(supabase, batch_buffer)
            successful += s
            failed += f

    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Saving progress...")
        # Upload whatever is in the buffer
        if batch_buffer:
            s, f = upload_batch(supabase, batch_buffer)
            successful += s
            failed += f

    finally:
        http_client.close()
        save_progress(total_chunks, successful, failed, failed_chunks)

    # Final stats
    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print("EMBEDDING GENERATION COMPLETE")
    print("=" * 60)
    print(f"\nTotal chunks:     {total_chunks}")
    print(f"Successful:       {successful}")
    print(f"Failed:           {failed}")
    print(f"Success rate:     {successful/total_chunks*100:.1f}%")
    print(f"Total time:       {elapsed/60:.1f} minutes")
    print(f"Avg per chunk:    {elapsed/total_chunks:.2f} seconds")

    if failed_chunks:
        print(f"\nFailed chunks saved to: {FAILED_CHUNKS_FILE}")

    print(f"\nProgress saved to: {PROGRESS_FILE}")
    print("\nDone!")

    return successful, failed


if __name__ == "__main__":
    main()
