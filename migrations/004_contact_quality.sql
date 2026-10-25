-- EksporIn | contact provenance + quality scoring
-- Contacts now carry where they were found (source URL) and a status
-- (role / domain / personal / freemail), every row gets a 0-100
-- quality_score used for ranking, and junk / unreachable rows can be
-- hidden from the user-facing directory without deleting them.

ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS email_status TEXT;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS email_source_url TEXT;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS phone_source_url TEXT;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS website_method TEXT;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS contact_checked_at TIMESTAMPTZ;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS contact_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS quality_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS hidden_reason TEXT;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS buyer_type TEXT;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS evidence_url TEXT;

-- The old Node enricher invented info@<domain> when a site had no email.
-- Those were never observed anywhere, so drop them; the new enricher
-- re-checks every site and only stores addresses it actually saw.
UPDATE scraped_buyers
   SET email = NULL
 WHERE email IS NOT NULL
   AND email_status IS NULL
   AND source <> 'ai_agent'
   AND website IS NOT NULL
   AND email = 'info@' || regexp_replace(regexp_replace(lower(website), '^https?://(www\.)?', ''), '/.*$', '');

CREATE OR REPLACE FUNCTION eksporin_quality(b scraped_buyers) RETURNS INTEGER AS $$
  SELECT LEAST(100,
      (CASE WHEN b.email IS NULL THEN 0
            WHEN b.email_status = 'role' THEN 35
            WHEN b.email_status = 'domain' THEN 30
            WHEN b.email_status = 'personal' THEN 28
            WHEN b.email_status = 'freemail' THEN 20
            ELSE 18 END)
    + (CASE WHEN b.phone IS NOT NULL THEN 15 ELSE 0 END)
    + (CASE WHEN b.website IS NOT NULL THEN 15 ELSE 0 END)
    + (CASE WHEN b.buyer_type IS NOT NULL
              OR COALESCE(b.industry,'') ~* '(import|wholesal|distribut|roast|trad|gro(ss|ß)handel|process|manufactur|packer|brand|chocolat|grossiste|importateur|mayorista)'
            THEN 15 ELSE 0 END)
    + (CASE WHEN cardinality(b.hs_codes) > 0 THEN 5 ELSE 0 END)
    + LEAST(cardinality(b.sources_seen), 3) * 3
    + (CASE WHEN b.evidence_url IS NOT NULL OR b.source IN ('ai_agent', 'usda_oid', 'trade_directory') THEN 6 ELSE 0 END)
  )::int
$$ LANGUAGE sql STABLE;

-- Rows that are clearly not commercial buyers stay in the table (for
-- dedup) but are hidden from users.
CREATE OR REPLACE FUNCTION eksporin_hidden_reason(b scraped_buyers) RETURNS TEXT AS $$
  SELECT CASE
    WHEN length(trim(b.name)) < 3 THEN 'bad_name'
    WHEN cardinality(b.hs_codes) = 0 THEN 'no_commodity'
    WHEN COALESCE(b.industry,'') || ' ' || COALESCE(b.description,'')
         ~* '(\m(restaurant|cafe|café|coffee shop|bar|pub|hotel|bakery|caterer|catering)\M|consult|software|insurance|bank|real estate|immobili|recruit|staffing|marketing agency|law firm|accounting)'
         AND NOT (COALESCE(b.industry,'') || ' ' || COALESCE(b.description,'') || ' ' || b.name ~* '(import|wholesal|distribut|roast|trad|process|gro(ss|ß)handel|grossiste)') THEN 'not_a_buyer'
    WHEN b.contact_attempts >= 2 AND b.website IS NULL AND b.email IS NULL AND b.phone IS NULL THEN 'unreachable'
    ELSE NULL END
$$ LANGUAGE sql STABLE;

UPDATE scraped_buyers sb SET quality_score = eksporin_quality(sb),
       hidden_reason = eksporin_hidden_reason(sb),
       is_hidden = eksporin_hidden_reason(sb) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scraped_buyers_rank ON scraped_buyers (is_hidden, quality_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_buyers_contact_queue ON scraped_buyers (contact_checked_at NULLS FIRST, data_confidence DESC);
