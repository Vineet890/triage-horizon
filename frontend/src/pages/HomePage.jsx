import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Database,
  Hospital,
  LockKeyhole,
  MapPin,
  Menu,
  MessageSquare,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts';
import useTriageStore from '../store/useTriageStore';
import DoctorHeroIllustration from '../components/marketing/DoctorHeroIllustration';
import { BrandLockup } from '../components/Brand';

const ROLE_PATHS = {
  PATIENT: '/patient',
  DOCTOR: '/doctor',
  ADMIN: '/admin',
};

const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#care-tiers', label: 'Care Tiers' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#portals', label: 'Portals' },
  { href: '#demo-accounts', label: 'Resources' },
];

const STATS = [
  {
    value: '05',
    label: 'Connected Facilities',
    detail: 'Live ICU, bed & ER wait metrics',
  },
  {
    value: '03',
    label: 'Care Tiers',
    detail: 'Emergency, specialist & telehealth',
  },
  {
    value: '06',
    label: 'Encounter States',
    detail: 'Intake to clinician close-out',
  },
  {
    value: '< 2s',
    label: 'Routing Latency',
    detail: 'Manchester protocol inference',
  },
];

const CARE_TIERS = [
  {
    code: 'TIER 01',
    title: 'Emergency Department',
    description:
      'Chest pain, severe trauma, stroke signs, and unstable vitals route immediately to high-acuity facilities.',
    route: 'Trauma-ready · Cath Lab · ICU Bed Reservation',
    icon: Zap,
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
    iconClass: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 ring-rose-500/20',
  },
  {
    code: 'TIER 02',
    title: 'Urgent Specialist Care',
    description:
      'Fractures, acute asthma flares, and moderate infections route to same-day specialty clinics with open capacity.',
    route: 'Same-day queue slot · Direct specialty matching',
    icon: Stethoscope,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
    iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 ring-amber-500/20',
  },
  {
    code: 'TIER 03',
    title: 'Instant Telehealth Video',
    description:
      'Medication reviews, rash follow-ups, anxiety, and mild respiratory symptoms route to secure video consultation.',
    route: 'Instant connection · Zero transit · E-prescriptions',
    icon: Video,
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-900/50',
    iconClass: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 ring-teal-500/20',
  },
];

const STEPS = [
  {
    title: 'Clinical Intake',
    description:
      'Structured conversational narrative capturing symptoms, duration, pain scale, and current medications.',
    meta: 'JWT-Signed Patient Session',
    icon: MessageSquare,
  },
  {
    title: 'Manchester Protocol Triage',
    description:
      'Algorithmic acuity assignment (Critical, High, Moderate, Low) with transparent, inspectable reasoning steps.',
    meta: 'Clinical Protocol Standard',
    icon: Route,
  },
  {
    title: 'Dynamic Hospital Matching',
    description:
      'Live ER occupancy, ICU bed counts, traffic distance, and specialty capabilities scored in real time.',
    meta: '5 Regional Facilities Evaluated',
    icon: Hospital,
  },
  {
    title: 'Physician Handoff & Prescriptions',
    description:
      'Licensed clinicians review the triage trace, accept the encounter, conduct video consults, and dispatch digital prescriptions.',
    meta: 'Clinician In-the-Loop',
    icon: ShieldCheck,
  },
];

