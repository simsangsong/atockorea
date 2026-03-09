/**
 * Profile – same data as web. Reads from Supabase (user_profiles via AuthContext,
 * bookings via GET /api/bookings). Edit profile via PATCH /api/auth/update-profile.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/googleAuth';

function getInitials(name: string | null): string {
  if (!name || !name.trim()) return '?';
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfileDashboardScreen() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  const displayName =
    profile?.full_name?.trim() ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Guest';
  const userEmail = user?.email ?? '';

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Enter your email.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Enter your password.');
      return;
    }
    if (!supabase) {
      Alert.alert('Error', 'Auth not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    setSigningIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (data?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        if (!profile || profileError) {
          const meta = data.user.user_metadata || {};
          const displayName =
            meta.name ||
            meta.full_name ||
            [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim() ||
            data.user.email?.split('@')[0] ||
            'User';
          await supabase.from('user_profiles').insert({
            id: data.user.id,
            full_name: displayName,
            role: 'customer',
          });
        }
      }
    } catch (e: unknown) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Please check your email and password.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSigningIn(true);
    const result = await signInWithGoogle();
    setGoogleSigningIn(false);
    if (!result.ok) {
      Alert.alert('Google sign-in', result.error);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>Use your email and password to sign in.</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Pressable style={[styles.primaryBtn, signingIn && styles.btnDisabled]} onPress={handleSignIn} disabled={signingIn}>
              {signingIn ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Sign in</Text>}
            </Pressable>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <Pressable
              style={[styles.googleBtn, googleSigningIn && styles.btnDisabled]}
              onPress={handleGoogleSignIn}
              disabled={googleSigningIn}
            >
              {googleSigningIn ? (
                <ActivityIndicator color={theme.colors.text} size="small" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/(tabs)/profile/signup')}>
              <Text style={styles.secondaryBtnText}>Create account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>
        </View>
      </View>

      <View style={styles.menu}>
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/(tabs)/profile/bookings')}
        >
          <Text style={styles.menuIcon}>📋</Text>
          <Text style={styles.menuLabel}>My Bookings</Text>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/(tabs)/profile/settings')}
        >
          <Text style={styles.menuIcon}>⚙️</Text>
          <Text style={styles.menuLabel}>Settings</Text>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOutBtn, pressed && styles.menuItemPressed]}
        onPress={signOut}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: { fontSize: 18, fontWeight: '500', color: theme.colors.text },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 6,
    marginBottom: theme.spacing.md,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '500', fontSize: 15 },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryBtnText: { color: theme.colors.text, fontWeight: '500', fontSize: 15 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { marginHorizontal: 10, fontSize: 13, color: theme.colors.textMuted },
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
    marginBottom: 8,
  },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { color: theme.colors.text, fontWeight: '500', fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 8,
  },
  btnDisabled: { opacity: 0.7 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '500', color: theme.colors.text },
  userEmail: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  menu: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuItemPressed: { opacity: 0.8 },
  menuIcon: { fontSize: 18, marginRight: 10 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '400', color: theme.colors.text },
  menuArrow: { fontSize: 16, color: theme.colors.textMuted },
  signOutBtn: {
    padding: theme.spacing.sm + 4,
    alignItems: 'center',
  },
  signOutText: { fontSize: 15, color: '#dc2626', fontWeight: '500' },
});
