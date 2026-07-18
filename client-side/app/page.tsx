import { redirect } from "next/navigation";

import { requireRoleDestination } from "../features/auth/authorization";

export default async function HomePage() {
  const { destination } = await requireRoleDestination();
  redirect(destination);
}