const PORTALS = [
  {
    tag: 'Patient Portal',
    title: 'Intelligent Patient Care',
    description:
      'Report symptoms, see live routing decisions, join clinician video consults, and track medication adherence.',
    bullets: ['Instant clinical intake', 'Live route & ETA countdown', 'Integrated video consults'],
    href: '/login?role=PATIENT',
    icon: UserRound,
    accent: 'border-teal-500/40 hover:border-teal-500',
    buttonColor: 'bg-teal-600 hover:bg-teal-700 text-white',
  },
  {
    tag: 'Doctor Workstation',
    title: 'Physician Command Center',
    description:
      'Queue management prioritized by acuity, full patient dossier review, SOAP notes, video appointments, and 1-click prescribing.',
    bullets: ['Acuity-sorted triage queue', 'Complete Manchester trace', 'Direct digital prescriptions'],
    href: '/login?role=DOCTOR',
    icon: Stethoscope,
    accent: 'border-cyan-500/40 hover:border-cyan-500',
    buttonColor: 'bg-cyan-600 hover:bg-cyan-700 text-white',
  },
  {
    tag: 'Network Operations',
    title: 'Hospital Grid Command',
    description:
      'Regional map of hospital loads, bed telemetry, live route feeds, and disaster simulation with instant re-routing.',
    bullets: ['Live regional bed telemetry', 'Shock simulation engine', 'Automatic mass re-routing'],
    href: '/login?role=ADMIN',
    icon: Users,
    accent: 'border-indigo-500/40 hover:border-indigo-500',
    buttonColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
];

const PRINCIPLES = [
  {
    title: 'Cryptographically Secured',
    description:
      'JWT-authenticated sessions and isolated Socket.IO rooms ensure patient health records remain strictly confidential.',
    icon: LockKeyhole,
  },
  {
    title: 'Full Audit Trail',
    description:
      'Every triage step, rejected destination, and clinician action is logged to an immutable encounter history.',
    icon: Activity,
  },
  {
    title: 'Deterministic Shock Resiliency',
    description:
      'When a hospital enters limited or offline status, the network automatically computes and broadcasts alternate destinations.',
    icon: Route,
  },
  {
    title: 'Zero PHI Leakage',
    description:
      'Designed exclusively with synthetic clinical datasets so health workflows can be demonstrated safely.',
    icon: Database,
  },
];

function Brand({ light = false }) {
  return <BrandLockup to="/" light={light} />;
}

function SectionEyebrow({ children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDEC7] bg-[#DCEEE3] px-3.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#2D5A42] dark:border-[#385E4B] dark:bg-[#274335] dark:text-[#A8D3BA]">
      <Sparkles className="h-3.5 w-3.5 text-[#3D6B56] dark:text-[#7CA982]" />
      <span>{children}</span>
    </div>
  );
}

function Reveal({ children, className = '', delay = 0 }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  const auth = useTriageStore((state) => state.auth);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const workspacePath = auth ? ROLE_PATHS[auth.role] : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-teal-500/20">
      {/* Top Telemetry Banner */}
      <div className="border-b border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8 text-xs">
          <p className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-400">
              Network Operational
            </span>
            <span className="hidden text-slate-400 sm:inline">
              · 5 Regional Healthcare Facilities Online · Live Socket Telemetry
            </span>
          </p>
          <a
            href="#demo-accounts"
            className="hidden items-center gap-1.5 font-medium text-slate-300 transition-colors hover:text-white sm:inline-flex"
          >
            Quick Demo Logins
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-teal-400" />
          </a>
        </div>
      </div>

      {/* Main Glass Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Brand />

          <nav aria-label="Primary navigation" className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-slate-600 transition-colors hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <button
              type="button"
              aria-label="Search platform"
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
            </button>

            <Link
              to={workspacePath || '/login'}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2D5A42] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#234834] hover:shadow-md"
            >
              Enter Workspace
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
            <nav className="space-y-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Sign In
              </Link>
              <Link
                to="/login?mode=signup"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-600 text-sm font-semibold text-white"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section matching the doctor-patient consultation mockup */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-[#F4F9F5] pt-12 pb-14 lg:pt-16 lg:pb-16 dark:border-slate-800 dark:bg-slate-950">
          <div aria-hidden="true" className="th-hero-glow absolute inset-0 pointer-events-none opacity-40" />

          {/* Hero Consultation Background - Large in background with proper dimensions */}
          <DoctorHeroIllustration isBackground />

          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center min-h-[380px] lg:min-h-[460px]">
              <motion.div
                className="lg:col-span-6 xl:col-span-5 max-w-xl z-10"
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <SectionEyebrow>AI-Powered Clinical Decision Support</SectionEyebrow>

                <h1 className="mt-5 text-4xl font-extrabold tracking-tight leading-[1.08] text-[#172820] sm:text-5xl lg:text-[52px] xl:text-[58px] dark:text-white">
                  The right care.
                  <br />
                  The right hospital.
                  <br />
                  <span className="text-[#3D6B56] dark:text-[#7CA982]">
                    In seconds.
                  </span>
                </h1>

                <p className="mt-5 text-base sm:text-lg leading-relaxed text-[#3B5446] dark:text-slate-300">
                  Triage Horizon analyzes patient symptoms, checks real-time hospital capacity and travel times, and connects every patient to the right care, at the right place, at the right time.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    to="/login?role=PATIENT&mode=signup"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2D5A42] px-7 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#234834] hover:shadow-md"
                  >
                    Start Patient Triage
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold text-[#172820] shadow-xs transition-all hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <span>Explore How It Works</span>
                    <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-400 text-[10px] text-slate-700 dark:text-slate-300">▶</span>
                  </a>
                </div>
              </motion.div>

              {/* On mobile / tablet viewports, show consultation scene cleanly stacked below */}
              <div className="block lg:hidden w-full select-none -my-2">
                <DoctorHeroIllustration />
              </div>
            </div>

            {/* Bottom 4 Value Props Card from Mockup */}
            <div className="mt-12 lg:mt-16 rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/95 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F3EB] text-[#25523A] dark:bg-[#1E362A] dark:text-[#82AF96]">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#172820] dark:text-white">Real-time Bed Availability</p>
                    <p className="text-xs text-[#527060] dark:text-slate-400">Across the region</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F3EB] text-[#25523A] dark:bg-[#1E362A] dark:text-[#82AF96]">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#172820] dark:text-white">Smart Hospital Routing</p>
                    <p className="text-xs text-[#527060] dark:text-slate-400">Optimal facility based on severity and location</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F3EB] text-[#25523A] dark:bg-[#1E362A] dark:text-[#82AF96]">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#172820] dark:text-white">Doctor-Patient Collaboration</p>
                    <p className="text-xs text-[#527060] dark:text-slate-400">Seamless care coordination with full clinical oversight</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F3EB] text-[#25523A] dark:bg-[#1E362A] dark:text-[#82AF96]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#172820] dark:text-white">Safer, Faster Care Decisions</p>
                    <p className="text-xs text-[#527060] dark:text-slate-400">Evidence-backed recommendations for better outcomes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Row */}
        <section aria-label="Network at a glance" className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {stat.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Care Tiers */}
        <section id="care-tiers" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center">
              <SectionEyebrow>Tri-Level Routing</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                Precision Care Pathways
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-400">
                Patients are automatically classified according to acute clinical requirements.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {CARE_TIERS.map((tier, idx) => {
              const Icon = tier.icon;
              return (
                <Reveal key={tier.title} delay={idx * 0.1}>
                  <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs transition-all duration-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`grid h-12 w-12 place-items-center rounded-xl ring-1 ${tier.iconClass}`}>
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className={`rounded-full border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${tier.badgeClass}`}>
                          {tier.code}
                        </span>
                      </div>
                      <h3 className="mt-6 text-xl font-bold text-slate-900 dark:text-white">
                        {tier.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {tier.description}
                      </p>
                    </div>
                    <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <p className="font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
                        {tier.route}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="border-y border-slate-200/80 bg-slate-100/60 py-20 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center">
              <SectionEyebrow>Clinical Workflow</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                How Triage Horizon Operates
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600 dark:text-slate-400">
                From initial symptom capture to physician sign-off, every decision step is transparent and verifiable.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <Reveal key={step.title} delay={idx * 0.08}>
                    <div className="h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                          0{idx + 1}
                        </span>
                        <Icon className="h-5 w-5 text-slate-400" />
                      </div>
                      <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {step.description}
                      </p>
                      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          {step.meta}
                        </span>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Three Portals */}
        <section id="portals" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <SectionEyebrow>Connected Workspaces</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Three Dedicated Portals. One Shared Backbone.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-400">
              Patients, physicians, and network operations view the same live encounter state synchronized via WebSockets.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {PORTALS.map((portal, idx) => {
              const Icon = portal.icon;
              return (
                <Reveal key={portal.title} delay={idx * 0.1}>
                  <div className={`flex h-full flex-col justify-between rounded-2xl border bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-xl dark:bg-slate-900 ${portal.accent}`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-teal-400 dark:bg-slate-800">
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
                          {portal.tag}
                        </span>
                      </div>
                      <h3 className="mt-6 text-xl font-bold text-slate-900 dark:text-white">
                        {portal.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {portal.description}
                      </p>
                      <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-5 dark:border-slate-800">
                        {portal.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Link
                      to={portal.href}
                      className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold shadow-xs transition-all ${portal.buttonColor}`}
                    >
                      Open {portal.tag}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Demo Accounts Quick-Launch */}
        <section id="demo-accounts" className="border-t border-slate-200/80 bg-slate-100/60 py-16 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <SectionEyebrow>Instant Access</SectionEyebrow>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  Built-in Demo Credentials
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Click any role to prefill credentials and explore the platform immediately.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DEMO_ACCOUNTS.map((account) => (
                <Link
                  key={account.email}
                  to={`/login?role=${account.role}&email=${encodeURIComponent(account.email)}`}
                  className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:border-teal-500/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {account.role}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-400 transition-colors group-hover:text-teal-600" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                    {account.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {account.detail}
                  </p>
                  <p className="mt-3 truncate border-t border-slate-100 pt-2 font-mono text-[11px] text-teal-600 dark:border-slate-800 dark:text-teal-400">
                    {account.email}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 text-slate-400 py-12">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-slate-800">
            <div>
              <Brand light />
              <p className="mt-2 text-sm text-slate-400 max-w-md">
                Algorithmic clinical triage and capacity-aware patient routing.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm font-semibold">
              <a href="#platform" className="hover:text-white">Platform</a>
              <a href="#care-tiers" className="hover:text-white">Care Tiers</a>
              <a href="#how-it-works" className="hover:text-white">How It Works</a>
              <a href="#portals" className="hover:text-white">Portals</a>
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-slate-500">
            <p>© 2026 Triage Horizon. Synthetic clinical research demonstration.</p>
            <p className="font-mono text-[11px]">No real patient protected health information (PHI) is processed.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
