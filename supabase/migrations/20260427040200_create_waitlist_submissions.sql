/*
  # Create waitlist_submissions table

  ## Purpose
  Stores all waitlist form submissions from the AudFlo landing page modal.

  ## New Tables
  - `waitlist_submissions`
    - `id` (uuid, primary key)
    - `email` (text, unique) — submitted email address
    - `company_name` (text, nullable) — optional company
    - `team_size` (text) — selected team size option
    - `use_case` (text) — selected main use case
    - `reason` (text) — why they're looking for automation
    - `intent` (text) — reserve or notify intent
    - `would_pay` (text) — yes/maybe/no willingness to pay
    - `source` (text) — which CTA triggered the modal
    - `created_at` (timestamptz) — submission timestamp

  ## Security
  - RLS enabled; only the service role (server-side API) can insert/select
  - No authenticated user policies — submissions come from anonymous visitors via a server action
*/

CREATE TABLE IF NOT EXISTS waitlist_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  company_name text DEFAULT '',
  team_size text NOT NULL DEFAULT '',
  use_case text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  intent text NOT NULL DEFAULT 'reserve',
  would_pay text NOT NULL DEFAULT 'maybe',
  source text NOT NULL DEFAULT 'unknown',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waitlist_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert submissions"
  ON waitlist_submissions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select submissions"
  ON waitlist_submissions
  FOR SELECT
  TO service_role
  USING (true);
