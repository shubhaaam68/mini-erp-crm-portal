import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert, Field } from "../components/ui";
import { useAuth } from "../lib/auth";

const DEMO = [
  ["Admin", "admin@erpdemo.com"],
  ["Sales", "sales@erpdemo.com"],
  ["Warehouse", "warehouse@erpdemo.com"],
  ["Accounts", "accounts@erpdemo.com"],
];

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@erpdemo.com");
  const [password, setPassword] = useState("Password@123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Wholesale ERP + CRM</h1>
        <p className="sub">Sign in to the operations portal</p>
        <Alert kind="error">{error}</Alert>
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </Field>
          <button className="btn" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
        </div>
        <div className="demo-logins">
          Demo accounts (password <strong>Password@123</strong>):
          <div style={{ display: "grid", gap: 2, marginTop: 6 }}>
            {DEMO.map(([role, mail]) => (
              <button type="button" key={mail} onClick={() => { setEmail(mail); setPassword("Password@123"); }}>
                {role} — {mail}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
