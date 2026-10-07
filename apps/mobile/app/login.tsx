import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@pms/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../src/components/Logo';
import { Notice } from '../src/components/Notice';
import { Button, TextField } from '../src/components/ui';
import { errorMessage } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { space } from '../src/lib/theme';
import { makeStyles, useTheme } from '../src/lib/theme-context';

export default function LoginScreen() {
  const styles = useStyles();
  const { text } = useTheme();
  const { login, sessionExpired } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // On success the root layout's protected routes switch to the signed-in area automatically.
  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Logo />
          <View style={{ marginTop: space.xxl, marginBottom: space.xl }}>
            <Text style={text.title} accessibilityRole="header">
              Sign in
            </Text>
            <Text style={[text.small, { marginTop: 4, fontSize: 15 }]}>Use the same account as the web app.</Text>
          </View>

          {sessionExpired && !serverError ? <Notice tone="info">Your session has expired. Please log in again.</Notice> : null}
          {serverError ? <Notice tone="error">{serverError}</Notice> : null}

          <View style={{ gap: space.lg }}>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <TextField
                  label="Email"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={formState.errors.email?.message}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <TextField
                  label="Password"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={formState.errors.password?.message}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                />
              )}
            />
            <Button label="Sign in" variant="primary" onPress={onSubmit} loading={formState.isSubmitting} style={{ marginTop: space.sm }} />
          </View>

          <Text style={[text.small, styles.footer]}>
            New here?{' '}
            <Link href="/register" replace style={styles.link}>
              Create an account
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  footer: { marginTop: space.xl, fontSize: 15, textAlign: 'center' },
  link: { color: colors.accent, fontWeight: '600' },
}));
