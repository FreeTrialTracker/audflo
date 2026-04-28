import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasDbUrl: !!process.env.DB_URL,
    hasDbServiceRoleKey: !!process.env.DB_SERVICE_ROLE_KEY,
    hasResendApiKey: !!process.env.RESEND_API_KEY,
  });
}
