import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { signOut } from "@/app/actions/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("settings")
    .select("company_name")
    .single();

  return (
    <AppShell
      email={user.email ?? ""}
      company={settings?.company_name ?? "الشركة"}
      signOut={signOut}
    >
      {children}
    </AppShell>
  );
}
