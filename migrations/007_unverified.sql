-- EksporIn | stricter visibility for name-only registry rows
--
-- Rows that a registry gave us only by company name (Australian ABN list,
-- city lists without NAICS) are kept hidden as 'unverified' until the
-- contact enricher finds the company's own website and confirms the name
-- on it. The enricher's queue includes these rows.

CREATE OR REPLACE FUNCTION eksporin_hidden_reason(b scraped_buyers) RETURNS TEXT AS $$
  SELECT CASE
    WHEN length(trim(b.name)) < 3 THEN 'bad_name'
    WHEN cardinality(b.hs_codes) = 0 THEN 'no_commodity'
    WHEN COALESCE(b.industry,'') || ' ' || COALESCE(b.description,'')
         ~* '(\m(restaurant|cafe|café|coffee shop|bar|pub|hotel|bakery|caterer|catering)\M|consult|software|insurance|bank|real estate|immobili|recruit|staffing|marketing agency|law firm|accounting)'
         AND NOT (COALESCE(b.industry,'') || ' ' || COALESCE(b.description,'') || ' ' || b.name ~* '(import|wholesal|distribut|roast|trad|process|gro(ss|ß)handel|grossiste)') THEN 'not_a_buyer'
    WHEN b.contact_attempts >= 2 AND b.website IS NULL AND b.email IS NULL AND b.phone IS NULL THEN 'unreachable'
    -- Companies picked from a registry by NAME only (no activity code) stay
    -- hidden until the enricher finds their own website with the same name.
    WHEN COALESCE(b.industry, '') LIKE '%(by company name)%' AND b.website IS NULL THEN 'unverified'
    ELSE NULL END
$$ LANGUAGE sql STABLE;

UPDATE scraped_buyers sb SET hidden_reason = eksporin_hidden_reason(sb),
       is_hidden = eksporin_hidden_reason(sb) IS NOT NULL
 WHERE hidden_reason IS DISTINCT FROM eksporin_hidden_reason(sb);
