import { signOut } from "../../features/auth/actions";
import { requireStudentLanding } from "../../features/auth/authorization";
import { StudentDashboard } from "../../features/student/student-dashboard";

type StudentPageProps = Readonly<{
  searchParams: Promise<{ notice?: string }>;
}>;

export default async function StudentPage({ searchParams }: StudentPageProps) {
  const { user } = await requireStudentLanding();
  const params = await searchParams;

  return (
    <StudentDashboard
      displayName={
        typeof user.user_metadata.display_name === "string"
          ? user.user_metadata.display_name
          : null
      }
      email={user.email ?? "Signed-in college customer"}
      notice={params.notice}
      signOutAction={signOut}
    />
  );
}
