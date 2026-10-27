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
  Menu,
  MessageSquare,
  Quote,
  Route,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts';
import useTriageStore from '../store/useTriageStore';
import RoutingConsole from '../components/marketing/RoutingConsole';
import { BrandLockup } from '../components/Brand';

const ROLE_PATHS = {
  PATIENT: '/patient',
  DOCTOR: '/doctor',
  ADMIN: '/admin',
};

const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#care-tiers', label: 'Care tiers' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#portals', label: 'Portals' },
];

const STATS = [
  {
    value: '05',
    label: 'Connected facilities',
    detail: 'Live capacity and travel time',
  },
  {
    value: '03',
    label: 'Care tiers',
    detail: 'Emergency, specialist, telehealth',
  },
  {
    value: '06',
    label: 'Encounter states',
    detail: 'Intake through close-out',
  },
  {
    value: '01',
    label: 'Shared record',
    detail: 'Patient, physician, network ops',
  },
];

const CARE_TIERS = [
  {
    code: 'TIER 01',
    title: 'Emergency',
    description:
      'Chest pain, stroke signs, severe bleeding, and unstable vitals route to a definitive emergency department.',
    route: 'Trauma-capable · cath lab · ICU',
    icon: Zap,
    color: '#DC2626',
    soft: '#FEF2F2',
    border: '#FECACA',
  },
  {
    code: 'TIER 02',
    title: 'Urgent specialist',
    description:
      'Asthma flares, fractures, and infections route to same-day specialist or primary care capacity.',
    route: 'Same-day slot · specialty fit',
    icon: Stethoscope,
    color: '#CA8A04',
    soft: '#FEFCE8',
    border: '#FDE68A',
  },
  {
    code: 'TIER 03',
    title: 'Telehealth',
    description:
      'Reflux, anxiety, medication reviews, and low-acuity follow-ups route to a secure video visit.',
    route: 'Zero travel · clinician video room',
    icon: Video,
    color: '#0D9488',
    soft: '#F0FDFA',
    border: '#CCFBF1',
  },
];

const STEPS = [
  {
    title: 'Patient intake',
    description:
      'A plain-language symptom story, grounded in the patient record and signed by their session.',
    meta: 'JWT-derived identity',
    icon: MessageSquare,
  },
  {
    title: 'Agent triage',
    description:
      'Protocol match, adherence and mental-health modifiers, and a reasoning trace the clinician can inspect.',
    meta: 'Manchester Triage aligned',
    icon: Route,
  },
  {
    title: 'Facility match',
    description:
      'Live capacity, ER wait, specialty fit, and travel time are compared before a destination is chosen.',
    meta: '5 facilities · 1 route',
    icon: Hospital,
  },
  {
    title: 'Clinician acceptance',
    description:
      'A licensed physician reviews the handoff, accepts the case, and can prescribe without leaving the queue.',
    meta: 'Human in the loop',
    icon: ShieldCheck,
  },
];

const PORTALS = [
  {
    tag: 'For patients',
    title: 'Know where to go.',
    description:
      'See the route, understand the decision, and receive prescriptions and follow-up in one calm workspace.',
    bullets: ['Live route status', 'Medicine adherence', 'Mental-health check-ins'],
    href: '/login?role=PATIENT',
    icon: UserRound,
  },
  {
    tag: 'For clinicians',
    title: 'Decide with context.',
    description:
      'Review the full handoff, inspect the agent trace, accept the case, and prescribe from a single queue.',
    bullets: ['Risk modifiers', 'Agent reasoning', 'E-prescribing loop'],
    href: '/login?role=DOCTOR',
    icon: Stethoscope,
  },
  {
    tag: 'For network operations',
    title: 'See the whole board.',
    description:
      'Watch capacity, simulate a facility outage, and confirm every affected route has been reassigned.',
    bullets: ['Live command map', 'Shock simulation', 'Registered accounts'],
    href: '/login?role=ADMIN',
    icon: Users,
  },
];

const PRINCIPLES = [
  {
    title: 'Role-secured by default',
    description:
      'JWT-scoped socket rooms mean a patient only receives their own encounter, never another patient’s PHI.',
    icon: LockKeyhole,
  },
  {
    title: 'Every decision is traceable',
    description:
      'Agent steps, rejected facilities, and clinician acceptance are stored on the shared encounter record.',
    icon: Activity,
  },
  {
    title: 'Reroutes are explicit',
    description:
      'A facility shock invokes rerouting immediately and broadcasts each new destination to the affected patient.',
    icon: Route,
  },
  {
    title: 'Demo-safe by design',
    description:
      'Synthetic patients only. No real health information is used, stored, or transmitted in this environment.',
    icon: Database,
  },
];

