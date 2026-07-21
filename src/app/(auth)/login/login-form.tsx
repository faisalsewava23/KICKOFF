"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logotype } from "@/components/logotype";
import { loginFormAction, type LoginFormState } from "./actions";

const INITIAL_STATE: LoginFormState = {};

export function LoginForm({
  authFailed,
  next,
}: {
  authFailed: boolean;
  next: string | null;
}) {
  // useActionState + <form action>: the submit reaches the server even if
  // the user taps before hydration (native POST fallback) — a plain
  // onSubmit handler silently no-ops in that window.
  const [state, formAction, isPending] = useActionState(
    loginFormAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!authFailed) return;
    // Defer a tick: this effect runs before the root layout's <Toaster>
    // has subscribed, and sonner drops toasts fired before that.
    const id = setTimeout(() => {
      toast.error("That link didn't work. Please try again.");
      window.history.replaceState(
        null,
        "",
        next ? `/login?next=${encodeURIComponent(next)}` : "/login"
      );
    }, 0);
    return () => clearTimeout(id);
  }, [authFailed, next]);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const contextLine = next
    ? next.startsWith("/games")
      ? "Log in to book your spot."
      : "Log in to pick up where you left off."
    : null;

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 animate-in fade-in duration-300">
      <Card className="w-full max-w-[400px] [--card-spacing:--spacing(6)]">
        <CardContent className="flex flex-col items-center gap-6 py-4 text-center">
          {state.sentTo ? (
            <>
              <Mail className="size-16 text-muted-foreground" aria-hidden />
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                Check your email
              </h1>
              <p className="text-base text-muted-foreground">
                We sent a magic link to{" "}
                <span className="font-medium text-foreground">
                  {state.sentTo}
                </span>
                .
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h1>
                  <Logotype className="text-5xl" />
                </h1>
                <p className="text-base text-muted-foreground">
                  Book football. Skip the group chat.
                </p>
                {contextLine ? (
                  <p className="text-sm font-semibold text-primary">
                    {contextLine}
                  </p>
                ) : null}
              </div>
              <form action={formAction} className="flex w-full flex-col gap-3">
                <input type="hidden" name="next" value={next ?? ""} />
                <Label htmlFor="email" className="sr-only">
                  Email address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={isPending}
                  defaultValue={state.email}
                  className="h-14 text-base"
                />
                <Button
                  type="submit"
                  disabled={isPending}
                  className="h-14 w-full text-base font-semibold active:scale-95 transition-all"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden />
                      Sending link…
                    </>
                  ) : (
                    "Send magic link"
                  )}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
