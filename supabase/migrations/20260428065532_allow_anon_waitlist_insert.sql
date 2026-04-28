/*
  # Allow anonymous waitlist inserts

  The waitlist form is public — no auth required to submit.
  Adding an INSERT policy for the anon role so submissions work
  without a service role key. Upsert on conflict (email) is also
  covered because upsert uses INSERT under the hood.

  No SELECT/UPDATE/DELETE granted to anon — data stays protected.
*/

CREATE POLICY "Anyone can submit to waitlist"
  ON waitlist_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);