function Brand({ light = false }) {
  return <BrandLockup to="/" light={light} />;
}

function SectionEyebrow({ children }) {
  return (
    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#0F766E]">
      {children}
    </p>
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
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
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
    <div className="marketing min-h-screen bg-canvas text-ink">
      <div className="bg-[#0B1B18] text-[#C7D6D1]">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-5 py-2 sm:px-8 lg:px-10">
          <p className="flex min-w-0 items-center gap-2 text-[11px]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-[1px] bg-[#16A34A]"
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#5EEAD4]">
              Network status
            </span>
            <span className="hidden text-[#8FA69F] sm:inline">
              All 5 facilities reporting · Chandigarh grid
            </span>
          </p>
          <a
            href="#portals"
            className="hidden items-center gap-1.5 text-[11px] font-medium text-[#C7D6D1] transition-colors hover:text-white sm:inline-flex"
          >
            Explore the portals
            <ArrowRight aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-[#DDD8CC] bg-[#F6F4EE]/[0.92] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-10">
          <Brand />

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 lg:flex"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[#4D5A54] transition-colors hover:text-[#11201C]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            {workspacePath ? (
              <Link
                to={workspacePath}
                className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-[#0B4F4A] bg-[#0F766E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B4F4A]"
              >
                Open workspace
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex h-9 items-center rounded-[6px] border border-transparent px-3 text-sm font-medium text-[#4D5A54] transition-colors hover:border-[#DDD8CC] hover:bg-[#FFFDF8] hover:text-[#11201C]"
                >
                  Sign in
                </Link>
                <Link
                  to="/login?mode=signup"
                  className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-[#0B4F4A] bg-[#0F766E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B4F4A]"
                >
                  Get started
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="home-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="grid h-9 w-9 place-items-center rounded-[6px] border border-[#DDD8CC] bg-[#FFFDF8] text-[#11201C] lg:hidden"
          >
            {menuOpen ? (
              <X aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Menu aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>

        {menuOpen && (
          <div
            id="home-mobile-menu"
            className="border-t border-[#DDD8CC] bg-[#F6F4EE] px-5 py-4 lg:hidden"
          >
            <nav aria-label="Mobile navigation" className="space-y-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-[6px] px-3 py-2.5 text-sm font-medium text-[#4D5A54] hover:bg-[#FFFDF8] hover:text-[#11201C]"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#DDD8CC] pt-3">
              {workspacePath ? (
                <Link
                  to={workspacePath}
                  onClick={() => setMenuOpen(false)}
                  className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[#0B4F4A] bg-[#0F766E] text-sm font-semibold text-white"
                >
                  Open workspace
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[#DDD8CC] bg-[#FFFDF8] text-sm font-medium text-[#11201C]"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/login?mode=signup"
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border border-[#0B4F4A] bg-[#0F766E] text-sm font-semibold text-white"
                  >
                    Get started
                    <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[#DDD8CC]">
          <div aria-hidden="true" className="th-paper-grid absolute inset-0 opacity-70" />
          <div
            aria-hidden="true"
            className="absolute -right-40 -top-40 h-[620px] w-[620px] rounded-full border border-[#DDD8CC]/80"
          />
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full border border-[#DDD8CC]/60"
          />

          <div className="relative mx-auto grid w-full max-w-[1400px] gap-14 px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:items-center lg:gap-12 lg:px-10 lg:pb-24 lg:pt-24">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-flex items-center gap-2 rounded-[3px] border border-[#CFC8B8] bg-[#FFFDF8] px-3 py-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#4D5A54]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16A34A] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                </span>
                Clinical routing network · live
              </span>

              <h1 className="mt-6 max-w-[720px] text-[clamp(2.9rem,6.2vw,5.6rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-[#11201C]">
                The right care.
                <br />
                The right door.
                <br />
                <span className="text-[#0D9488]">The right minute.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-[#4D5A54] sm:text-lg sm:leading-8">
                Triage Horizon reads the symptom, weighs live capacity and travel
                time, then routes every patient to the safest available care — with
                a licensed clinician in the loop.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login?role=PATIENT&mode=signup"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[6px] border border-[#0B4F4A] bg-[#0F766E] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#0B4F4A]"
                >
                  Start a triage
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <a
                  href="#platform"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[6px] border border-[#CFC8B8] bg-[#FFFDF8] px-6 text-sm font-semibold text-[#11201C] transition-colors hover:border-[#11201C] hover:bg-white"
                >
                  See how it works
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#6B766F]">
                <span className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#0D9488]" />
                  Manchester Triage aligned
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#0D9488]" />
                  Role-secured access
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#0D9488]" />
                  Audit-ready trace
                </span>
              </div>
            </motion.div>

            <motion.div
              className="relative mx-auto w-full max-w-[560px]"
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                aria-hidden="true"
                className="absolute -inset-8 rounded-full border border-[#DDD8CC]/80"
              />
              <div
                aria-hidden="true"
                className="absolute -inset-16 rounded-full border border-[#DDD8CC]/40"
              />
              <div className="relative">
                <RoutingConsole />
              </div>

              <div className="absolute -left-5 -top-10 hidden rounded-[6px] border border-[#DDD8CC] bg-[#FFFDF8] px-3 py-2 xl:block">
                <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#6B766F]">
                  Network load
                </p>
                <p className="mt-1 text-sm font-semibold text-[#11201C]">
                  54%{' '}
                  <span className="text-[10px] font-normal text-[#6B766F]">
                    across 5 facilities
                  </span>
                </p>
              </div>

              <div className="absolute -bottom-10 -right-5 hidden rounded-[6px] border border-[#DDD8CC] bg-[#FFFDF8] px-3 py-2 xl:block">
                <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#6B766F]">
                  Encounter rail
                </p>
                <p className="mt-1 text-sm font-semibold text-[#11201C]">
                  6 steps{' '}
                  <span className="text-[10px] font-normal text-[#6B766F]">
                    · 1 shared record
                  </span>
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        <section aria-label="Network at a glance" className="border-b border-[#DDD8CC] bg-[#EFEBE2]">
          <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="grid grid-cols-2 gap-px border border-[#DDD8CC] bg-[#DDD8CC] lg:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-[#F6F4EE] p-5 sm:p-6">
                  <p className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-[#6B766F]">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#11201C] sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#6B766F]">
                    {stat.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="platform"
          className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-16">
            <Reveal>
              <SectionEyebrow>01 / The platform</SectionEyebrow>
              <h2 className="mt-4 max-w-xl text-[clamp(2rem,4.2vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-[#11201C]">
                A routing decision that explains itself.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#4D5A54]">
                Every case carries a trace: the protocol matched, the facilities
                considered, the reason each was declined, and the clinician who
                accepted it. No black boxes between a symptom and a destination.
              </p>

              <ul className="mt-9 space-y-5">
                {[
                  {
                    title: 'Protocol-grounded',
                    detail:
                      'Manchester Triage logic, adherence risk, and mental-health modifiers shape the route.',
                  },
                  {
                    title: 'Capacity-aware',
                    detail:
                      'Live beds, ER wait, specialty fit, and travel time are compared in one pass.',
                  },
                  {
                    title: 'Clinician-controlled',
                    detail:
                      'Every route waits for a licensed physician to review and accept the handoff.',
                  },
                ].map((feature, index) => (
                  <li key={feature.title} className="flex gap-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[4px] border border-[#CFC8B8] bg-[#FFFDF8] font-mono text-[10px] font-semibold text-[#0F766E]">
                      0{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#11201C]">
                        {feature.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#5A6660]">
                        {feature.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.08}>
              <div id="care-tiers" className="scroll-mt-24">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-[#6B766F]">
                      Care tiers
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#11201C]">
                      The route follows the acuity.
                    </p>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#9A9F95]">
                    3 pathways
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {CARE_TIERS.map((tier) => {
                    const Icon = tier.icon;

                    return (
                      <div
                        key={tier.title}
                        className="rounded-[6px] border border-[#DDD8CC] bg-[#FFFDF8] p-5 transition-colors hover:border-[#B9B2A2]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="grid h-8 w-8 place-items-center rounded-[4px] border"
                              style={{
                                color: tier.color,
                                backgroundColor: tier.soft,
                                borderColor: tier.border,
                              }}
                            >
                              <Icon aria-hidden="true" className="h-4 w-4" />
                            </span>
                            <p className="text-sm font-semibold text-[#11201C]">
                              {tier.title}
                            </p>
                          </div>
                          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#9A9F95]">
                            {tier.code}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#4D5A54]">
                          {tier.description}
                        </p>
                        <p className="mt-3 border-t border-[#E8E4D9] pt-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[#6B766F]">
                          {tier.route}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-[#DDD8CC] bg-[#EFEBE2]"
        >
          <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
            <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <SectionEyebrow>02 / How it works</SectionEyebrow>
                <h2 className="mt-4 max-w-2xl text-[clamp(2rem,4.2vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-[#11201C]">
                  From symptom to safe destination.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-[#5A6660]">
                The same encounter travels through four accountable steps. Nothing
                is inferred silently, and nothing is routed without a clinician.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-px border border-[#DDD8CC] bg-[#DDD8CC] md:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div key={step.title} className="bg-[#F6F4EE] p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-[#0F766E]">
                        Step 0{index + 1}
                      </span>
                      <Icon
                        aria-hidden="true"
                        className="h-4 w-4 text-[#6B766F]"
                      />
                    </div>
                    <h3 className="mt-7 text-lg font-semibold tracking-[-0.02em] text-[#11201C]">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#5A6660]">
                      {step.description}
                    </p>
                    <p className="mt-5 border-t border-[#DDD8CC] pt-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[#9A9F95]">
                      {step.meta}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="portals" className="scroll-mt-16 bg-[#0B1B18] text-[#E8EFEC]">
          <div className="th-forest-grid">
            <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
              <Reveal className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#5EEAD4]">
                    03 / One shared record
                  </p>
                  <h2 className="mt-4 max-w-2xl text-[clamp(2rem,4.2vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-[#F3F7F5]">
                    One encounter. Every vantage point.
                  </h2>
                </div>
                <p className="max-w-sm text-sm leading-6 text-[#A9BDB6]">
                  The patient, the physician, and network operations all read from
                  the same encounter backbone — updated live over Socket.IO.
                </p>
              </Reveal>

              <div className="mt-12 grid gap-4 lg:grid-cols-3">
                {PORTALS.map((portal, index) => {
                  const Icon = portal.icon;

                  return (
                    <Reveal key={portal.title} delay={index * 0.06}>
                      <div className="flex h-full flex-col rounded-[6px] border border-[#29423B] bg-[#102520] p-6 transition-colors hover:border-[#0D9488]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-[4px] border border-[#2A453D] bg-[#0C1F1A] text-[#5EEAD4]">
                            <Icon aria-hidden="true" className="h-4 w-4" />
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#7E958E]">
                            {portal.tag}
                          </span>
                        </div>
                        <h3 className="mt-7 text-xl font-semibold tracking-[-0.02em] text-[#F3F7F5]">
                          {portal.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[#A9BDB6]">
                          {portal.description}
                        </p>
                        <ul className="mt-5 space-y-2 border-t border-[#29423B] pt-4">
                          {portal.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="flex items-center gap-2 text-xs text-[#C7D6D1]"
                            >
                              <span
                                aria-hidden="true"
                                className="h-1 w-1 rounded-[1px] bg-[#0D9488]"
                              />
                              {bullet}
                            </li>
                          ))}
                        </ul>
                        <Link
                          to={portal.href}
                          className="mt-auto inline-flex items-center gap-2 pt-7 text-sm font-semibold text-[#5EEAD4] transition-colors hover:text-white"
                        >
                          Open {portal.tag.toLowerCase()}
                          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            <Reveal>
              <SectionEyebrow>04 / Clinical governance</SectionEyebrow>
              <h2 className="mt-4 max-w-xl text-[clamp(2rem,4.2vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-[#11201C]">
                Built for the moments that cannot be improvised.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#4D5A54]">
                A routing platform is only as good as the guarantees around it.
                These are the boundaries that make Triage Horizon safe to operate.
              </p>

              <div className="mt-9 grid gap-px border border-[#DDD8CC] bg-[#DDD8CC] sm:grid-cols-2">
                {PRINCIPLES.map((principle) => {
                  const Icon = principle.icon;

                  return (
                    <div key={principle.title} className="bg-[#FFFDF8] p-5">
                      <Icon
                        aria-hidden="true"
                        className="h-4 w-4 text-[#0F766E]"
                      />
                      <p className="mt-4 text-sm font-semibold text-[#11201C]">
                        {principle.title}
                      </p>
                      <p className="mt-1.5 text-xs leading-5 text-[#5A6660]">
                        {principle.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Reveal>

            <Reveal delay={0.08} className="flex">
              <div className="flex w-full flex-col justify-between rounded-[6px] border border-[#DDD8CC] bg-[#EFEBE2] p-7 sm:p-9">
                <div>
                  <Quote
                    aria-hidden="true"
                    className="h-7 w-7 text-[#0D9488]"
                    strokeWidth={1.6}
                  />
                  <blockquote className="mt-5 max-w-lg text-2xl font-medium leading-9 tracking-[-0.03em] text-[#11201C] sm:text-[28px] sm:leading-10">
                    “The best triage decision is the one the patient never has to
                    chase.”
                  </blockquote>
                </div>

                <div>
                  <div className="mt-8 flex items-center gap-3 border-t border-[#D5CFC1] pt-5">
                    <span className="grid h-10 w-10 place-items-center rounded-[6px] border border-[#CFC8B8] bg-[#FFFDF8] text-xs font-semibold text-[#0F766E]">
                      MS
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#11201C]">
                        Dr. Mira Sen
                      </p>
                      <p className="text-xs text-[#6B766F]">
                        Triage physician · Horizon Network
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-px border border-[#D5CFC1] bg-[#D5CFC1]">
                    {[
                      { value: '6', label: 'step rail' },
                      { value: '3', label: 'portals' },
                      { value: '1', label: 'record' },
                    ].map((item) => (
                      <div key={item.label} className="bg-[#F6F4EE] px-3 py-3">
                        <p className="font-mono text-lg font-semibold text-[#11201C]">
                          {item.value}
                        </p>
                        <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#6B766F]">
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-[#DDD8CC] bg-[#EFEBE2]">
          <div className="mx-auto w-full max-w-[1400px] px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
            <Reveal className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <SectionEyebrow>05 / Enter the network</SectionEyebrow>
                <h2 className="mt-4 text-[clamp(2rem,4.2vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-[#11201C]">
                  See the network think.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#4D5A54]">
                  Use a demo identity, or create a patient or physician account. New
                  accounts are saved to the network database and can sign in again
                  with the credentials you choose.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border border-[#0B4F4A] bg-[#0F766E] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0B4F4A]"
                >
                  Open sign in
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  to="/login?mode=signup"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border border-[#CFC8B8] bg-[#FFFDF8] px-5 text-sm font-semibold text-[#11201C] transition-colors hover:border-[#11201C] hover:bg-white"
                >
                  Create account
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>

            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {DEMO_ACCOUNTS.map((account) => (
                <Link
                  key={account.email}
                  to={`/login?role=${account.role}`}
                  className="group rounded-[6px] border border-[#DDD8CC] bg-[#FFFDF8] p-4 transition-colors hover:border-[#0D9488]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#11201C]">
                      {account.label}
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-[#9A9F95] transition-colors group-hover:text-[#0D9488]"
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#6B766F]">{account.detail}</p>
                  <p className="mt-3 truncate border-t border-[#E8E4D9] pt-2 font-mono text-[9px] text-[#9A9F95]">
                    {account.email}
                  </p>
                </Link>
              ))}
            </div>

            <p className="mt-5 flex items-center gap-2 text-[11px] text-[#6B766F]">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Admin accounts are provisioned by network operations. This is a
              synthetic demo environment.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-[#0B1B18] text-[#A9BDB6]">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-12 sm:px-8 lg:px-10">
          <div className="grid gap-10 border-b border-[#29423B] pb-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))]">
            <div>
              <Brand light />
              <p className="mt-4 max-w-xs text-sm leading-6 text-[#8FA69F]">
                Clinical triage and routing for patients, physicians, and network
                operations.
              </p>
              <p className="mt-5 inline-flex items-center gap-2 rounded-[4px] border border-[#29423B] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#5EEAD4]">
                <span className="h-1.5 w-1.5 rounded-[1px] bg-[#16A34A]" />
                All systems operational
              </p>
            </div>

            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7E958E]">
                Platform
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href="#platform" className="hover:text-white">
                    Routing engine
                  </a>
                </li>
                <li>
                  <a href="#care-tiers" className="hover:text-white">
                    Care tiers
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white">
                    How it works
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7E958E]">
                Access
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link to="/login?role=PATIENT" className="hover:text-white">
                    Patient portal
                  </Link>
                </li>
                <li>
                  <Link to="/login?role=DOCTOR" className="hover:text-white">
                    Physician portal
                  </Link>
                </li>
                <li>
                  <Link to="/login?role=ADMIN" className="hover:text-white">
                    Network operations
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7E958E]">
                Trust
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href="#portals" className="hover:text-white">
                    Shared encounter
                  </a>
                </li>
                <li>
                  <a href="#portals" className="hover:text-white">
                    Role-based access
                  </a>
                </li>
                <li>
                  <a href="#portals" className="hover:text-white">
                    Clinical governance
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-6 text-[11px] text-[#6F8880] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Triage Horizon. Synthetic demo environment.</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em]">
              No real patient health information
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
