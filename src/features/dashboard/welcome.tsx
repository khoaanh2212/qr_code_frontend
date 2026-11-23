"use client";

import { useUser } from "@/features/auth/require-session";

export function Welcome() {
  const user = useUser();
  return (
    <h1 className="text-2xl font-semibold">
      Welcome, {user.display_name || user.email}
    </h1>
  );
}
