-- Create the match_york_knowledge function for semantic search
-- This function performs cosine similarity search on the york_knowledge table

CREATE OR REPLACE FUNCTION match_york_knowledge(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  title text,
  source_url text,
  section text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    yk.id,
    yk.content,
    yk.title,
    yk.source_url,
    yk.section,
    1 - (yk.embedding <=> query_embedding) AS similarity
  FROM york_knowledge yk
  WHERE 1 - (yk.embedding <=> query_embedding) > match_threshold
  ORDER BY yk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
