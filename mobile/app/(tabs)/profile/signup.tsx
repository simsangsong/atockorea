/**
 * Sign up flow – same logic as web (app/signup/page.tsx):
 * 1. Email → send verification code (POST /api/auth/send-verification-code)
 * 2. Enter code → verify (POST /api/auth/verify-code)
 * 3. Full name, birth year, nationality, phone, password → signUp + create-profile
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/googleAuth';
import { BASE_URL } from '@/api/client';

const CURRENT_YEAR = new Date().getFullYear();

function validatePassword(pwd: string): { valid: boolean; message?: string } {
  if (pwd.length < 8) return { valid: false, message: 'Password must be at least 8 characters.' };
  if (!/[a-zA-Z]/.test(pwd)) return { valid: false, message: 'Password must include at least one letter.' };
  if (!/[0-9]/.test(pwd)) return { valid: false, message: 'Password must include at least one number.' };
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd)) return { valid: false, message: 'Password must include at least one special character.' };
  return { valid: true };
}

async function apiPost(path: string, body: object) {
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

type Step = 'email' | 'verify' | 'info';

export default function SignUpScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [nationality, setNationality] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSigningUp, setGoogleSigningUp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const sendCode = async () => {
    if (!email.trim()) {
      setFieldError('Please enter your email.');
      return;
    }
    setError(null);
    setFieldError(null);
    setSendingCode(true);
    try {
      await apiPost('/api/auth/send-verification-code', { email: email.trim() });
      setCountdown(60);
      setStep('verify');
    } catch (e) {
      setFieldError(e instanceof Error ? e.message : 'Failed to send code.');
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      setFieldError('Please enter the verification code.');
      return;
    }
    setError(null);
    setFieldError(null);
    setVerifying(true);
    try {
      await apiPost('/api/auth/verify-code', { email: email.trim(), code: code.trim() });
      setStep('info');
    } catch (e) {
      setFieldError(e instanceof Error ? e.message : 'Invalid or expired code.');
    } finally {
      setVerifying(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleSigningUp(true);
    setError(null);
    setFieldError(null);
    const result = await signInWithGoogle();
    setGoogleSigningUp(false);
    if (result.ok) {
      router.replace('/(tabs)/profile');
    } else {
      setError(result.error);
    }
  };

  const submitSignUp = async () => {
    setError(null);
    setFieldError(null);

    if (!fullName.trim()) {
      setFieldError('Full name is required.');
      return;
    }
    const birthNum = parseInt(birthYear, 10);
    if (!birthYear || isNaN(birthNum) || birthNum < 1900 || birthNum > CURRENT_YEAR) {
      setFieldError(`Enter a valid birth year (1900–${CURRENT_YEAR}).`);
      return;
    }
    if (!nationality.trim()) {
      setFieldError('Nationality is required.');
      return;
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      setFieldError(pwdCheck.message!);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError('Passwords do not match.');
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    if (!supabase) {
      setError('Auth not configured.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            birth_year: birthNum,
            nationality: nationality.trim(),
            phone: phone.trim() || null,
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message || '';
        if (/already registered|already exists|already been registered/i.test(msg)) {
          setError('This email is already registered. Try signing in or use another email.');
        } else {
          setError(msg);
        }
        setSubmitting(false);
        return;
      }

      if (!data?.user) {
        setError('Sign up did not return a user. Please try again.');
        setSubmitting(false);
        return;
      }

      const session = data.session ?? (await supabase.auth.getSession()).data?.session;
      const accessToken = session?.access_token;

      let profileRes = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/auth/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user.id,
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
          birth_year: birthNum,
          nationality: nationality.trim(),
          accessToken: accessToken ?? undefined,
        }),
      });
      let profileData = await profileRes.json().catch(() => ({}));

      if (!profileRes.ok && profileRes.status === 404) {
        await new Promise((r) => setTimeout(r, 2000));
        profileRes = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/auth/create-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            birth_year: birthNum,
            nationality: nationality.trim(),
            accessToken: accessToken ?? undefined,
          }),
        });
        profileData = await profileRes.json().catch(() => ({}));
      }

      if (!profileRes.ok) {
        if (profileRes.status === 409) {
          setError('This account already exists. Please sign in.');
          setSubmitting(false);
          return;
        }
        try {
          await fetch(`${BASE_URL.replace(/\/$/, '')}/api/auth/delete-user-without-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id, accessToken: accessToken ?? undefined }),
          });
        } catch (_) {}
        setError(profileData.error || 'Failed to create profile. Please try again.');
        setSubmitting(false);
        return;
      }

      Alert.alert('Account created', 'You can now sign in with your email and password.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = [styles.input, fieldError ? styles.inputError : null];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Create your account in the app.</Text>

        <Pressable
          style={[styles.googleBtn, googleSigningUp && styles.btnDisabled]}
          onPress={handleGoogleSignUp}
          disabled={googleSigningUp}
        >
          {googleSigningUp ? (
            <ActivityIndicator color={theme.colors.text} size="small" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </Pressable>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign up with email</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.steps}>
          {(['email', 'verify', 'info'] as Step[]).map((s, i) => (
            <View key={s} style={styles.stepDot}>
              <View style={[styles.dot, (step === s || (step === 'info' && s === 'verify')) && styles.dotActive]} />
              {i < 2 && <View style={styles.stepLine} />}
            </View>
          ))}
        </View>

        {(error || fieldError) && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error || fieldError}</Text>
          </View>
        )}

        {step === 'email' && (
          <View style={styles.section}>
            <Text style={styles.label}>Email (Login ID) *</Text>
            <TextInput
              style={inputStyle}
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Pressable style={[styles.primaryBtn, (!email.trim() || sendingCode) && styles.btnDisabled]} onPress={sendCode} disabled={sendingCode || countdown > 0}>
              {sendingCode ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>{countdown > 0 ? `Resend in ${countdown}s` : 'Send verification code'}</Text>}
            </Pressable>
          </View>
        )}

        {step === 'verify' && (
          <View style={styles.section}>
            <Text style={styles.label}>Verification code *</Text>
            <TextInput
              style={inputStyle}
              placeholder="000000"
              placeholderTextColor={theme.colors.textMuted}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>Sent to {email}</Text>
            <View style={styles.row}>
              <Pressable style={styles.secondaryBtn} onPress={() => setStep('email')}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.flex1, (!code.trim() || verifying) && styles.btnDisabled]} onPress={verifyCode} disabled={verifying}>
                {verifying ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Verify</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {step === 'info' && (
          <View style={styles.section}>
            <Text style={styles.label}>Full name *</Text>
            <TextInput style={inputStyle} placeholder="Your name" placeholderTextColor={theme.colors.textMuted} value={fullName} onChangeText={setFullName} />
            <Text style={styles.label}>Birth year * (1900–{CURRENT_YEAR})</Text>
            <TextInput style={inputStyle} placeholder="e.g. 1990" placeholderTextColor={theme.colors.textMuted} value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" maxLength={4} />
            <Text style={styles.label}>Nationality *</Text>
            <TextInput style={inputStyle} placeholder="e.g. South Korea" placeholderTextColor={theme.colors.textMuted} value={nationality} onChangeText={setNationality} />
            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput style={inputStyle} placeholder="+82 10 1234 5678" placeholderTextColor={theme.colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Text style={styles.label}>Password * (8+ chars, letter, number, special)</Text>
            <TextInput style={inputStyle} placeholder="Password" placeholderTextColor={theme.colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput style={inputStyle} placeholder="Confirm password" placeholderTextColor={theme.colors.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            <Pressable style={styles.checkRow} onPress={() => setAgreedToTerms(!agreedToTerms)}>
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]} />
              <Text style={styles.checkLabel}>I agree to the Terms of Service and Privacy Policy</Text>
            </Pressable>
            <View style={styles.row}>
              <Pressable style={styles.secondaryBtn} onPress={() => setStep('verify')}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.flex1, submitting && styles.btnDisabled]} onPress={submitSignUp} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Create account</Text>}
              </Pressable>
            </View>
          </View>
        )}

        <Pressable style={styles.signInLink} onPress={() => router.back()}>
          <Text style={styles.signInLinkText}>Already have an account? Sign in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  back: { alignSelf: 'flex-start', marginBottom: 12 },
  backText: { fontSize: 16, color: theme.colors.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '500', color: theme.colors.text },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4, marginBottom: 16 },
  steps: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stepDot: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.border },
  dotActive: { backgroundColor: theme.colors.primary },
  stepLine: { width: 24, height: 2, backgroundColor: theme.colors.border, marginHorizontal: 4 },
  errorBox: { backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  errorText: { fontSize: 14, color: '#dc2626' },
  section: { marginTop: 8 },
  label: { fontSize: 13, fontWeight: '500', color: theme.colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 12,
  },
  inputError: { borderColor: '#dc2626' },
  hint: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 12 },
  primaryBtn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '500', fontSize: 15 },
  secondaryBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, marginRight: 10 },
  secondaryBtnText: { color: theme.colors.text, fontWeight: '500', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border, marginRight: 10 },
  checkboxChecked: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkLabel: { flex: 1, fontSize: 14, color: theme.colors.text },
  signInLink: { marginTop: 16, alignItems: 'center' },
  signInLinkText: { fontSize: 14, color: theme.colors.primary, fontWeight: '500' },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { color: theme.colors.text, fontWeight: '500', fontSize: 15 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { marginHorizontal: 10, fontSize: 13, color: theme.colors.textMuted },
});
