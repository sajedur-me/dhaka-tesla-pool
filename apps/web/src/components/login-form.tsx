"use client";

import {
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ApiError,
  login,
  type UserRole,
} from "../lib/api";
import { saveAuthSession } from "../lib/auth";

type LoginRole = "passenger" | "driver";

type DemoAccount = {
  role: LoginRole;
  label: string;
  name: string;
  email: string;
  description: string;
};

const DEMO_PASSWORD = "DhakaPool123!";

const demoAccounts: Record<LoginRole, DemoAccount> = {
  passenger: {
    role: "passenger",
    label: "Passenger",
    name: "Nusrat",
    email: "nusrat@dhakapool.local",
    description: "Request a seat, see your fare, and follow your ride.",
  },
  driver: {
    role: "driver",
    label: "Driver",
    name: "Jashim",
    email: "jashim@dhakapool.local",
    description: "Take Bullet online, accept requests, and manage the trip.",
  },
};

function roleToPath(role: UserRole): string {
  return role === "DRIVER" ? "/driver" : "/passenger";
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="5"
        width="17"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m5 7 7 5 7-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 10h12M11 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialRole: LoginRole =
    searchParams.get("role") === "driver"
      ? "driver"
      : "passenger";

  const [selectedRole, setSelectedRole] =
    useState<LoginRole>(initialRole);

  const [email, setEmail] = useState(
    demoAccounts[initialRole].email,
  );

  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function selectRole(role: LoginRole) {
    setSelectedRole(role);
    setEmail(demoAccounts[role].email);
    setPassword(DEMO_PASSWORD);
    setError("");

    const nextUrl =
      role === "driver"
        ? "/login?role=driver"
        : "/login?role=passenger";

    router.replace(nextUrl, {
      scroll: false,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const session = await login(email, password);

      saveAuthSession(session);

      router.push(roleToPath(session.user.role));
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeAccount = demoAccounts[selectedRole];

  return (
    <div className="login-card">
      <div className="login-card-heading">
        <p className="login-kicker">Welcome back</p>

        <h1>Sign in to your ride.</h1>

        <p>
          Choose a role, then use the prepared demo account or
          enter your own credentials.
        </p>
      </div>

      <div
        className="role-switcher"
        aria-label="Choose account type"
      >
        {(["passenger", "driver"] as const).map((role) => {
          const account = demoAccounts[role];
          const isActive = selectedRole === role;

          return (
            <button
              key={role}
              type="button"
              className={`role-option ${
                isActive ? "role-option-active" : ""
              }`}
              aria-pressed={isActive}
              onClick={() => selectRole(role)}
            >
              <span>{account.label}</span>

              <small>
                {role === "passenger"
                  ? "Find a ride"
                  : "Drive Bullet"}
              </small>
            </button>
          );
        })}
      </div>

      <div className="demo-account">
        <div className="demo-avatar" aria-hidden="true">
          {activeAccount.name.charAt(0)}
        </div>

        <div>
          <span>Demo account</span>
          <strong>{activeAccount.name}</strong>
          <p>{activeAccount.description}</p>
        </div>
      </div>

      <form
        className="login-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <label className="form-field">
          <span>Email address</span>

          <div className="input-shell">
            <MailIcon />

            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              disabled={isSubmitting}
            />
          </div>
        </label>

        <label className="form-field">
          <span>Password</span>

          <div className="input-shell">
            <LockIcon />

            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              disabled={isSubmitting}
            />
          </div>
        </label>

        {error ? (
          <div className="login-error" role="alert">
            <span aria-hidden="true">!</span>
            <p>{error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          className="login-submit"
          disabled={isSubmitting}
        >
          <span>
            {isSubmitting
              ? "Signing in..."
              : `Continue as ${activeAccount.label}`}
          </span>

          {!isSubmitting ? <ArrowIcon /> : null}
        </button>
      </form>

      <p className="login-security-note">
        Your role and access are verified by the server after
        sign-in.
      </p>
    </div>
  );
}
