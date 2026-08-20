import { AUTH_CONFIGURED, NETWORK_ONLY_ACCESS, auth } from '@/auth';

/**
 * The same access check middleware performs, for the routes middleware cannot
 * run on.
 *
 * Uploads carry whole specification books — 15 MB is normal. Middleware runs in
 * the Edge runtime, which buffers the request body and caps it at a few
 * megabytes, so anything larger is destroyed before the handler sees it and
 * `request.formData()` fails with "Failed to parse body as FormData". That reads
 * like a corrupt file and is not: measured, a 12 MB book failed with middleware
 * in front of it and split cleanly without.
 *
 * So the upload routes are excluded from the matcher and call this instead. It
 * runs in the Node runtime, reads no body, and enforces the same rule.
 *
 * Returns a Response to send when access is refused, or null to continue.
 */
export async function requireAccess(request: Request): Promise<Response | null> {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';

  if (NETWORK_ONLY_ACCESS) return null;

  if (!AUTH_CONFIGURED) {
    if (isLocal) return null;
    return Response.json(
      {
        error:
          'This deployment has no access control configured, so it is refusing to serve. ' +
          'Set ACCESS_CONTROL=network-only, or configure Microsoft Entra sign-in.',
      },
      { status: 503 },
    );
  }

  const session = await auth();
  if (session?.user) return null;

  return Response.json({ error: 'Sign in with your BCH account.' }, { status: 401 });
}
