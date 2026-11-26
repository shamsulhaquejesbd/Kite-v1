import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { isSupabaseConfigured, supabaseAdmin } from './supabase.ts';

const SESSION_SECRET =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

interface ClaimedCredential {
  email: string;
  salt: string;
  hash: string;
}

// In-memory claimed first-run credential when ADMIN_PASSCODE env is unset
let claimedAdminCredential: ClaimedCredential | null = null;

export interface AuthenticatedAdmin {
  email: string;
  name: string;
  role: string;
  authMode: 'supabase' | 'passcode';
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AuthenticatedAdmin;
    }
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function timingSafeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function issueSessionToken(admin: AuthenticatedAdmin): string {
  const payload = {
    email: admin.email,
    name: admin.name,
    role: admin.role,
    authMode: admin.authMode,
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): AuthenticatedAdmin | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  if (!timingSafeMatch(sig, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return {
      email: payload.email,
      name: payload.name,
      role: payload.role,
      authMode: payload.authMode,
    };
  } catch {
    return null;
  }
}

export function getAuthStatus() {
  const envPasscodeSet = Boolean(process.env.ADMIN_PASSCODE?.trim());
  const needsSetup = !envPasscodeSet && !claimedAdminCredential;
  return {
    supabaseConfigured: isSupabaseConfigured,
    envPasscodeSet,
    needsSetup,
    claimedEmail: claimedAdminCredential?.email || null,
  };
}

export function claimFirstAdmin(email: string, password: string): { ok: boolean; error?: string; token?: string; admin?: AuthenticatedAdmin } {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (envPasscode) {
    return { ok: false, error: 'Admin passcode is already configured via environment secrets.' };
  }
  if (claimedAdminCredential) {
    return { ok: false, error: 'Admin account has already been claimed. Please sign in.' };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, error: 'Please enter a valid admin email address.' };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters long.' };
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  claimedAdminCredential = { email: cleanEmail, salt, hash };

  const admin: AuthenticatedAdmin = {
    email: cleanEmail,
    name: 'THE KITE Admin',
    role: 'super_admin',
    authMode: 'passcode',
  };
  return { ok: true, token: issueSessionToken(admin), admin };
}

export function loginWithPasscode(email: string, password: string): { ok: boolean; error?: string; token?: string; admin?: AuthenticatedAdmin } {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (envPasscode) {
    if (!password || !timingSafeMatch(password, envPasscode)) {
      return { ok: false, error: 'Invalid admin passcode.' };
    }
    const admin: AuthenticatedAdmin = {
      email: (email || 'admin@thekitecoffee.com').trim().toLowerCase(),
      name: 'THE KITE Admin',
      role: 'super_admin',
      authMode: 'passcode',
    };
    return { ok: true, token: issueSessionToken(admin), admin };
  }

  if (!claimedAdminCredential) {
    return { ok: false, error: 'No admin account claimed yet. Complete first-run setup first.' };
  }

  const candidateHash = hashPassword(password || '', claimedAdminCredential.salt);
  const emailMatches =
    !email.trim() || email.trim().toLowerCase() === claimedAdminCredential.email;

  if (!emailMatches || !timingSafeMatch(candidateHash, claimedAdminCredential.hash)) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  const admin: AuthenticatedAdmin = {
    email: claimedAdminCredential.email,
    name: 'THE KITE Admin',
    role: 'super_admin',
    authMode: 'passcode',
  };
  return { ok: true, token: issueSessionToken(admin), admin };
}

export async function verifySupabaseAdminToken(
  accessToken: string
): Promise<AuthenticatedAdmin | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data?.user) return null;

    const { data: adminRows } = await supabaseAdmin
      .from('admin_users')
      .select('email, full_name, role, is_active')
      .or(`user_id.eq.${data.user.id},email.eq.${data.user.email}`)
      .eq('is_active', true)
      .limit(1);

    if (!adminRows || adminRows.length === 0) {
      // Check if admin_users is completely empty; if so, bootstrap this authenticated user as first super_admin
      const { count } = await supabaseAdmin
        .from('admin_users')
        .select('id', { count: 'exact', head: true });

      if (count === 0 && data.user.email) {
        await supabaseAdmin.from('admin_users').insert({
          user_id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || 'THE KITE Super Admin',
          role: 'super_admin',
          is_active: true,
        });
        return {
          email: data.user.email,
          name: data.user.user_metadata?.full_name || 'THE KITE Super Admin',
          role: 'super_admin',
          authMode: 'supabase',
        };
      }
      return null;
    }

    const row = adminRows[0];
    return {
      email: row.email,
      name: row.full_name,
      role: row.role,
      authMode: 'supabase',
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Invalid authorization token' });
    return;
  }

  // First check server-issued HMAC session token
  const sessionAdmin = verifySessionToken(token);
  if (sessionAdmin) {
    req.adminUser = sessionAdmin;
    next();
    return;
  }

  // Next check Supabase Auth JWT + admin_users RBAC
  if (isSupabaseConfigured) {
    const sbAdmin = await verifySupabaseAdminToken(token);
    if (sbAdmin) {
      req.adminUser = sbAdmin;
      next();
      return;
    }
  }

  res.status(403).json({ error: 'Unauthorized: Administrator access required' });
}
