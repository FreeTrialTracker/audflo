import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { waitlistSchema } from '@/lib/waitlist-schema';

export async function POST(req: NextRequest) {
  console.log('[waitlist env]', {
    hasDbUrl: !!process.env.DB_URL,
    hasDbServiceRoleKey: !!process.env.DB_SERVICE_ROLE_KEY,
    hasResendApiKey: !!process.env.RESEND_API_KEY,
  });

  if (!process.env.DB_URL || !process.env.DB_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: missing DB credentials' }),
      { status: 500 }
    );
  }

  if (!process.env.RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: missing RESEND_API_KEY' }),
      { status: 500 }
    );
  }

  const supabase = createClient(
    process.env.DB_URL!,
    process.env.DB_SERVICE_ROLE_KEY!
  );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid submission.' },
      { status: 400 }
    );
  }

  const { email, companyName, teamSize, useCase, reason, intent, wouldPay } = parsed.data;
  const source: string =
    typeof (body as Record<string, unknown>).source === 'string'
      ? String((body as Record<string, unknown>).source).slice(0, 100)
      : 'unknown';

  const { error: dbError } = await supabase.from('waitlist_submissions').upsert(
    {
      email,
      company_name: companyName ?? '',
      team_size: teamSize,
      use_case: useCase,
      reason,
      intent,
      would_pay: wouldPay,
      source,
    },
    { onConflict: 'email' }
  );

  if (dbError) {
    console.error('[waitlist] upsert error', dbError.message);
    return NextResponse.json({ error: 'Could not save submission.' }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);

  const subject =
    intent === 'reserve'
      ? "You're on the AudFlo reserve list"
      : "You're on the AudFlo waitlist";

  const html =
    intent === 'reserve'
      ? `<p>Hi,</p><p>You've reserved your spot on AudFlo. We'll reach out as soon as early access opens.</p><p>— The AudFlo Team</p>`
      : `<p>Hi,</p><p>You're on the AudFlo waitlist. We'll let you know when we launch.</p><p>— The AudFlo Team</p>`;

  const { data, error: resendError } = await resend.emails.send({
    from: 'AudFlo <hello@audflo.com>',
    to: email,
    subject,
    html,
  });

  console.log('[resend result]', { id: data?.id, error: resendError });

  if (resendError) {
    console.error('[resend] send failed', resendError);
    return NextResponse.json(
      { error: 'Waitlist saved but confirmation email failed.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, emailSent: true, resendId: data!.id }, { status: 200 });
}
