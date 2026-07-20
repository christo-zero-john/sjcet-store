type FormAction = () => void | Promise<void>;

type StudentDashboardProps = Readonly<{
  email: string;
  displayName?: string | null;
  notice?: string;
  signOutAction?: FormAction;
}>;

export function StudentDashboard({
  email,
  displayName,
  notice,
  signOutAction,
}: StudentDashboardProps) {
  return (
    <main className="student-landing">
      <section className="student-landing-card">
        <p className="eyebrow">SJCET Store</p>
        <span className="role-pill">Student / Customer</span>
        <h1>Welcome{displayName ? `, ${displayName}` : ""}</h1>
        <p>You are signed in with your college customer account.</p>
        <strong>{email}</strong>
        {notice ? <p className="notice">{notice}</p> : null}
        <form action={signOutAction}>
          <button className="secondary-button" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
