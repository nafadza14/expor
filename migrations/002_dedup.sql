-- EksporIn | cross-source dedup
-- Adds a canonical content_hash so the same buyer discovered by GLEIF,
-- Kompass, Europages, etc collapses into one row instead of duplicating.
-- The hash is md5(lower(trim(name)) || '|' || coalesce(country,'')). We
-- deliberately do not include address or website because sources supply
-- them inconsistently, so cross-source matches would miss.

ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Backfill for rows that predate this column.
UPDATE scraped_buyers
   SET content_hash = MD5(LOWER(TRIM(name)) || '|' || COALESCE(country, ''))
 WHERE content_hash IS NULL;

-- Auto-populate on every future insert / update where name is set.
CREATE OR REPLACE FUNCTION set_scraped_buyers_content_hash() RETURNS trigger AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.content_hash := MD5(LOWER(TRIM(NEW.name)) || '|' || COALESCE(NEW.country, ''));
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scraped_buyers_content_hash ON scraped_buyers;
CREATE TRIGGER trg_scraped_buyers_content_hash
  BEFORE INSERT OR UPDATE OF name, country ON scraped_buyers
  FOR EACH ROW EXECUTE FUNCTION set_scraped_buyers_content_hash();

-- Index (not unique) so upserts can look up by hash fast. We do NOT make
-- it unique because the same entity may legitimately be present with
-- different (source, source_id) rows before we merge them. Cross-source
-- dedup happens in the application layer against this index.
CREATE INDEX IF NOT EXISTS idx_scraped_buyers_content_hash
  ON scraped_buyers (content_hash);

-- Track which sources have contributed to a given canonical buyer.
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS sources_seen TEXT[] NOT NULL DEFAULT '{}';
UPDATE scraped_buyers SET sources_seen = ARRAY[source] WHERE sources_seen = '{}';
