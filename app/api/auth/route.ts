import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PASSWORD = 'SnigurField';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body.password?.trim();

    if (password === PASSWORD) {
      const cookieStore = await cookies();
      cookieStore.set('mlb-auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
