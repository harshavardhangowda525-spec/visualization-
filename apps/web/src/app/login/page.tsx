"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
export default function Login() {
  const [phone, setPhone] = useState(""),
    [register, setRegister] = useState(false),
    [challenge, setChallenge] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!challenge) {
        const r = await api("/auth/otp/request", {
          phone: "+91" + phone,
          register,
        });
        setChallenge(r.challengeId);
      } else {
        const r = await api("/auth/otp/verify", {
          challengeId: challenge,
          code,
        });
        if (r.needsLogin) {
          setChallenge("");
          setRegister(false);
          setCode("");
          setError("Phone verified. Request a login code to continue.");
          return;
        }
        const next =
          new URLSearchParams(window.location.search).get("next") ||
          "/dashboard";
        window.location.assign(
          next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="login-layout">
      <div className="login-photo">
        <Image
          src="/images/studio-hero.webp"
          alt="A warm professional studio space"
          fill
          sizes="50vw"
          priority
        />
        <h1>
          Your ideas.
          <br />
          <em>A place to belong.</em>
        </h1>
      </div>
      <div className="login-form">
        <span className="section-index">WELCOME TO THE HOUSE</span>
        <h2>{challenge ? "Check your phone." : "Make yourself at home."}</h2>
        <p>
          {challenge
            ? "Enter the six-digit verification code sent to your mobile."
            : "Sign in or create an account with your mobile number."}
        </p>
        <form onSubmit={submit}>
          <label>
            Mobile number
            <div className="phone-input">
              <span>+91</span>
              <input
                required
                type="tel"
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                value={phone}
                disabled={Boolean(challenge)}
                autoComplete="tel-national"
                placeholder="Your 10-digit number"
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </label>
          {!challenge ? (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={register}
                onChange={(e) => setRegister(e.target.checked)}
              />
              I’m new here — create my account
            </label>
          ) : (
            <label>
              Verification code
              <input
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
              />
            </label>
          )}
          <Button disabled={busy} type="submit">
            {busy
              ? "Please wait…"
              : challenge
                ? "Verify & continue"
                : "Send verification code"}
            <ArrowUpRight data-icon="inline-end" />
          </Button>
          {challenge ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setChallenge("");
                setCode("");
              }}
            >
              Use another number / request again
            </Button>
          ) : null}
          <p role="status" className={error ? "notice" : ""}>
            {error}
          </p>
        </form>
        <p className="fine-print">
          <ShieldCheck /> Your details stay private. By continuing, you agree to
          our <a href="/policies/terms">terms</a> and{" "}
          <a href="/policies/privacy">privacy policy</a>.
        </p>
      </div>
    </main>
  );
}
