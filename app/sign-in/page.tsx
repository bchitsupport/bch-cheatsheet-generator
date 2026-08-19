import { AUTH_CONFIGURED, signIn } from '@/auth';

export const metadata = { title: 'Sign in — BCH Cheat Sheet Generator' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-20">
      <div className="card p-8">
        <h1 className="text-xl font-bold tracking-tight text-bch-navy">Sign in</h1>
        <p className="mt-2 text-sm text-bch-muted">
          The cheat sheet generator is for BCH Mechanical staff. Sign in with the
          Microsoft account you use for email.
        </p>

        {AUTH_CONFIGURED ? (
          <form
            action={async () => {
              'use server';
              await signIn('microsoft-entra-id', { redirectTo: from ?? '/' });
            }}
          >
            <button type="submit" className="btn-primary mt-6 w-full">
              Sign in with your BCH account
            </button>
          </form>
        ) : (
          <p className="mt-6 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Sign-in is not configured on this instance. It is running open for local
            development; a deployed instance refuses to serve until the Microsoft Entra
            credentials are set.
          </p>
        )}

        <p className="mt-6 text-xs text-bch-muted">
          Access follows your BCH account. If you cannot sign in, ask IT to confirm your
          account is enabled for this application.
        </p>
      </div>
    </div>
  );
}
