import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/top-bar";
import { BottomNav } from "@/components/bottom-nav";

// Browse-first: /games is public, so this layout renders for logged-out
// visitors too. /bookings and /organiser are gated by the middleware.
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName = "Player";
  let isOrganiser = false;
  let walletPence = 0;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, is_organiser, wallet_balance_pence")
      .eq("id", user.id)
      .maybeSingle();
    displayName = profile?.name || profile?.email || user.email || "Player";
    isOrganiser = profile?.is_organiser ?? false;
    walletPence = profile?.wallet_balance_pence ?? 0;
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <TopBar
        loggedIn={!!user}
        displayName={displayName}
        isOrganiser={isOrganiser}
        walletPence={walletPence}
      />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-6 pb-24 animate-in fade-in duration-300">
        {children}
      </main>
      <BottomNav loggedIn={!!user} isOrganiser={isOrganiser} />
    </div>
  );
}
