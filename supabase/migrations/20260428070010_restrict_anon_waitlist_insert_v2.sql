/*
  # Restrict anonymous waitlist inserts

  Replaces the unrestricted anon INSERT policy with one that enforces
  data integrity constraints directly in the WITH CHECK clause:

  - email must be non-empty and contain an @ sign (basic format guard)
  - intent must be one of the two valid enum values
  - would_pay must be one of the three valid enum values
  - team_size, use_case, reason must all be non-empty strings

  This prevents junk/malformed rows from being inserted by anonymous
  callers while keeping the form fully public (no login required).
*/

DROP POLICY IF EXISTS "Anyone can submit to waitlist" ON waitlist_submissions;
DROP POLICY IF EXISTS "Anon can insert valid waitlist submissions" ON waitlist_submissions;

CREATE POLICY "Anon can insert valid waitlist submissions"
  ON waitlist_submissions
  FOR INSERT
  TO anon
  WITH CHECK (
    email     <> '' AND email LIKE '%@%'
    AND intent    IN ('reserve', 'notify')
    AND would_pay IN ('yes', 'maybe', 'no')
    AND team_size <> ''
    AND use_case  <> ''
    AND reason    <> ''
  );
