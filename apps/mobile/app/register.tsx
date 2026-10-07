import { zodResolver } from '@hookform/resolvers/zod';
import { registerFormSchema, type RegisterFormValues } from '@pms/shared';
import { Link } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../src/components/Logo';
import { Notice } from '../src/components/Notice';
import { Button, TextField } from '../src/components/ui';
import { ApiError, errorMessage } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { space } from '../src/lib/theme';
import { makeStyles, useTheme } from '../src/lib/theme-context';

export default function RegisterScreen() {
  const styles = useStyles();
  const { text } = useTheme();
  const { register } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, formState, setError } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    setServerError(null);
    try {
      await register(values);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setError('email', { message: 'An account with this email already exists.' });
        return;
      }
      setServerError(errorMessage(error));
    }
  });

  const errors = formState.errors;
  const field = (name: keyof RegisterFormValues, label: string, props: Partial<ComponentProps<typeof TextField>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => (
        <TextField label={label} value={f.value} onChangeText={f.onChange} onBlur={f.onBlur} error={errors[name]?.message} {...props} />
      )}
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Logo />
          <View style={{ marginTop: space.xxl, marginBottom: space.xl }}>
            <Text style={text.title} accessibilityRole="header">
              Create your account
            </Text>
            <Text style={[text.small, { marginTop: 4, fontSize: 15 }]}>One account works here and on the web.</Text>
          </View>
          {serverError ? <Notice tone="error">{serverError}</Notice> : null}
          <View style={{ gap: space.lg }}>
            {field('fullName', 'Full name', { autoComplete: 'name', textContentType: 'name' })}
            {field('email', 'Email', { autoCapitalize: 'none', keyboardType: 'email-address', autoComplete: 'email' })}
            {field('password', 'Password', { secureTextEntry: true, autoComplete: 'new-password', hint: 'At least 8 characters, with a letter and a number.' })}
            {field('confirmPassword', 'Confirm password', { secureTextEntry: true, autoComplete: 'new-password' })}
            <Button label="Create account" variant="primary" onPress={onSubmit} loading={formState.isSubmitting} style={{ marginTop: space.sm }} />
          </View>
          <Text style={[text.small, styles.footer]}>
            Already have an account?{' '}
            <Link href="/login" replace style={styles.link}>
              Sign in
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
