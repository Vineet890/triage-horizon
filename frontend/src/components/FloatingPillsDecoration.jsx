import { motion } from 'framer-motion';

/**
 * High-end vector 3D-styled floating pharmaceutical capsules & tablets.
 * Provides a playful, elegant, and fun visual atmosphere for the Medication Plan.
 */
export default function FloatingPillsDecoration() {
  const pills = [
    // 1. Large Coral & Pearl Capsule
    {
      type: 'capsule',
      id: 'capsule-coral',
      top: '6%',
      right: '26%',
      width: 36,
      height: 84,
      rotation: -28,
      duration: 5.2,
      delay: 0,
      yOffset: -14,
      xOffset: 6,
      rotRange: [-32, -22],
      gradientTop: ['#FF6B55', '#E6392F'],
      gradientBottom: ['#FFFDF9', '#F4EDE4'],
      glow: 'rgba(230, 57, 47, 0.28)',
      label: '500mg',
    },
    // 2. Mint & Sage Capsule
    {
      type: 'capsule',
      id: 'capsule-mint',
      top: '52%',
      right: '6%',
      width: 34,
      height: 80,
      rotation: 34,
      duration: 6.4,
      delay: 0.8,
      yOffset: -16,
      xOffset: -8,
      rotRange: [28, 40],
      gradientTop: ['#34D399', '#059669'],
      gradientBottom: ['#F0FDF4', '#DCFCE7'],
      glow: 'rgba(5, 150, 105, 0.28)',
      label: '250mg',
    },
    // 3. Royal Lavender & Lilac Capsule
    {
      type: 'capsule',
      id: 'capsule-lavender',
      top: '12%',
      right: '8%',
      width: 30,
      height: 72,
      rotation: -14,
      duration: 5.8,
      delay: 1.4,
      yOffset: -12,
      xOffset: 7,
      rotRange: [-18, -8],
      gradientTop: ['#A78BFA', '#7C3AED'],
      gradientBottom: ['#FAF5FF', '#EDE9FE'],
      glow: 'rgba(124, 58, 237, 0.25)',
      label: '100mg',
    },
    // 4. Golden Honey Capsule
    {
      type: 'capsule',
      id: 'capsule-honey',
      top: '58%',
      right: '34%',
      width: 28,
      height: 68,
      rotation: 48,
      duration: 4.8,
      delay: 0.4,
      yOffset: -15,
      xOffset: 5,
      rotRange: [42, 54],
      gradientTop: ['#FBBF24', '#D97706'],
      gradientBottom: ['#FFFBEB', '#FEF3C7'],
      glow: 'rgba(217, 119, 6, 0.25)',
      label: '50mg',
    },
    // 5. Sky Blue Scored Round Tablet
    {
      type: 'tablet',
      id: 'tablet-sky',
      top: '18%',
      right: '42%',
      size: 46,
      rotation: 18,
      duration: 6.0,
      delay: 1.1,
      yOffset: -12,
      xOffset: -5,
      rotRange: [12, 24],
      gradient: ['#7DD3FC', '#0284C7'],
      grooveColor: '#0369A1',
      glow: 'rgba(2, 132, 199, 0.25)',
    },
    // 6. Rose Quartz Scored Round Tablet
    {
      type: 'tablet',
      id: 'tablet-rose',
      top: '50%',
      right: '20%',
      size: 40,
      rotation: -35,
      duration: 5.5,
      delay: 1.7,
      yOffset: -14,
      xOffset: 6,
      rotRange: [-40, -28],
      gradient: ['#FDA4AF', '#E11D48'],
      grooveColor: '#BE123C',
      glow: 'rgba(225, 29, 72, 0.25)',
    },
    // 7. Emerald Green Micro Tablet
    {
      type: 'tablet',
      id: 'tablet-emerald',
      top: '2%',
      right: '18%',
      size: 32,
      rotation: 12,
      duration: 4.5,
      delay: 0.6,
      yOffset: -10,
      xOffset: 4,
      rotRange: [6, 18],
      gradient: ['#6EE7B7', '#059669'],
      grooveColor: '#047857',
      glow: 'rgba(5, 150, 105, 0.25)',
    },
    // 8. Soft Peach Oblong Caplet
    {
      type: 'caplet',
      id: 'caplet-peach',
      top: '68%',
      right: '48%',
      width: 24,
      height: 52,
      rotation: -52,
      duration: 6.8,
      delay: 1.9,
      yOffset: -13,
      xOffset: -6,
      rotRange: [-58, -44],
      gradient: ['#FDBA74', '#EA580C'],
      grooveColor: '#C2410C',
      glow: 'rgba(234, 88, 12, 0.22)',
    },
  ];

  const sparkles = [
    { top: '16%', right: '36%', size: 14, color: '#F59E0B', delay: 0 },
    { top: '44%', right: '14%', size: 16, color: '#10B981', delay: 0.7 },
    { top: '78%', right: '28%', size: 12, color: '#8B5CF6', delay: 1.3 },
    { top: '10%', right: '4%', size: 15, color: '#EC4899', delay: 1.9 },
  ];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Soft Ambient Colorful Background Blobs */}
      <div className="absolute -top-12 -right-12 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-400/5" />
      <div className="absolute top-1/2 right-1/4 h-56 w-56 -translate-y-1/2 rounded-full bg-rose-400/10 blur-3xl dark:bg-rose-400/5" />
      <div className="absolute -bottom-10 right-8 h-48 w-48 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-400/5" />

      {/* Floating Sparkles */}
      {sparkles.map((sp, idx) => (
        <motion.div
          key={`sparkle-${idx}`}
          style={{
            position: 'absolute',
            top: sp.top,
            right: sp.right,
            width: sp.size,
            height: sp.size,
          }}
          animate={{
            scale: [0.7, 1.25, 0.7],
            opacity: [0.35, 0.95, 0.35],
            rotate: [0, 90, 180],
          }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: sp.delay,
          }}
        >
          <svg viewBox="0 0 24 24" fill={sp.color} className="h-full w-full opacity-80">
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>
        </motion.div>
      ))}

      {/* Floating Pills Stage */}
      {pills.map((pill) => (
        <motion.div
          key={pill.id}
          className="pointer-events-auto absolute cursor-pointer"
          style={{
            top: pill.top,
            right: pill.right,
          }}
          animate={{
            y: [0, pill.yOffset, 0],
            x: [0, pill.xOffset, 0],
            rotate: pill.rotRange,
          }}
          transition={{
            duration: pill.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: pill.delay,
          }}
          whileHover={{
            scale: 1.22,
            rotate: pill.rotation + (pill.rotation > 0 ? 12 : -12),
            transition: { duration: 0.22, ease: 'easeOut' },
          }}
        >
          {/* TWO-TONE CAPSULE */}
          {pill.type === 'capsule' && (
            <div
              style={{
                width: pill.width,
                height: pill.height,
                filter: `drop-shadow(0 10px 18px ${pill.glow})`,
              }}
            >
              <svg
                width={pill.width}
                height={pill.height}
                viewBox="0 0 36 84"
                fill="none"
                className="h-full w-full"
              >
                <defs>
                  <linearGradient
                    id={`grad-top-${pill.id}`}
                    x1="0"
                    y1="0"
                    x2="36"
                    y2="42"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={pill.gradientTop[0]} />
                    <stop offset="100%" stopColor={pill.gradientTop[1]} />
                  </linearGradient>
                  <linearGradient
                    id={`grad-bot-${pill.id}`}
                    x1="0"
                    y1="42"
                    x2="36"
                    y2="84"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={pill.gradientBottom[0]} />
                    <stop offset="100%" stopColor={pill.gradientBottom[1]} />
                  </linearGradient>
                  <linearGradient
                    id={`shine-${pill.id}`}
                    x1="0"
                    y1="0"
                    x2="16"
                    y2="0"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Top Half Hemisphere */}
                <path
                  d="M2 18C2 8.059 10.059 0 20 0C29.941 0 38 8.059 38 18V42H2V18Z"
                  fill={`url(#grad-top-${pill.id})`}
                />
                {/* Bottom Half Hemisphere */}
                <path
                  d="M2 42H38V66C38 75.941 29.941 84 20 84C10.059 84 2 75.941 2 66V42Z"
                  fill={`url(#grad-bot-${pill.id})`}
                />
                {/* Center Division Seam Ring */}
                <line
                  x1="2"
                  y1="42"
                  x2="38"
                  y2="42"
                  stroke="#ffffff"
                  strokeOpacity="0.45"
                  strokeWidth="1.2"
                />
                {/* Micro Dosage Emboss */}
                <text
                  x="20"
                  y="62"
                  fontSize="6.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill="#78716C"
                  fillOpacity="0.45"
                  textAnchor="middle"
                >
                  {pill.label}
                </text>
                {/* Left 3D Specular Highlight Gloss Curve */}
                <path
                  d="M7 14C7 9 9 6 12 6C13.5 6 13.5 8 13.5 14V70C13.5 76 12 78 10.5 78C8.5 78 7 75 7 70V14Z"
                  fill={`url(#shine-${pill.id})`}
                />
              </svg>
            </div>
          )}

          {/* ROUND SCORED TABLET */}
          {pill.type === 'tablet' && (
            <div
              style={{
                width: pill.size,
                height: pill.size,
                filter: `drop-shadow(0 8px 16px ${pill.glow})`,
              }}
            >
              <svg
                width={pill.size}
                height={pill.size}
                viewBox="0 0 48 48"
                fill="none"
                className="h-full w-full"
              >
                <defs>
                  <linearGradient
                    id={`tablet-grad-${pill.id}`}
                    x1="0"
                    y1="0"
                    x2="48"
                    y2="48"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={pill.gradient[0]} />
                    <stop offset="100%" stopColor={pill.gradient[1]} />
                  </linearGradient>
                  <linearGradient
                    id={`tablet-rim-${pill.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="48"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
                  </linearGradient>
                </defs>

                {/* Outer Bevel Circle */}
                <circle cx="24" cy="24" r="23" fill={`url(#tablet-grad-${pill.id})`} />
                <circle
                  cx="24"
                  cy="24"
                  r="22.5"
                  stroke={`url(#tablet-rim-${pill.id})`}
                  strokeWidth="1.2"
                />

                {/* Inner Recessed Face */}
                <circle
                  cx="24"
                  cy="24"
                  r="17"
                  fill={`url(#tablet-grad-${pill.id})`}
                  fillOpacity="0.95"
                />

                {/* Center Score Groove (Pharmaceutical dividing groove) */}
                <line
                  x1="10"
                  y1="24"
                  x2="38"
                  y2="24"
                  stroke={pill.grooveColor}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <line
                  x1="10"
                  y1="25"
                  x2="38"
                  y2="25"
                  stroke="#ffffff"
                  strokeOpacity="0.65"
                  strokeWidth="1"
                  strokeLinecap="round"
                />

                {/* Top Specular Curved Reflection Arc */}
                <path
                  d="M13 14C16 11 19.5 9 24 9C28.5 9 32 11 35 14"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeOpacity="0.6"
                />
              </svg>
            </div>
          )}

          {/* OBLONG BEVELED CAPLET */}
          {pill.type === 'caplet' && (
            <div
              style={{
                width: pill.width,
                height: pill.height,
                filter: `drop-shadow(0 8px 14px ${pill.glow})`,
              }}
            >
              <svg
                width={pill.width}
                height={pill.height}
                viewBox="0 0 28 60"
                fill="none"
                className="h-full w-full"
              >
                <defs>
                  <linearGradient
                    id={`caplet-grad-${pill.id}`}
                    x1="0"
                    y1="0"
                    x2="28"
                    y2="60"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={pill.gradient[0]} />
                    <stop offset="100%" stopColor={pill.gradient[1]} />
                  </linearGradient>
                </defs>

                {/* Caplet Rounded Rectangle Body */}
                <rect
                  x="2"
                  y="2"
                  width="24"
                  height="56"
                  rx="12"
                  fill={`url(#caplet-grad-${pill.id})`}
                  stroke="#ffffff"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />

                {/* Center Transverse Score Line */}
                <line
                  x1="4"
                  y1="30"
                  x2="24"
                  y2="30"
                  stroke={pill.grooveColor}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="4"
                  y1="31"
                  x2="24"
                  y2="31"
                  stroke="#ffffff"
                  strokeOpacity="0.6"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />

                {/* Top Specular Arc */}
                <path
                  d="M6 14C7 8 11 5 14 5C17 5 21 8 22 14"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeOpacity="0.65"
                />
              </svg>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

