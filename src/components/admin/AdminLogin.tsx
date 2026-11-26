import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { isBrowserSupabaseConfigured, supabaseBrowser } from '../../lib/supabaseClient.ts';
import { parseJsonResponse } from '../../lib/storefrontClient.ts';

interface AuthStatusResponse {
  supabaseConfigured: boolean;
  envPasscodeSet: boolean;
  needsSetup: boolean;
  claimedEmail: string | null;
  missingSupabaseVars: string[];
}

export interface AdminSession {
  token: string;
  admin: {
    email: string;
    name: string;
    role: string;
    authMode: 'supabase' | 'passcode';
  };
}

interface AdminLoginProps {
  onSuccess: (session: AdminSession) => void;
  onBackToStore: () => void;
}

export function AdminLogin({ onSuccess, onBackToStore }: AdminLoginProps) {
  const [status, setStatus] = useState<AuthStatusResponse | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((r) => parseJsonResponse<AuthStatusResponse>(r, 'Unable to check authentication status.'))
      .then((data) => {
        setStatus(data);
        if (data.claimedEmail) setEmail(data.claimedEmail);
      })
      .catch((err) => setError((err as Error).message || 'Unable to check authentication status.'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // First-run inline admin setup when ADMIN_PASSCODE is unset & no claimed admin yet
      if (status?.needsSetup && !isBrowserSupabaseConfigured) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        const res = await fetch('/api/admin/auth/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await parseJsonResponse<AdminSession>(res, 'Could not create admin account.');
        onSuccess({ token: data.token, admin: data.admin });
        return;
      }

      // If browser Supabase Auth is configured, attempt Supabase email/password sign-in first
      if (status?.supabaseConfigured && isBrowserSupabaseConfigured && supabaseBrowser) {
        const { data: sbData, error: sbErr } = await supabaseBrowser.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (!sbErr && sbData.session?.access_token) {
          const res = await fetch('/api/admin/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supabaseAccessToken: sbData.session.access_token }),
          });
          const data = await parseJsonResponse<AdminSession>(res, 'Admin access denied.');
          onSuccess({ token: data.token, admin: data.admin });
          return;
        }
      }

      // Passcode / claimed credential verification
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseJsonResponse<AdminSession>(res, 'Invalid credentials.');
      onSuccess({ token: data.token, admin: data.admin });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const isFirstRunClaim = Boolean(status?.needsSetup && !isBrowserSupabaseConfigured);

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="bg-[#141210] px-7 py-6 text-white">
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-1.5 text-xs text-[#BDB4A4] hover:text-white mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Storefront
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#4C8C3B] flex items-center justify-center">
              {isFirstRunClaim ? (
                <KeyRound className="w-5 h-5 text-white" />
              ) : (
                <Lock className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">
                {isFirstRunClaim ? 'Claim THE KITE Admin Access' : 'THE KITE Admin Console'}
              </h1>
              <p className="text-xs text-[#BDB4A4]">
                {isFirstRunClaim
                  ? 'First-run security setup — set your administrator password'
                  : 'Authorized personnel sign-in'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {isFirstRunClaim && (
            <div className="p-3.5 rounded-lg bg-[#EBF3E8] border border-[#C6DFBF] text-xs text-[#2F5D23] flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                No <code>ADMIN_PASSCODE</code> secret is set yet. Create the initial administrator credential below to lock this console.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Administrator Email
            </label>
            <input
              type="email"
              required={!status?.envPasscodeSet}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@thekitecoffee.com"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {status?.envPasscodeSet ? 'Admin Passcode' : 'Password (min 8 chars)'}
            </label>
            <input
              type="password"
              required
              minLength={status?.envPasscodeSet ? 1 : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
            />
          </div>

          {isFirstRunClaim && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !status}
            className="w-full py-3 px-4 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading
              ? 'Verifying...'
              : isFirstRunClaim
              ? 'Claim Admin & Enter Console'
              : 'Sign In to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
