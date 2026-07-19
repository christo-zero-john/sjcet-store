import { AuthForm } from "../../features/auth/auth-form";
import { signIn, signUp } from "../../features/auth/actions";
import { safeAuthReturnPath } from "../../features/auth/return-path";

type AuthPageProps = Readonly<{
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}>;

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const next = safeAuthReturnPath(params.next) ?? undefined;

  return (
    <main className="auth-page">
      <section className="auth-intro" aria-label="SJCET Store introduction">
        <p className="eyebrow">St. Joseph&apos;s College of Engineering</p>
        <h2>One college store. Every service in one place.</h2>
        <p>
          Manage store inventory, counter sales, payments, printing, and student
          services through one secure account.
        </p>
        <div className="auth-feature-list" aria-label="Platform capabilities">
          <span>Store inventory</span>
          <span>Counter billing</span>
          <span>Print services</span>
        </div>
      </section>

      <AuthForm
        error={params.error}
        message={params.message}
        next={next}
        signInAction={signIn}
        signUpAction={signUp}
      />
    </main>
  );
}
