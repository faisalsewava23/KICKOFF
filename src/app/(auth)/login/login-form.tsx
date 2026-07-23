"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logotype } from "@/components/logotype";
import {
  resendLoginCode,
  sendLoginCode,
  verifyOtpCode,
  type LoginFormState,
  type VerifyState,
} from "./actions";

const SEND_INITIAL: LoginFormState = {};
const VERIFY_INITIAL: VerifyState = {};
const RESEND_COOLDOWN_SECONDS = 30;

export function LoginForm({
  authFailed,
  next,
}: {
  authFailed: boolean;
  next: string | null;
}) {
  // useActionState + <form action>: submits reach the server even before
  // hydration (native POST fallback).
  const [sendState, sendAction, sendPending] = useActionState(
    sendLoginCode,
    SEND_INITIAL
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyOtpCode,
    VERIFY_INITIAL
  );
  const [, startResend] = useTransition();

  // "Use a different email" dismisses the current send. Compared by object
  // identity: any NEW successful send (even of the same address) supersedes
  // the dismissal without effects or cascading state.
  const [dismissedState, setDismissedState] = useState<LoginFormState | null>(
    null
  );
  const sentTo =
    sendState !== dismissedState ? sendState.sentTo : undefined;

  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authFailed) return;
    // Defer a tick: this effect runs before the root layout's <Toaster>
    // has subscribed, and sonner drops toasts fired before that.
    const id = setTimeout(() => {
      toast.error("That link didn't work — log in with a code instead.");
      window.history.replaceState(
        null,
        "",
        next ? `/login?next=${encodeURIComponent(next)}` : "/login"
      );
    }, 0);
    return () => clearTimeout(id);
  }, [authFailed, next]);

  useEffect(() => {
    if (sendState.error) toast.error(sendState.error);
  }, [sendState]);

  useEffect(() => {
    if (!verifyState.error) return;
    toast.error(verifyState.error);
    const id = setTimeout(() => {
      setCode("");
      codeRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [verifyState]);

  // Start the resend cooldown whenever a code goes out.
  useEffect(() => {
    if (!sentTo) return;
    const id = setTimeout(() => setCooldown(RESEND_COOLDOWN_SECONDS), 0);
    return () => clearTimeout(id);
  }, [sentTo]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function handleResend() {
    if (!sentTo || cooldown > 0) return;
    startResend(async () => {
      const result = await resendLoginCode(sentTo);
      if (result.success) {
        toast("Fresh code sent.");
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        toast.error(result.error ?? "Couldn't resend. Try again in a minute.");
      }
    });
  }

  const contextLine = next
    ? next.startsWith("/games")
      ? "Log in to book your spot."
      : "Log in to pick up where you left off."
    : null;

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 animate-in fade-in duration-300">
      <Card className="w-full max-w-[400px] [--card-spacing:--spacing(6)]">
        <CardContent className="flex flex-col items-center gap-6 py-4 text-center">
          {sentTo ? (
            <>
              <Mail className="size-16 text-muted-foreground" aria-hidden />
              <div className="flex flex-col gap-1">
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                  Check your email
                </h1>
                <p className="text-base text-muted-foreground">
                  We emailed a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{sentTo}</span>
                </p>
              </div>
              <form
                action={verifyAction}
                className="flex w-full flex-col gap-3"
              >
                <input type="hidden" name="email" value={sentTo} />
                <input type="hidden" name="next" value={next ?? ""} />
                <Label htmlFor="token" className="sr-only">
                  6-digit code
                </Label>
                <Input
                  ref={codeRef}
                  id="token"
                  name="token"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  autoFocus
                  placeholder="000000"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  disabled={verifyPending}
                  className="h-16 text-center font-heading text-3xl font-bold tracking-[0.5em] tabular-nums placeholder:text-muted-foreground/40"
                />
                <Button
                  type="submit"
                  disabled={verifyPending || code.length < 6}
                  className="h-14 w-full text-base font-semibold active:scale-95 transition-all"
                >
                  {verifyPending ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden />
                      Checking…
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>
              </form>
              <div className="flex w-full items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className="text-muted-foreground underline-offset-4 hover:underline disabled:no-underline disabled:opacity-60 active:scale-95 transition-all tabular-nums"
                >
                  {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDismissedState(sendState);
                    setCode("");
                  }}
                  className="text-muted-foreground underline-offset-4 hover:underline active:scale-95 transition-all"
                >
                  Use a different email
                </button>
              </div>
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
              <form action={sendAction} className="flex w-full flex-col gap-3">
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
                  disabled={sendPending}
                  defaultValue={
                    sendState.email ?? dismissedState?.sentTo ?? undefined
                  }
                  className="h-14 text-base"
                />
                <Button
                  type="submit"
                  disabled={sendPending}
                  className="h-14 w-full text-base font-semibold active:scale-95 transition-all"
                >
                  {sendPending ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden />
                      Sending code…
                    </>
                  ) : (
                    "Email me a code"
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
