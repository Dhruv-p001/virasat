"use client";

import { EmailSchema, PhoneSchema, type Language } from "@virasat/core";
import type { AuthError } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useRef, useState } from "react";
import { Button, Field, Notice, TextInput } from "@/components/ui.tsx";
import type { OAuthProvider } from "@/lib/env.ts";
import { useT } from "@/lib/i18n/client.tsx";
import { getBrowserClient } from "@/lib/supabase/browser.ts";

type Method = "email" | "phone";
type ErrorKey =
  | "signIn.linkExpired"
  | "signIn.codeInvalid"
  | "signIn.sendFailed"
  | "signIn.smsFailed"
  | "signIn.tooMany"
  | "errors.email"
  | "errors.phone";

export function SignInForm({
  next,
  locale,
  siteUrl,
  oauthProviders,
  initialError,
}: {
  next: string;
  locale: Language;
  siteUrl: string;
  oauthProviders: OAuthProvider[];
  initialError: ErrorKey | null;
}) {
  const t = useT();
  const router = useRouter();
  const supabase = getBrowserClient();

  const [method, setMethod] = useState<Method>("email");
  const [address, setAddress] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(initialError);
  // A second tap before React re-renders would send a second code and silently expire the first.
  const inFlight = useRef(false);

  const sendErrorKey = (err: AuthError): ErrorKey => {
    if (err.status === 429) return "signIn.tooMany";
    // The SMS provider refused or couldn't deliver: point people to email rather than a dead end.
    if (err.code === "sms_send_failed") return "signIn.smsFailed";
    return "signIn.sendFailed";
  };

  async function sendCode(event?: SubmitEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (inFlight.current) return;
    setError(null);
    const parsed = (method === "email" ? EmailSchema : PhoneSchema).safeParse(sentTo ?? address);
    if (!parsed.success) {
      setError(method === "email" ? "errors.email" : "errors.phone");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    const options = { shouldCreateUser: true, data: { preferred_language: locale } };
    const { error: sendError } =
      method === "email"
        ? await supabase.auth.signInWithOtp({
            email: parsed.data,
            options: {
              ...options,
              // The email template appends &token_hash=…&type=email to this URL.
              emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
            },
          })
        : await supabase.auth.signInWithOtp({ phone: parsed.data, options });
    inFlight.current = false;
    setBusy(false);
    if (sendError) {
      setError(sendErrorKey(sendError));
      return;
    }
    setSentTo(parsed.data);
    setCode("");
  }

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentTo || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setBusy(true);
    const token = code.replace(/\s/g, "");
    const { error: verifyError } =
      method === "email"
        ? await supabase.auth.verifyOtp({ email: sentTo, token, type: "email" })
        : await supabase.auth.verifyOtp({ phone: sentTo, token, type: "sms" });
    if (verifyError) {
      inFlight.current = false;
      setBusy(false);
      setError(verifyError.status === 429 ? "signIn.tooMany" : "signIn.codeInvalid");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function oauth(provider: OAuthProvider) {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) setError("signIn.sendFailed");
  }

  if (sentTo) {
    return (
      <form onSubmit={(event) => void verify(event)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl">
            {t(method === "email" ? "signIn.checkEmail" : "signIn.checkPhone")}
          </h2>
          <p className="text-muted">
            {method === "email"
              ? t("signIn.checkEmailBody", { email: sentTo })
              : t("signIn.checkPhoneBody", { phone: sentTo })}
          </p>
        </div>
        {error && <Notice kind="error">{t(error)}</Notice>}
        <LocalDevNote method={method} />
        <Field label={t("signIn.codeLabel")}>
          <TextInput
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
            className="min-h-elder-tap-target w-full rounded-md border-2 border-outline bg-surface px-3 text-center font-mono text-2xl tracking-[0.4em]"
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? t("common.saving") : t("signIn.verify")}
        </Button>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Button kind="quiet" onClick={() => void sendCode()} disabled={busy}>
            {t("signIn.resend")}
          </Button>
          <Button
            kind="quiet"
            onClick={() => {
              setSentTo(null);
              setError(null);
            }}
          >
            {t("signIn.startOver")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" className="grid grid-cols-2 rounded-full bg-sunken p-1">
        {(["email", "phone"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={method === option}
            onClick={() => {
              setMethod(option);
              setAddress("");
              setError(null);
            }}
            className={`min-h-tap-target rounded-full font-semibold ${
              method === option ? "bg-surface text-ink shadow-album" : "text-muted"
            }`}
          >
            {t(option === "email" ? "signIn.emailTab" : "signIn.phoneTab")}
          </button>
        ))}
      </div>

      <form onSubmit={(event) => void sendCode(event)} className="flex flex-col gap-5" noValidate>
        {error && <Notice kind="error">{t(error)}</Notice>}
        {method === "email" ? (
          <Field label={t("signIn.emailLabel")}>
            <TextInput
              name="email"
              type="email"
              autoComplete="email"
              required
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
              }}
            />
          </Field>
        ) : (
          <Field label={t("signIn.phoneLabel")} hint={t("signIn.phoneHint")}>
            <TextInput
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              required
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
              }}
            />
          </Field>
        )}
        <LocalDevNote method={method} />
        <Button type="submit" disabled={busy}>
          {busy ? t("common.saving") : t("signIn.sendCode")}
        </Button>
      </form>

      {oauthProviders.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-border" />
            {t("signIn.or")}
            <span className="h-px flex-1 bg-border" />
          </p>
          {oauthProviders.includes("google") && (
            <Button kind="secondary" onClick={() => void oauth("google")}>
              {t("signIn.continueWithGoogle")}
            </Button>
          )}
          {oauthProviders.includes("apple") && (
            <Button kind="secondary" onClick={() => void oauth("apple")}>
              {t("signIn.continueWithApple")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Development only, so not translated: the local stack never delivers real email or SMS.
 * See supabase/config.toml ([auth.sms.test_otp]) and the local inbox (Mailpit).
 */
function LocalDevNote({ method }: { method: Method }) {
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <p className="rounded-md bg-sunken px-4 py-3 text-sm text-muted">
      {method === "email" ? (
        <>
          Local development doesn&apos;t send real email. Codes and links for every address arrive
          in the local inbox at{" "}
          <a href="http://127.0.0.1:54324" target="_blank" rel="noreferrer" className="underline">
            127.0.0.1:54324
          </a>
          .
        </>
      ) : (
        <>
          Local development has no SMS provider. Use +1 555 555 0100 or +1 555 555 0101, code
          123456.
        </>
      )}
    </p>
  );
}
