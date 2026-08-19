import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_CONFIGURED, auth } from '@/auth';

/**
 * Who may reach the tool.
 *
 * The failure this guards against is not someone guessing a URL. It is the tool
 * being stood up on a company server with the sign-in credentials not yet filled
 * in, and nobody noticing that it is open — a tool that spends money on the
 * company's API key and takes confidential bid documents as input.
 *
 * So: with credentials, every page and API route requires a BCH sign-in. Without
 * them, it serves localhost as it does on a laptop today, and refuses everything
 * else with an explanation rather than quietly running unprotected.
 */
const PUBLIC_PATHS = [/^\/sign-in/, /^\/api\/auth\//, /^\/_next\//, /^\/favicon/, /^\/bch-logo/];

function isLocal(request: NextRequest): boolean {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => p.test(pathname))) return NextResponse.next();

  if (!AUTH_CONFIGURED) {
    if (isLocal(request)) return NextResponse.next();
    return new NextResponse(
      'Sign-in is not configured on this deployment, so it is refusing to serve.\n\n' +
        'Set AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET,\n' +
        'AUTH_MICROSOFT_ENTRA_ID_ISSUER and AUTH_SECRET, then restart.\n',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const session = await auth();
  if (session?.user) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in with your BCH account.' }, { status: 401 });
  }

  const url = new URL('/sign-in', request.url);
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
