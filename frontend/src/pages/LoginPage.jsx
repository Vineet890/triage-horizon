import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clock3,
  Database,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Plus,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import api, { getApiErrorMessage } from '../lib/api';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts';
import { buildPatientProfile } from '../lib/demoPatients';
import useTriageStore from '../store/useTriageStore';
import { cn } from '../lib/utils';
import RoutingConsole from '../components/marketing/RoutingConsole';
import { BrandLockup } from '../components/Brand';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS = [
  { value: 'PATIENT', label: 'Patient', icon: UserRound },
  { value: 'DOCTOR', label: 'Doctor', icon: Stethoscope },
  { value: 'ADMIN', label: 'Admin', icon: Users },
];

const SIGNUP_ROLE_OPTIONS = ROLE_OPTIONS.filter(
  (option) => option.value !== 'ADMIN'
);

const SPECIALTY_OPTIONS = [
  'Cardiology',
  'Emergency Medicine',
  'General Medicine',
  'Pulmonology',
  'Neurology',
  'Psychiatry',
  'Pediatrics',
  'Dermatology',
  'Orthopedics',
  'Other',
];

const ROLE_PATHS = {
  PATIENT: '/patient',
  DOCTOR: '/doctor',
  ADMIN: '/admin',
};

const EMPTY_SIGNUP = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'PATIENT',
  licenseNumber: '',
  specialty: '',
  yearsExperience: '',
};

const INPUT_CLASS =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all duration-200 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-400';

const INPUT_WITH_ICON_CLASS = `${INPUT_CLASS} pl-10`;

const INPUT_WITH_ACTION_CLASS = `${INPUT_WITH_ICON_CLASS} pr-11`;

const SELECT_CLASS = `${INPUT_CLASS} appearance-none pr-9`;

function Brand({ light = false }) {
  return <BrandLockup to="/" light={light} />;
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
    >
      {children}
    </label>
  );
}

function FieldError({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
      <span>{children}</span>
    </p>
  );
}

function SelectChevron() {
  return (
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
    />
  );
}

