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
  'h-11 w-full rounded-[6px] border border-[#D6D1C4] bg-[#FFFDF8] px-3 text-sm text-[#11201C] placeholder:text-[#6B766F] transition-colors duration-200 focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20';

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
      className="block text-[13px] font-medium text-[#3D4A46]"
    >
      {children}
    </label>
  );
}

function FieldError({ children }) {
  return (
    <p className="flex items-start gap-2 text-[13px] font-medium leading-5 text-[#B91C1C]">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}

function SelectChevron() {
  return (
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B766F]"
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
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9F95]"
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
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[4px] text-[#6B766F] transition-colors hover:bg-[#F0EDE4] hover:text-[#11201C] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
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
                'inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border text-[13px] font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20',
                isActive
                  ? 'border-[#0D9488] bg-[#E6F4F1] text-[#0F766E]'
                  : 'border-[#D6D1C4] bg-[#FFFDF8] text-[#5A6660] hover:border-[#B9B2A2] hover:text-[#11201C]'
              )}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
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
    <div className="mt-4 rounded-[6px] border border-[#DDD8CC] bg-[#EFEBE2] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#6B766F]">
          Demo access
        </p>
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#9A9F95]">
          Click to fill
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onFill(account)}
            className="rounded-[4px] border border-[#DDD8CC] bg-[#FFFDF8] px-2.5 py-2 text-left transition-colors duration-200 hover:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#11201C]">
                {account.label}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[#9A9F95]">
                {account.role}
              </span>
            </span>
            <span className="mt-0.5 block text-[10px] text-[#6B766F]">
              {account.detail}
            </span>
            <span className="mt-1 block truncate font-mono text-[9px] text-[#9A9F95]">
              {account.email}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="th-auth-surface absolute inset-0" />
      <div className="th-forest-grid absolute inset-0 opacity-40" />

      <div className="absolute left-[6%] top-[16%] h-56 w-56 rounded-full border border-[#17332C]" />
      <div className="absolute left-[6%] top-[16%] h-80 w-80 rounded-full border border-[#122A24]" />
      <div className="absolute bottom-[-10%] right-[-6%] h-[520px] w-[520px] rounded-full border border-[#17332C]" />

      <svg
        className="absolute -right-32 top-16 h-[680px] w-[680px] text-[#1A3730]"
        viewBox="0 0 600 600"
        fill="none"
      >
        <circle cx="300" cy="300" r="290" stroke="currentColor" strokeWidth="1" />
        <circle cx="300" cy="300" r="220" stroke="currentColor" strokeWidth="1" />
        <circle cx="300" cy="300" r="150" stroke="currentColor" strokeWidth="1" />
        <path
          d="M74 438C164 372 224 426 292 316C354 216 430 194 532 118"
          stroke="#0D9488"
          strokeWidth="1.5"
          className="th-route-dash"
        />
        <circle cx="74" cy="438" r="5" fill="#0D9488" />
        <circle cx="292" cy="316" r="4" fill="#5EEAD4" />
        <circle cx="532" cy="118" r="5" fill="#16A34A" />
      </svg>
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

  const [mode, setMode] = useState(initialMode);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
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

    const name = signup.name.trim();
    const email = signup.email.trim().toLowerCase();
    const role = signup.role;

    if (name.length < 2) {
      setSignupError('Enter your full name.');
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setSignupError('Enter a valid email address.');
      return;
    }

    if (signup.password.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }

    if (signup.password !== signup.confirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }

    if (role === 'DOCTOR') {
      if (signup.licenseNumber.trim().length < 3) {
        setSignupError('Enter your medical license number.');
        return;
      }

      if (!signup.specialty) {
        setSignupError('Select a medical specialty.');
        return;
      }

      if (
        signup.yearsExperience === '' ||
        !Number.isFinite(Number(signup.yearsExperience)) ||
        Number(signup.yearsExperience) < 0 ||
        Number(signup.yearsExperience) > 60
      ) {
        setSignupError('Enter years of experience between 0 and 60.');
        return;
      }
    }

    setSignupSubmitting(true);

    try {
      const payload = {
        name,
        email,
        password: signup.password,
        role,
      };

      if (role === 'DOCTOR') {
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
          'Unable to create the account. Please try again.'
        )
      );
    } finally {
      setSignupSubmitting(false);
    }
  };

  const fillDemoAccount = (account) => {
    setMode('login');
    setLoginEmail(account.email);
    setLoginPassword(account.password);
    setLoginRole(account.role);
    setLoginError('');
    setSignupError('');
  };

  const resumePath = auth ? ROLE_PATHS[auth.role] : null;

  return (
    <div className="marketing relative min-h-screen overflow-hidden bg-[#081512] text-[#E8EFEC]">
      <AuthBackdrop />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_560px] xl:grid-cols-[minmax(0,1fr)_600px]">
        <aside className="hidden flex-col justify-between px-10 py-10 lg:flex xl:px-14">
          <div className="flex items-center justify-between gap-4">
            <Brand light />
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-[#A9BDB6] transition-colors hover:text-white"
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </div>

          <div className="max-w-[560px] py-10">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#5EEAD4]">
              Clinical access
            </p>
            <h1 className="mt-4 text-[clamp(2.75rem,4.6vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[#F3F7F5]">
              Every symptom
              <br />
              has a route.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#A9BDB6]">
              Sign in to the shared encounter backbone. One case, one source of
              truth, across patient, physician, and network operations.
            </p>

            <div className="mt-8 max-w-[470px]">
              <RoutingConsole compact />
            </div>
          </div>

          <div className="max-w-[560px]">
            <div className="grid grid-cols-3 gap-px border border-[#29423B] bg-[#29423B]">
              {[
                { value: '05', label: 'facilities' },
                { value: '03', label: 'care tiers' },
                { value: '01', label: 'shared record' },
              ].map((item) => (
                <div key={item.label} className="bg-[#0B1B18] px-3 py-3">
                  <p className="font-mono text-lg font-semibold text-[#F3F7F5]">
                    {item.value}
                  </p>
                  <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#7E958E]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="relative flex min-h-screen flex-col bg-[#F6F4EE] text-[#11201C] lg:border-l lg:border-[#DDD8CC]">
          <div className="flex items-center justify-between border-b border-[#DDD8CC] px-5 py-4 lg:hidden">
            <Brand />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5A6660]"
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              Home
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
            <motion.div
              className="w-full max-w-[480px]"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-[#6B766F]">
                    Secure access
                  </p>
                  <h2 className="mt-1.5 text-[26px] font-semibold tracking-[-0.035em] text-[#11201C]">
                    {mode === 'login' ? 'Welcome back' : 'Create your account'}
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-[#5A6660]">
                    {mode === 'login'
                      ? 'Sign in to your clinical workspace.'
                      : 'Patients and physicians can create an account.'}
                  </p>
                </div>

                {resumePath && (
                  <Link
                    to={resumePath}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-[#DDD8CC] bg-[#FFFDF8] px-2.5 py-1.5 text-[11px] font-semibold text-[#0F766E] transition-colors hover:border-[#0D9488]"
                  >
                    Resume
                    <ArrowRight aria-hidden="true" className="h-3 w-3" />
                  </Link>
                )}
              </div>

              <div className="mt-5 rounded-[6px] border border-[#DDD8CC] bg-[#FFFDF8] p-5 sm:p-6">
                <div
                  className="grid grid-cols-2 gap-1 rounded-[6px] border border-[#DDD8CC] bg-[#EFEBE2] p-1"
                  role="tablist"
                  aria-label="Authentication"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'login'}
                    onClick={() => switchMode('login')}
                    className={cn(
                      'h-9 rounded-[4px] border text-[13px] font-semibold transition-colors duration-200',
                      mode === 'login'
                        ? 'border-[#DDD8CC] bg-[#FFFDF8] text-[#11201C]'
                        : 'border-transparent text-[#6B766F] hover:text-[#11201C]'
                    )}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'signup'}
                    onClick={() => switchMode('signup')}
                    className={cn(
                      'h-9 rounded-[4px] border text-[13px] font-semibold transition-colors duration-200',
                      mode === 'signup'
                        ? 'border-[#DDD8CC] bg-[#FFFDF8] text-[#11201C]'
                        : 'border-transparent text-[#6B766F] hover:text-[#11201C]'
                    )}
                  >
                    Create account
                  </button>
                </div>

                {mode === 'login' ? (
                  <form onSubmit={handleLogin} className="mt-5 space-y-4" noValidate>
                    <div>
                      <FieldLabel htmlFor="login-email">Email address</FieldLabel>
                      <div className="relative mt-1.5">
                        <Mail
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9F95]"
                        />
                        <input
                          id="login-email"
                          name="email"
                          type="email"
                          autoComplete="username"
                          value={loginEmail}
                          onChange={(event) => setLoginEmail(event.target.value)}
                          placeholder="clinician@hospital.org"
                          className={INPUT_WITH_ICON_CLASS}
                        />
                      </div>
                    </div>

                    <PasswordInput
                      id="login-password"
                      name="password"
                      label="Password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      visible={showLoginPassword}
                      onToggleVisible={() =>
                        setShowLoginPassword((visible) => !visible)
                      }
                    />

                    <RoleSelector
                      label="Portal role"
                      value={loginRole}
                      options={ROLE_OPTIONS}
                      onChange={setLoginRole}
                    />

                    {loginError && (
                      <div role="alert">
                        <FieldError>{loginError}</FieldError>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loginSubmitting}
                      className={cn(
                        'inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border text-sm font-semibold text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30',
                        loginSubmitting
                          ? 'cursor-wait border-[#0B4F4A] bg-[#0B4F4A] opacity-80'
                          : 'border-[#0B4F4A] bg-[#0F766E] hover:bg-[#0B4F4A]'
                      )}
                    >
                      {loginSubmitting ? (
                        <Loader2
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                        />
                      ) : (
                        <Stethoscope aria-hidden="true" className="h-4 w-4" />
                      )}
                      {loginSubmitting ? 'Signing in…' : 'Sign in'}
                    </button>

                    <p className="flex items-center gap-2 border-t border-[#E8E4D9] pt-3 text-[11px] leading-5 text-[#6B766F]">
                      <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                      Sessions last 8 hours. Sign out when you finish.
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleSignup} className="mt-5 space-y-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel htmlFor="signup-name">Full name</FieldLabel>
                        <div className="relative mt-1.5">
                          <UserRound
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9F95]"
                          />
                          <input
                            id="signup-name"
                            name="name"
                            type="text"
                            autoComplete="name"
                            value={signup.name}
                            onChange={updateSignup('name')}
                            placeholder="Dr. Kavya Verma"
                            className={INPUT_WITH_ICON_CLASS}
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel htmlFor="signup-email">Email address</FieldLabel>
                        <div className="relative mt-1.5">
                          <Mail
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9F95]"
                          />
                          <input
                            id="signup-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={signup.email}
                            onChange={updateSignup('email')}
                            placeholder="you@hospital.org"
                            className={INPUT_WITH_ICON_CLASS}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <PasswordInput
                        id="signup-password"
                        name="password"
                        label="Password"
                        value={signup.password}
                        onChange={updateSignup('password')}
                        placeholder="8+ characters"
                        autoComplete="new-password"
                        visible={showSignupPassword}
                        onToggleVisible={() =>
                          setShowSignupPassword((visible) => !visible)
                        }
                      />

                      <div>
                        <FieldLabel htmlFor="signup-confirm-password">
                          Confirm password
                        </FieldLabel>
                        <div className="relative mt-1.5">
                          <LockKeyhole
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9F95]"
                          />
                          <input
                            id="signup-confirm-password"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            value={signup.confirmPassword}
                            onChange={updateSignup('confirmPassword')}
                            placeholder="Re-enter password"
                            className={INPUT_WITH_ICON_CLASS}
                          />
                        </div>
                      </div>
                    </div>

                    <RoleSelector
                      label="Account role"
                      value={signup.role}
                      options={SIGNUP_ROLE_OPTIONS}
                      onChange={(role) =>
                        setSignup((previous) => ({ ...previous, role }))
                      }
                    />

                    {signup.role === 'DOCTOR' && (
                      <div className="rounded-[6px] border border-[#DDD8CC] bg-[#F6F4EE] p-4">
                        <div className="flex items-start gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[4px] border border-[#CCFBF1] bg-[#F0FDFA] text-[#0D9488]">
                            <Stethoscope
                              aria-hidden="true"
                              className="h-4 w-4"
                            />
                          </span>
                          <div>
                            <p className="text-[13px] font-semibold text-[#11201C]">
                              Medical credentials
                            </p>
                            <p className="mt-0.5 text-[11px] leading-5 text-[#6B766F]">
                              Required for physician accounts and visible to
                              network administrators.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-4">
                          <div>
                            <FieldLabel htmlFor="signup-license">
                              Medical license number
                            </FieldLabel>
                            <input
                              id="signup-license"
                              name="licenseNumber"
                              type="text"
                              value={signup.licenseNumber}
                              onChange={updateSignup('licenseNumber')}
                              placeholder="e.g. MCI-2026-88421"
                              className={`${INPUT_CLASS} mt-1.5`}
                            />
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <FieldLabel htmlFor="signup-specialty">
                                Specialty
                              </FieldLabel>
                              <div className="relative mt-1.5">
                                <select
                                  id="signup-specialty"
                                  name="specialty"
                                  value={signup.specialty}
                                  onChange={updateSignup('specialty')}
                                  className={SELECT_CLASS}
                                >
                                  <option value="">Select a specialty</option>
                                  {SPECIALTY_OPTIONS.map((specialty) => (
                                    <option key={specialty} value={specialty}>
                                      {specialty}
                                    </option>
                                  ))}
                                </select>
                                <SelectChevron />
                              </div>
                            </div>

                            <div>
                              <FieldLabel htmlFor="signup-experience">
                                Years of experience
                              </FieldLabel>
                              <input
                                id="signup-experience"
                                name="yearsExperience"
                                type="number"
                                min="0"
                                max="60"
                                step="1"
                                value={signup.yearsExperience}
                                onChange={updateSignup('yearsExperience')}
                                placeholder="e.g. 9"
                                className={`${INPUT_CLASS} mt-1.5`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {signupError && (
                      <div role="alert">
                        <FieldError>{signupError}</FieldError>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={signupSubmitting}
                      className={cn(
                        'inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border text-sm font-semibold text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30',
                        signupSubmitting
                          ? 'cursor-wait border-[#0B4F4A] bg-[#0B4F4A] opacity-80'
                          : 'border-[#0B4F4A] bg-[#0F766E] hover:bg-[#0B4F4A]'
                      )}
                    >
                      {signupSubmitting ? (
                        <Loader2
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                        />
                      ) : (
                        <Plus aria-hidden="true" className="h-4 w-4" />
                      )}
                      {signupSubmitting ? 'Creating account…' : 'Create account'}
                    </button>

                    <div className="flex items-start gap-2 border-t border-[#E8E4D9] pt-3 text-[11px] leading-5 text-[#6B766F]">
                      <Database
                        aria-hidden="true"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0D9488]"
                      />
                      <span>
                        Your account is saved to the network database. After signing
                        out, use the same email and password to sign in again.
                      </span>
                    </div>
                  </form>
                )}
              </div>

              {mode === 'login' && <DemoAccess onFill={fillDemoAccount} />}

              <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-[#6B766F]">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                Protected clinical workspace · Role-based access · No real patient
                health information
              </p>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
