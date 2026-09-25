import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "../../components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Dhaka Tesla Pool as a passenger or driver.",
};

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      D
    </span>
  );
}

function BackIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 10H4m5-5-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoginFormFallback() {
  return (
    <div
      className="login-card login-card-loading"
      aria-label="Loading sign in form"
    >
      <div className="login-loading-line login-loading-short" />
      <div className="login-loading-line login-loading-title" />
      <div className="login-loading-line" />
      <div className="login-loading-panel" />
      <div className="login-loading-panel" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-orb login-orb-one" aria-hidden="true" />
      <div className="login-orb login-orb-two" aria-hidden="true" />

      <header className="login-header">
        <Link
          href="/"
          className="brand"
          aria-label="Dhaka Tesla Pool home"
        >
          <BrandMark />
          <span>Dhaka Tesla Pool</span>
        </Link>

        <Link href="/" className="login-back">
          <BackIcon />
          Back home
        </Link>
      </header>

      <div className="login-layout">
        <section className="login-story">
          <div className="login-story-copy">
            <p className="login-story-kicker">
              One Tesla · Three seats · Dhaka
            </p>

            <h2>
              One pool.
              <br />
              <span>Two ways in.</span>
            </h2>

            <p>
              Passengers request compatible trips. Jashim manages
              Bullet and moves the shared ride through each stage.
            </p>
          </div>

          <div className="login-route-preview">
            <div className="login-route-top">
              <div>
                <span>Tonight&apos;s pool</span>
                <strong>Banani</strong>
              </div>

              <span className="login-live-pill">
                <i />
                Demo ready
              </span>
            </div>

            <div className="login-route-path">
              <div className="login-route-node">
                <i />
                <div>
                  <span>Pickup</span>
                  <strong>Banani</strong>
                </div>
              </div>

              <div className="login-route-connector" />

              <div className="login-route-node">
                <i />
                <div>
                  <span>Shared stops</span>
                  <strong>Mohakhali · Gulshan 1</strong>
                </div>
              </div>
            </div>

            <div className="login-bullet-row">
              <div className="login-car" aria-hidden="true">
                <span />
                <i />
                <i />
              </div>

              <div>
                <span>Jashim&apos;s Tesla</span>
                <strong>Bullet</strong>
              </div>

              <p>3 seats</p>
            </div>
          </div>
        </section>

        <section className="login-form-column">
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
