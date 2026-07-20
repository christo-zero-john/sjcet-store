"use client";

import { useState } from "react";

type AuthFormProps = Readonly<{
  error?: string;
  message?: string;
  next?: string;
  signInAction?: (formData: FormData) => void | Promise<void>;
  signUpAction?: (formData: FormData) => void | Promise<void>;
}>;

export function AuthForm({
  error,
  message,
  next,
  signInAction,
  signUpAction,
}: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const isLogin = mode === "login";

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-tabs" role="tablist" aria-label="Authentication">
        <button
          className={isLogin ? "auth-tab is-active" : "auth-tab"}
          type="button"
          role="tab"
          aria-selected={isLogin}
          onClick={() => setMode("login")}
        >
          Log in
        </button>
        <button
          className={!isLogin ? "auth-tab is-active" : "auth-tab"}
          type="button"
          role="tab"
          aria-selected={!isLogin}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
      </div>

      <div className="auth-heading">
        <p className="eyebrow">SJCET Store</p>
        <h1 id="auth-title">{isLogin ? "Welcome back" : "Create account"}</h1>
        <p>
          {isLogin
            ? "Sign in to continue to your store workspace."
            : "Use your college email address to join the shared platform."}
        </p>
      </div>

      {error ? <p className="notice is-error">{error}</p> : null}
      {message ? <p className="notice is-success">{message}</p> : null}

      <form action={isLogin ? signInAction : signUpAction} className="auth-form">
        {next ? <input name="next" type="hidden" value={next} /> : null}
        {!isLogin ? (
          <label>
            Full name
            <input
              autoComplete="name"
              name="displayName"
              placeholder="Your name"
              required
            />
          </label>
        ) : null}

        <label>
          College email
          <input
            autoComplete="email"
            inputMode="email"
            name="email"
            placeholder="name@department.sjcetpalai.ac.in"
            required
            type="email"
          />
        </label>

        <label>
          Password
          <input
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>

        <button className="primary-button" type="submit">
          {isLogin ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="auth-note">
        Accounts are restricted to verified SJCET college subdomains.
      </p>
    </section>
  );
}
