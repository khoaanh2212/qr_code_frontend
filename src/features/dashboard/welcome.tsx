"use client";

import { useUser } from "@/features/auth/require-session";
import { format } from "@/i18n/config";

export function Welcome({ template }: { template: string }) {
  const user = useUser();
  return <h1 className="text-2xl font-semibold">{format(template, { name: user.display_name || user.email })}</h1>;
}
