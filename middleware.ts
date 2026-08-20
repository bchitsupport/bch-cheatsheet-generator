import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_CONFIGURED, NETWORK_ONLY_ACCESS, auth } from '@/auth';

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
    // Someone decided the network is the control. Serve.
    if (NETWORK_ONLY_ACCESS) return NextResponse.next();
    if (isLocal(request)) return NextResponse.next();

    // Neither configured nor deliberately opted out — this is an unfinished
    // setup, and serving it would put a tool that spends money and reads
    // confidential bid documents on the network unprotected by accident.
    return new NextResponse(
      'This deployment has no access control configured, so it is refusing to serve.\n\n' +
        'Either set up sign-in:\n' +
        '  AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET,\n' +
        '  AUTH_MICROSOFT_ENTRA_ID_ISSUER, AUTH_SECRET, AUTH_URL\n\n' +
        'or state that the network is the only control:\n' +
        '  ACCESS_CONTROL=network-only\n\n' +
        'Then restart.\n',
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

/**
 * Everything except the upload routes.
 *
 * Middleware runs in the Edge runtime, which buffers the request body and caps
 * it at a few megabytes. Anything larger is destroyed before the route handler
 * sees it and `request.formData()` fails with "Failed to parse body as
 * FormData" — which reads like a bad file and is not. Measured: a 12 MB spec
 * book failed with the matcher covering these routes and split cleanly without.
 * The two largest books tested, 12 MB and 15 MB, were both unusable.
 *
 * Those routes therefore check access themselves — see `requireAccess` — rather
 * than relying on middleware they cannot afford to run.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|api/split|api/build|api/blocks|api/extract).*)'],
};
