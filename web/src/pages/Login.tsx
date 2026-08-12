import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  AuthErrorCodes,
} from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

function friendlyError(code: string): string {
  switch (code) {
    case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
    case AuthErrorCodes.INVALID_PASSWORD:
    case AuthErrorCodes.USER_DELETED:
      return "Incorrect email or password.";
    case AuthErrorCodes.USER_DISABLED:
      return "This account has been disabled. Contact your administrator.";
    case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email above first, then click “Forgot password”.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice("If that account exists, a password reset email has been sent.");
    } catch {
      setNotice("If that account exists, a password reset email has been sent.");
    }
  };

  return (
    <div className="page-center">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Commercial MGA Quoting</h1>
        <p className="subtitle">Florida Coastal Insurance Agency — internal use only</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="error-text">{error}</div>}
        {notice && <div className="notice-text">{notice}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <button type="button" className="link-button" onClick={handleForgotPassword}>
          Forgot password?
        </button>

        <p className="fine-print">
          Accounts are created by your administrator. Contact them if you need access.
        </p>
      </form>
    </div>
  );
}
