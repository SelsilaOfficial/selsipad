import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear admin session cookie
  response.cookies.delete('admin_session');

  return response;
}
