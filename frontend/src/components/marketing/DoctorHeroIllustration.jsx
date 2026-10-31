import { motion } from 'framer-motion';

/**
 * Doctor-Patient Hero Consultation Scene
 * High-definition visual featuring doctor-patient consultation, live hospital availability cards,
 * travel time routing, and AI clinical recommendation badges.
 * Supports background hero mode with proper dimensions and seamless alpha blending.
 */
export default function DoctorHeroIllustration({ className = '', isBackground = false }) {
  if (isBackground) {
    return (
      <div
        className={`pointer-events-none absolute top-0 right-0 bottom-24 sm:bottom-28 lg:bottom-32 w-full lg:w-[64%] xl:w-[62%] 2xl:w-[60%] hidden lg:flex items-start justify-end overflow-hidden z-0 select-none ${className}`}
      >
        {/* Soft Ambient Diffuse Glow */}
        <div className="pointer-events-none absolute -top-12 right-0 w-[750px] h-[520px] bg-gradient-to-bl from-[#D6EFE2]/40 via-[#EAF6F0]/50 to-transparent blur-3xl rounded-full" />

        <img
          src="/hero-consultation-seamless.png"
          alt="Doctor and patient consultation with real-time hospital routing and clinical recommendations"
          className="h-full w-full object-contain object-right-top max-w-none"
          style={{ imageRendering: '-webkit-optimize-contrast' }}
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full flex items-center justify-center select-none ${className}`}>
      <img
        src="/hero-consultation-seamless.png"
        alt="Doctor and patient consultation with real-time hospital routing and clinical recommendations"
        className="h-auto w-full max-h-[460px] object-contain mx-auto"
        style={{ imageRendering: '-webkit-optimize-contrast' }}
        loading="eager"
      />
    </div>
  );
}