function PasswordInput({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  visible,
  onToggleVisible,
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative mt-1.5">
        <LockKeyhole
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={INPUT_WITH_ACTION_CLASS}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function RoleSelector({ label, value, options, onChange }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        role="group"
        aria-label={label}
        className={cn(
          'mt-1.5 grid gap-2',
          options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
        )}
      >
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-teal-500/10',
                isActive
                  ? 'border-teal-500 bg-teal-50/80 text-teal-700 shadow-xs dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-white'
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DemoAccess({ onFill }) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Demo Quick-Fill
        </p>
        <span className="font-mono text-[9px] uppercase tracking-wider text-teal-600 dark:text-teal-400">
          Instant Logins
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onFill(account)}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-left shadow-2xs transition-all duration-200 hover:border-teal-500/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-800/80 dark:hover:border-teal-500"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {account.label}
              </span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {account.role}
              </span>
            </div>
            <span className="mt-1 block truncate font-mono text-[10px] text-teal-600 dark:text-teal-400">
              {account.email}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const auth = useTriageStore((state) => state.auth);
  const setAuth = useTriageStore((state) => state.setAuth);
  const setCurrentPatient = useTriageStore((state) => state.setCurrentPatient);

  const requestedRole = (searchParams.get('role') ?? '').toUpperCase();
  const initialRole = ROLE_OPTIONS.some((option) => option.value === requestedRole)
    ? requestedRole
    : 'PATIENT';
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const prefilledEmail = searchParams.get('email') ?? '';

  const [mode, setMode] = useState(initialMode);

  const [loginEmail, setLoginEmail] = useState(prefilledEmail);
  const [loginPassword, setLoginPassword] = useState(prefilledEmail ? (prefilledEmail.startsWith('patient') || prefilledEmail.startsWith('ananya') ? 'patient123' : prefilledEmail.startsWith('doctor') ? 'doctor123' : 'admin123') : '');
  const [loginRole, setLoginRole] = useState(initialRole);
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [signup, setSignup] = useState({
    ...EMPTY_SIGNUP,
    role: initialRole === 'DOCTOR' ? 'DOCTOR' : 'PATIENT',
  });
  const [signupError, setSignupError] = useState('');
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  useEffect(() => {
    document.title = 'Sign in · Triage Horizon';

    return () => {
      document.title = 'Triage Horizon | Clinical Triage Network';
    };
  }, []);

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setLoginError('');
    setSignupError('');
  };

  const updateSignup = (field) => (event) => {
    const value = event.target.value;
    setSignup((previous) => ({ ...previous, [field]: value }));
  };

  const openPortal = (data) => {
    setAuth({
      token: data.token,
      role: data.role,
      userId: data.userId,
      name: data.name ?? '',
      email: data.email ?? '',
      specialty: data.specialty ?? null,
    });

    if (data.role === 'PATIENT') {
      setCurrentPatient(buildPatientProfile(data));
    }

    navigate(ROLE_PATHS[data.role] ?? '/', { replace: true });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loginSubmitting) return;

    setLoginError('');

    if (!EMAIL_PATTERN.test(loginEmail.trim())) {
      setLoginError('Enter a valid email address.');
      return;
    }

    if (!loginPassword) {
      setLoginError('Enter your password.');
      return;
    }

    setLoginSubmitting(true);

    try {
      const { data } = await api.post('/auth/login', {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      if (data.role !== loginRole) {
        const expected =
          ROLE_OPTIONS.find((option) => option.value === data.role)?.label ??
          data.role;
        setLoginError(
          `These credentials belong to the ${expected} portal. Select ${expected} and try again.`
        );
        return;
      }

      openPortal(data);
    } catch (requestError) {
      setLoginError(
        getApiErrorMessage(requestError, 'Unable to sign in. Please try again.')
      );
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    if (signupSubmitting) return;

    setSignupError('');

    if (signup.name.trim().length < 2) {
      setSignupError('Enter your full legal name.');
      return;
    }

    if (!EMAIL_PATTERN.test(signup.email.trim())) {
      setSignupError('Enter a valid email address.');
      return;
    }

    if (signup.password.length < 8) {
      setSignupError('Password must be at least 8 characters long.');
      return;
    }

    if (signup.password !== signup.confirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }

    if (signup.role === 'DOCTOR') {
      if (signup.licenseNumber.trim().length < 3) {
        setSignupError('Enter your medical license number.');
        return;
      }

      if (!signup.specialty) {
        setSignupError('Select your medical specialty.');
        return;
      }

      const years = Number(signup.yearsExperience);
      if (!Number.isFinite(years) || years < 0 || years > 60) {
        setSignupError('Enter your years in clinical practice (0 to 60).');
        return;
      }
    }

    setSignupSubmitting(true);

    try {
      const payload = {
        name: signup.name.trim(),
        email: signup.email.trim().toLowerCase(),
        password: signup.password,
        role: signup.role,
      };

      if (signup.role === 'DOCTOR') {
        payload.licenseNumber = signup.licenseNumber.trim();
        payload.specialty = signup.specialty;
        payload.yearsExperience = Number(signup.yearsExperience);
      }

      const { data } = await api.post('/auth/register', payload);
      openPortal(data);
    } catch (requestError) {
      setSignupError(
        getApiErrorMessage(
          requestError,
          'Unable to create the account. Try another email or sign in with demo credentials.'
        )
      );
    } finally {
      setSignupSubmitting(false);
    }
  };

  const fillDemoAccount = (account) => {
    setLoginRole(account.role);
    setLoginEmail(account.email);
    setLoginPassword(account.password);
    setLoginError('');
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-teal-500/20">
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Navbar */}
        <div className="flex items-center justify-between pb-6">
          <Brand />
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
        </div>

        {/* Auth Card Container */}
        <div className="mx-auto my-auto w-full max-w-md py-6">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Header Tabs */}
            <div className="text-center">
              <div className="mx-auto mb-3 flex justify-center">
                <img
                  src="/logo.png"
                  alt="Triage Horizon"
                  className="h-16 w-16 object-contain rounded-2xl border border-[#A3C9B4]/50 bg-white p-1 shadow-xs"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {mode === 'login' ? 'Clinical Sign In' : 'Create Clinician / Patient Account'}
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {mode === 'login'
                  ? 'Access the secure triage routing environment'
                  : 'Register for live clinical dispatch and consults'}
              </p>

              {/* Mode Switcher Pills */}
              <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={cn(
                    'rounded-lg py-2 text-xs font-bold transition-all',
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={cn(
                    'rounded-lg py-2 text-xs font-bold transition-all',
                    mode === 'signup'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  Register
                </button>
              </div>
            </div>

            {/* Login Form */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <RoleSelector
                  label="Workspace Role"
                  value={loginRole}
                  options={ROLE_OPTIONS}
                  onChange={(role) => {
                    setLoginRole(role);
                    setLoginError('');
                  }}
                />

                <div>
                  <FieldLabel htmlFor="login-email">Email Address</FieldLabel>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setLoginError('');
                      }}
                      placeholder="e.g. doctor@demo.com"
                      className={INPUT_WITH_ICON_CLASS}
                    />
                  </div>
                </div>

                <PasswordInput
                  id="login-password"
                  name="password"
                  label="Password"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError('');
                  }}
                  placeholder="Enter your password"
                  visible={showLoginPassword}
                  onToggleVisible={() => setShowLoginPassword((v) => !v)}
                />

                {loginError && <FieldError>{loginError}</FieldError>}

                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white shadow-md transition-all hover:bg-teal-700 hover:shadow-lg disabled:opacity-50"
                >
                  {loginSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Enter {ROLE_OPTIONS.find((r) => r.value === loginRole)?.label} Portal</span>
                  )}
                </button>

                <DemoAccess onFill={fillDemoAccount} />
              </form>
            ) : (
              /* Signup Form */
              <form onSubmit={handleSignup} className="mt-6 space-y-4">
                <RoleSelector
                  label="Register As"
                  value={signup.role}
                  options={SIGNUP_ROLE_OPTIONS}
                  onChange={(role) => {
                    setSignup((prev) => ({ ...prev, role }));
                    setSignupError('');
                  }}
                />

                <div>
                  <FieldLabel htmlFor="signup-name">Full Legal Name</FieldLabel>
                  <input
                    id="signup-name"
                    type="text"
                    value={signup.name}
                    onChange={updateSignup('name')}
                    placeholder="e.g. Dr. Mira Sen"
                    className={`${INPUT_CLASS} mt-1.5`}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="signup-email">Email Address</FieldLabel>
                  <input
                    id="signup-email"
                    type="email"
                    value={signup.email}
                    onChange={updateSignup('email')}
                    placeholder="doctor@hospital.org"
                    className={`${INPUT_CLASS} mt-1.5`}
                  />
                </div>

                <PasswordInput
                  id="signup-password"
                  name="password"
                  label="Password (min. 8 characters)"
                  value={signup.password}
                  onChange={updateSignup('password')}
                  placeholder="Create a password"
                  visible={showSignupPassword}
                  onToggleVisible={() => setShowSignupPassword((v) => !v)}
                />

                <div>
                  <FieldLabel htmlFor="signup-confirm-password">Confirm Password</FieldLabel>
                  <input
                    id="signup-confirm-password"
                    type="password"
                    value={signup.confirmPassword}
                    onChange={updateSignup('confirmPassword')}
                    placeholder="Repeat your password"
                    className={`${INPUT_CLASS} mt-1.5`}
                  />
                </div>

                {signup.role === 'DOCTOR' && (
                  <div className="rounded-2xl border border-teal-200/80 bg-teal-50/50 p-4 dark:border-teal-900/50 dark:bg-teal-950/30">
                    <p className="text-xs font-bold text-teal-900 dark:text-teal-200">
                      Physician Credentials
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <FieldLabel htmlFor="signup-license">Medical License #</FieldLabel>
                        <input
                          id="signup-license"
                          type="text"
                          value={signup.licenseNumber}
                          onChange={updateSignup('licenseNumber')}
                          placeholder="MCI-2026-XXXX"
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <FieldLabel htmlFor="signup-specialty">Specialty</FieldLabel>
                          <div className="relative mt-1">
                            <select
                              id="signup-specialty"
                              value={signup.specialty}
                              onChange={updateSignup('specialty')}
                              className={SELECT_CLASS}
                            >
                              <option value="">Select Specialty</option>
                              {SPECIALTY_OPTIONS.map((spec) => (
                                <option key={spec} value={spec}>{spec}</option>
                              ))}
                            </select>
                            <SelectChevron />
                          </div>
                        </div>
                        <div>
                          <FieldLabel htmlFor="signup-years">Years Exp.</FieldLabel>
                          <input
                            id="signup-years"
                            type="number"
                            min="0"
                            max="60"
                            value={signup.yearsExperience}
                            onChange={updateSignup('yearsExperience')}
                            placeholder="e.g. 8"
                            className={`${INPUT_CLASS} mt-1`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {signupError && <FieldError>{signupError}</FieldError>}

                <button
                  type="submit"
                  disabled={signupSubmitting}
                  className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white shadow-md transition-all hover:bg-teal-700 hover:shadow-lg disabled:opacity-50"
                >
                  {signupSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Create Account & Log In</span>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>

        {/* Bottom trust footer */}
        <div className="py-4 text-center text-xs text-slate-500">
          <p>Protected Clinical Workspace · HIPAA Synthetic Compliance</p>
        </div>
      </div>
    </div>
  );
}
