import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, registerFormSchema, type LoginInput, type RegisterFormValues } from '@pms/shared';
import { AlertCircle, Clock } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { ApiError, errorMessage } from '../lib/api';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 mb-6 text-base text-muted">{subtitle}</p>
        {children}
        <p className="mt-6 text-base text-muted">{footer}</p>
      </div>
    </div>
  );
}

function FormAlert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) {
  return (
    <div
      role="alert"
      className={
        tone === 'error'
          ? 'mb-4 flex gap-2 rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger'
          : 'mb-4 flex gap-2 rounded-md border border-progress/20 bg-progress-soft px-3 py-2.5 text-sm text-progress'
      }
    >
      {tone === 'error' ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

export function LoginPage() {
  const { login, sessionExpired } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      // On success RedirectIfAuthenticated sends the user back to where they were going.
      await login(values);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to see your projects and tasks."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {sessionExpired && !serverError ? <FormAlert tone="info">Your session has expired. Please log in again.</FormAlert> : null}
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Email" error={formState.errors.email?.message}>
          {(a11y) => <Input type="email" autoComplete="email" autoFocus {...a11y} {...register('email')} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(a11y) => <Input type="password" autoComplete="current-password" {...a11y} {...register('password')} />}
        </Field>
        <Button type="submit" variant="primary" loading={formState.isSubmitting} className="mt-1 w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState, setError } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    setServerError(null);
    try {
      await registerAccount(values);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setError('email', { message: 'An account with this email already exists. Sign in instead?' });
        return;
      }
      setServerError(errorMessage(error));
    }
  });

  const errors = formState.errors;
  return (
    <AuthShell
      title="Create your account"
      subtitle="One account works on the web and in the Android app."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Full name" error={errors.fullName?.message}>
          {(a11y) => <Input autoComplete="name" autoFocus {...a11y} {...register('fullName')} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(a11y) => <Input type="email" autoComplete="email" {...a11y} {...register('email')} />}
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters, with a letter and a number.">
          {(a11y) => <Input type="password" autoComplete="new-password" {...a11y} {...register('password')} />}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          {(a11y) => <Input type="password" autoComplete="new-password" {...a11y} {...register('confirmPassword')} />}
        </Field>
        <Button type="submit" variant="primary" loading={formState.isSubmitting} className="mt-1 w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
