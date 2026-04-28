import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { waitlistSchema } from '@/lib/waitlist-schema';

export async function POST(req: NextRequest) {
  console.log('[waitlist env]', {
    hasDbUrl: !!process.env.DB_URL,
    hasDbServiceRoleKey: !!process.env.DB_SERVICE_ROLE_KEY,
  });

  if (!process.env.DB_URL || !process.env.DB_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: missing DB credentials' }),
      { status: 500 }
    );
  }

  const supabase = createClient(
    process.env.DB_URL!,
    process.env.DB_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const parsed = waitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid submission.' },
        { status: 400 }
      );
    }

    const { email, companyName, teamSize, useCase, reason, intent, wouldPay } = parsed.data;
    const source: string =
      typeof body.source === 'string' ? body.source.slice(0, 100) : 'unknown';

    const { error } = await supabase.from('waitlist_submissions').upsert(
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

    if (error) {
      console.error('[waitlist] upsert error', error.message);
      return NextResponse.json({ error: 'Could not save submission.' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
