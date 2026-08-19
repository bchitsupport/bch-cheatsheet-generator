import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

/**
 * Sign-in with a BCH Microsoft account.
 *
 * Two things this is for. Only BCH accounts can reach a tool that spends money
 * on the company's API key and takes confidential bid documents as input; and
 * access ends by itself when IT disables someone's account, with no password to
 * remember to rotate.
 *
 * SINGLE TENANT ON PURPOSE. The issuer URL carries the BCH tenant id, so a
 * personal Microsoft account or another company's cannot sign in even with a
 * valid Microsoft login. Pointing this at the multi-tenant `common` endpoint
 * would let in anyone with any Microsoft account, which is close to no
 * protection at all.
 */
export const AUTH_CONFIGURED = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
);

/**
 * With no credentials configured the app runs open, as it does today on a
 * laptop. It fails closed the moment it is deployed somewhere reachable —
 * see the check in middleware.ts, which refuses to serve a non-local host
 * without them rather than silently leaving the door open.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: AUTH_CONFIGURED
    ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
        }),
      ]
    : [],
  pages: { signIn: '/sign-in' },
  callbacks: {
    /**
     * Belt and braces over the single-tenant issuer: only accept a token whose
     * tenant is the one configured. A misconfigured app registration that
     * allowed other tenants would otherwise be invisible.
     */
    async signIn({ profile }) {
      const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? '';
      const tenant = issuer.match(/([0-9a-f-]{36})/i)?.[1];
      if (!tenant) return true;
      const tid = (profile as { tid?: string } | undefined)?.tid;
      return tid ? tid.toLowerCase() === tenant.toLowerCase() : false;
    },
    async session({ session, token }) {
      if (session.user) session.user.name = (token.name as string) ?? session.user.name;
      return session;
    },
  },
});
