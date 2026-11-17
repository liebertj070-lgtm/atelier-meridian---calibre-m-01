import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react';
import ChronometerScene from './components/ChronometerScene';
import type { FinishKey, ScrollChoreographyState } from './components/ChronometerScene';
import Preloader from './components/Preloader';
import CustomCursor from './components/CustomCursor';
import MagneticButton from './components/MagneticButton';

gsap.registerPlugin(ScrollTrigger);

interface FinishOption {
  key: FinishKey;
  label: string;
  swatch: string;
}

const FINISH_OPTIONS: FinishOption[] = [
  { key: 'titanium', label: 'Grade 5 Titanium', swatch: '#a4a9b0' },
  { key: 'obsidian', label: 'Obsidian DLC', swatch: '#1d1e24' },
  { key: 'champagne', label: '18k Rose Brass', swatch: '#d4a86a' },
];

const FREQ_OPTIONS = [
  { hz: 4, label: '4 Hz · 28,800 vph' },
  { hz: 5, label: '5 Hz · 36,000 vph' },
  { hz: 0, label: 'Zero-G Freeze' },
];

const NAV_CHAPTERS = [
  { id: '#chapter-genesis', label: 'Genesis' },
  { id: '#chapter-anatomy', label: 'Anatomy' },
  { id: '#chapter-cadence', label: 'Cadence' },
  { id: '#chapter-materials', label: 'Metallurgy' },
];

export default function App() {
  const mainRef = useRef<HTMLElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [sceneReady, setSceneReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [telemetry, setTelemetry] = useState({ az: 345, el: 8 });
  const [activeChapter, setActiveChapter] = useState(0);
  const [hudCollapsed, setHudCollapsed] = useState(false);

  const [frequencyHz, setFrequencyHz] = useState(4);
  const [finishKey, setFinishKey] = useState<FinishKey>('titanium');
  const [isLite, setIsLite] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth < 768 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  });

  // Acquire Mannequin Fitting State
  const [acquireMode, setAcquireMode] = useState(false);
  const [acquireTriggerId, setAcquireTriggerId] = useState(0);
  const [acquireSettled, setAcquireSettled] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const scrollState = useRef<ScrollChoreographyState>({
    modelX: 1.35,
    modelY: 0,
    modelZ: 0,
    modelScale: 1.0,
    modelRotY: 0,
    modelTiltX: 0.14,
    camX: 0,
    camY: 0,
    camZ: 6.2,
    lookX: 0,
    lookY: 0,
    explosion: 0,
  });

  // Hero reveal once curtain lifts
  useEffect(() => {
    if (!introDone) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.from('.hero-reveal', {
        y: 32,
        opacity: 0,
        duration: 1.05,
        stagger: 0.1,
        ease: 'power3.out',
      });
    }, mainRef);

    return () => ctx.revert();
  }, [introDone]);

  // Scroll-driven 3D camera, axial explosion, and section choreography
  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: mainRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          if (progressBarRef.current) {
            progressBarRef.current.style.width = `${self.progress * 100}%`;
          }
          const idx = Math.min(4, Math.floor(self.progress * 4.8));
          setActiveChapter(idx);
        },
      });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: '#chapter-anatomy',
            start: 'top bottom',
            end: 'center center',
            scrub: 1.1,
          },
        })
        .to(scrollState.current, {
          modelX: -1.15,
          modelY: 0.05,
          modelScale: 0.94,
          modelRotY: 0.92,
          modelTiltX: -0.18,
          camX: 2.35,
          camY: 1.1,
          camZ: 5.5,
          lookX: -0.35,
          explosion: 1,
          ease: 'power2.inOut',
        });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: '#chapter-cadence',
            start: 'top bottom',
            end: 'center center',
            scrub: 1.1,
          },
        })
        .to(scrollState.current, {
          modelX: 1.1,
          modelY: 0.58,
          modelScale: 1.25,
          modelRotY: -0.3,
          modelTiltX: 0.1,
          camX: -0.5,
          camY: -0.25,
          camZ: 4.15,
          lookX: 0.4,
          lookY: -0.1,
          explosion: 0.25,
          ease: 'power2.inOut',
        });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: '#chapter-materials',
            start: 'top bottom',
            end: 'center center',
            scrub: 1.1,
          },
        })
        .to(scrollState.current, {
          modelX: -1.25,
          modelY: 0,
          modelScale: 1.05,
          modelRotY: -0.75,
          modelTiltX: 0.22,
          camX: 0.35,
          camY: 0.45,
          camZ: 5.3,
          lookX: -0.3,
          lookY: 0,
          explosion: 0,
          ease: 'power2.inOut',
        });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: '#chapter-commission',
            start: 'top bottom',
            end: 'center center',
            scrub: 1.1,
          },
        })
        .to(scrollState.current, {
          modelX: 0,
          modelY: 0.25,
          modelScale: 0.88,
          modelRotY: 0,
          modelTiltX: 0.08,
          camX: 0,
          camY: 0.15,
          camZ: 6.6,
          lookX: 0,
          lookY: 0,
          explosion: 0,
          ease: 'power2.inOut',
        });

      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.utils.toArray<HTMLElement>('.reveal-card').forEach((card) => {
          gsap.from(card, {
            y: 36,
            opacity: 0,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 84%',
              toggleActions: 'play none none reverse',
            },
          });
        });
      }
    }, mainRef);

    return () => ctx.revert();
  }, []);

  // Lock page scroll smoothly while inspecting the Acquire Mannequin Wrist Fitting
  useEffect(() => {
    if (acquireMode) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [acquireMode]);

  // Keyboard shortcuts: Escape exits Acquire fitting, H toggles bottom HUD dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && acquireMode) {
        setAcquireMode(false);
        setAcquireSettled(false);
      } else if (
        (e.key === 'h' || e.key === 'H') &&
        !acquireMode &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        setHudCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [acquireMode]);

  const scrollToSection = (id: string) => {
    if (acquireMode) {
      setAcquireMode(false);
      setAcquireSettled(false);
    }
    window.setTimeout(() => {
      const el = document.querySelector(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleStartAcquire = () => {
    setSubmitted(false);
    setAcquireSettled(false);
    setAcquireMode(true);
    setAcquireTriggerId((n) => n + 1);
  };

  const handleReplayAcquire = () => {
    setAcquireSettled(false);
    setAcquireTriggerId((n) => n + 1);
  };

  const handleExitAcquire = () => {
    setAcquireMode(false);
    setAcquireSettled(false);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <Preloader sceneReady={sceneReady} onFinished={() => setIntroDone(true)} />
      <CustomCursor isDragging={isDragging} />

      {/* Persistent Interactive 3D Stage */}
      <ChronometerScene
        scrollState={scrollState}
        frequencyHz={frequencyHz}
        finishKey={finishKey}
        isLite={isLite}
        acquireMode={acquireMode}
        acquireTriggerId={acquireTriggerId}
        onReady={() => setSceneReady(true)}
        onDragChange={setIsDragging}
        onTelemetry={(az, el) => setTelemetry({ az, el })}
        onAcquireSettled={() => setAcquireSettled(true)}
      />
      <div className="canvas-vignette pointer-events-none fixed inset-0 z-[2]" aria-hidden="true" />

      {/* 3-Zone Editorial Header */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-8 px-5 py-4 sm:px-8 md:px-14 md:py-6">
        <a
          href="#chapter-genesis"
          className="font-display pointer-events-auto whitespace-nowrap shrink-0 text-lg font-normal tracking-[0.2em] text-[#f2ede4] uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4a86a] sm:text-xl"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('#chapter-genesis');
          }}
        >
          Atelier Meridian
        </a>

        <nav className="pointer-events-auto hidden items-center gap-7 md:flex" aria-label="Chapters">
          {NAV_CHAPTERS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`nav-link-line font-tech whitespace-nowrap shrink-0 cursor-pointer py-1.5 text-[11px] uppercase tracking-[0.16em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4a86a] ${
                !acquireMode && activeChapter === i
                  ? 'is-active text-[#f2ede4]'
                  : 'text-[#9a948a] hover:text-[#f2ede4]'
              }`}
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pointer-events-auto shrink-0">
          {acquireMode ? (
            <MagneticButton size="sm" onClick={handleExitAcquire}>
              Return
            </MagneticButton>
          ) : (
            <MagneticButton size="sm" onClick={handleStartAcquire}>
              Acquire
            </MagneticButton>
          )}
        </div>
      </header>

      {/* Scroll-Driven Narrative Sections */}
      <main
        ref={mainRef}
        className={`relative z-10 transition-opacity duration-500 ${
          acquireMode ? 'pointer-events-none opacity-0' : 'pointer-events-none opacity-100'
        }`}
        aria-hidden={acquireMode}
      >
        {/* Chapter 01: Genesis */}
        <section
          id="chapter-genesis"
          className="relative flex min-h-screen items-end px-5 pt-[46vh] pb-24 sm:px-8 md:items-center md:px-14 md:py-28 lg:px-20"
        >
          <div className="pointer-events-auto max-w-xl">
            <div className="hero-reveal font-tech mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[#d4a86a]">
              <span>Chapter 01</span>
              <span aria-hidden="true">·</span>
              <span>Geneva, Switzerland</span>
            </div>

            <h1 className="hero-reveal font-display text-balance mb-6 text-5xl font-normal leading-[0.95] tracking-[-0.02em] text-[#f2ede4] sm:text-6xl lg:text-7xl">
              Sculpted <em className="italic text-[#d4a86a]">Silence</em> in Motion.
            </h1>

            <p className="hero-reveal mb-8 max-w-lg text-[15px] leading-relaxed text-[#f2ede4]/80 sm:text-base">
              Calibre M-01 strips mechanical timekeeping to pure architectural
              tension. Milled from aerospace titanium and suspended beneath
              domed corundum sapphire—built to be rotated, disassembled, and
              inspected in real time.
            </p>

            <div className="hero-reveal flex flex-wrap items-center gap-4">
              <MagneticButton
                variant="solid"
                onClick={() => scrollToSection('#chapter-anatomy')}
              >
                Explore Architecture
              </MagneticButton>
              <MagneticButton onClick={handleStartAcquire}>
                Acquire Timepiece
              </MagneticButton>
            </div>
          </div>
        </section>

        {/* Chapter 02: Anatomy (Exploded View) */}
        <section
          id="chapter-anatomy"
          className="relative flex min-h-screen items-end justify-end px-5 pt-[46vh] pb-24 sm:px-8 md:items-center md:px-14 md:py-28 lg:px-20"
        >
          <article className="reveal-card pointer-events-auto w-full max-w-[480px] border border-[#f2ede4]/15 bg-[#0f0f13]/92 p-7 sm:p-10">
            <div className="font-tech mb-4 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.18em] text-[#d4a86a]">
              <span>Chapter 02</span>
              <span aria-hidden="true">·</span>
              <span>Axial Architecture</span>
            </div>

            <h2 className="font-display text-balance mb-5 text-3xl font-normal leading-[1.04] text-[#f2ede4] sm:text-5xl">
              Seven Layers of <em className="italic text-[#d4a86a]">Zero-Friction</em> Geometry.
            </h2>

            <p className="mb-7 text-[15px] leading-relaxed text-[#f2ede4]/78">
              Scrolling separates the seven axial strata of the movement—from
              the Grade 5 titanium caseback and cross-milled mainplate to
              involute brass gear trains seated in synthetic ruby bearings. Drag
              anywhere across the stage to inspect tolerances at 360°.
            </p>

            <div className="grid grid-cols-2 gap-5 border-t border-[#f2ede4]/12 pt-5">
              <div>
                <div className="font-tech text-[10px] uppercase tracking-[0.14em] text-[#9a948a]">
                  Components
                </div>
                <div className="font-display mt-1 text-2xl text-[#f2ede4]">
                  312 Milled
                </div>
              </div>
              <div>
                <div className="font-tech text-[10px] uppercase tracking-[0.14em] text-[#9a948a]">
                  Jewel Bearings
                </div>
                <div className="font-display mt-1 text-2xl text-[#f2ede4]">
                  33 Rubies
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* Chapter 03: Cadence (Escapement Focus) */}
        <section
          id="chapter-cadence"
          className="relative flex min-h-screen items-end px-5 pt-[46vh] pb-24 sm:px-8 md:items-center md:px-14 md:py-28 lg:px-20"
        >
          <article className="reveal-card pointer-events-auto w-full max-w-[490px] border border-[#f2ede4]/15 bg-[#0f0f13]/92 p-7 sm:p-10">
            <div className="font-tech mb-4 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.18em] text-[#d4a86a]">
              <span>Chapter 03</span>
              <span aria-hidden="true">·</span>
              <span>Acoustic Cadence</span>
            </div>

            <h2 className="font-display text-balance mb-5 text-3xl font-normal leading-[1.04] text-[#f2ede4] sm:text-5xl">
              The Flying <em className="italic text-[#d4a86a]">Tourbillon</em> Heartbeat.
            </h2>

            <p className="mb-6 text-[15px] leading-relaxed text-[#f2ede4]/78">
              A cantilevered titanium cage completes one full revolution per
              minute, neutralizing positional gravity error while an Archimedean
              hairspring breathes rhythmically at its core. Shift the oscillator
              frequency live below.
            </p>

            <div className="mb-6">
              <div className="font-tech mb-2.5 text-[10px] uppercase tracking-[0.14em] text-[#9a948a]">
                Oscillator Frequency
              </div>
              <div className="flex flex-wrap gap-2">
                {FREQ_OPTIONS.map((opt) => {
                  const selected = frequencyHz === opt.hz;
                  return (
                    <button
                      key={opt.hz}
                      type="button"
                      className={`font-tech min-h-[42px] cursor-pointer whitespace-nowrap shrink-0 border px-3.5 py-2 text-[11px] uppercase tracking-[0.1em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a86a] ${
                        selected
                          ? 'border-[#d4a86a] bg-[#d4a86a]/15 text-[#f2ede4]'
                          : 'border-[#f2ede4]/15 bg-[#16161b] text-[#9a948a] hover:border-[#f2ede4]/35 hover:text-[#f2ede4]'
                      }`}
                      onClick={() => setFrequencyHz(opt.hz)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5 border-t border-[#f2ede4]/12 pt-5">
              <div>
                <div className="font-tech text-[10px] uppercase tracking-[0.14em] text-[#9a948a]">
                  Power Reserve
                </div>
                <div className="font-display mt-1 text-2xl text-[#f2ede4]">
                  96 Hours
                </div>
              </div>
              <div>
                <div className="font-tech text-[10px] uppercase tracking-[0.14em] text-[#9a948a]">
                  Chronometry
                </div>
                <div className="font-display mt-1 text-2xl text-[#f2ede4]">
                  -1 / +2 sec·day
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* Chapter 04: Materials & Craft */}
        <section
          id="chapter-materials"
          className="relative flex min-h-screen items-end justify-end px-5 pt-[46vh] pb-24 sm:px-8 md:items-center md:px-14 md:py-28 lg:px-20"
        >
          <article className="reveal-card pointer-events-auto w-full max-w-[490px] border border-[#f2ede4]/15 bg-[#0f0f13]/92 p-7 sm:p-10">
            <div className="font-tech mb-4 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.18em] text-[#d4a86a]">
              <span>Chapter 04</span>
              <span aria-hidden="true">·</span>
              <span>Surface Metallurgy</span>
            </div>

            <h2 className="font-display text-balance mb-5 text-3xl font-normal leading-[1.04] text-[#f2ede4] sm:text-5xl">
              Anisotropic Grain &amp; <em className="italic text-[#d4a86a]">Sapphire</em> Light.
            </h2>

            <p className="mb-6 text-[15px] leading-relaxed text-[#f2ede4]/78">
              Hand-brushed radial bevels catch studio softboxes while our domed
              corundum crystal bends light across the openworked dial. Select a
              case metallurgy below to inspect live physically-based reflections.
            </p>

            <div>
              <div className="font-tech mb-2.5 text-[10px] uppercase tracking-[0.14em] text-[#9a948a]">
                Case Metallurgy
              </div>
              <div className="flex flex-wrap gap-2">
                {FINISH_OPTIONS.map((fin) => {
                  const selected = finishKey === fin.key;
                  return (
                    <button
                      key={fin.key}
                      type="button"
                      className={`font-tech inline-flex min-h-[42px] cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 border px-3.5 py-2 text-[11px] uppercase tracking-[0.1em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a86a] ${
                        selected
                          ? 'border-[#d4a86a] bg-[#d4a86a]/15 text-[#f2ede4]'
                          : 'border-[#f2ede4]/15 bg-[#16161b] text-[#9a948a] hover:border-[#f2ede4]/35 hover:text-[#f2ede4]'
                      }`}
                      onClick={() => setFinishKey(fin.key)}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-white/30"
                        style={{ backgroundColor: fin.swatch }}
                        aria-hidden="true"
                      />
                      {fin.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </article>
        </section>

        {/* Chapter 05: Commission Finale */}
        <section
          id="chapter-commission"
          className="relative flex min-h-screen items-center justify-center px-5 py-28 text-center sm:px-8 md:px-14"
        >
          <div className="pointer-events-auto max-w-xl">
            <div className="font-tech mb-4 flex items-center justify-center gap-2.5 text-[11px] uppercase tracking-[0.18em] text-[#d4a86a]">
              <span>Chapter 05</span>
              <span aria-hidden="true">·</span>
              <span>Numbered Allocation</span>
            </div>

            <h2 className="font-display text-balance mb-5 text-4xl font-normal leading-[1.02] text-[#f2ede4] sm:text-6xl">
              Twelve Pieces <em className="italic text-[#d4a86a]">Annually</em>.
            </h2>

            <p className="mx-auto mb-8 max-w-md text-[15px] leading-relaxed text-[#f2ede4]/80 sm:text-base">
              Each Calibre M-01 is assembled by a single master watchmaker over
              fourteen weeks in Geneva. Reserve a private salon viewing or
              commission specification.
            </p>

            <div className="flex justify-center">
              <MagneticButton variant="solid" onClick={handleStartAcquire}>
                Acquire &amp; Fit on Wrist
              </MagneticButton>
            </div>
          </div>
        </section>
      </main>

      {/* Non-blocking Side Allocation Panel during Mannequin Wrist Fitting */}
      {acquireMode && (
        <aside
          aria-label="Private Salon Allocation"
          className={`pointer-events-none fixed inset-x-4 bottom-20 z-40 flex items-end md:inset-y-0 md:right-auto md:bottom-auto md:left-14 md:items-center ${
            acquireSettled ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-700`}
        >
          <div className="pointer-events-auto relative w-full max-w-[400px] border border-[#d4a86a]/40 bg-[#0e0e12]/94 p-6 sm:p-8">
            <button
              type="button"
              onClick={handleExitAcquire}
              aria-label="Exit wrist fitting"
              className="absolute top-3.5 right-3.5 flex h-9 w-9 cursor-pointer items-center justify-center border border-[#f2ede4]/15 text-[#9a948a] transition-colors hover:border-[#d4a86a] hover:text-[#f2ede4] focus-visible:outline-2 focus-visible:outline-[#d4a86a]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="font-tech mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#d4a86a]">
              <span>Wrist Fitting</span>
              <span aria-hidden="true">·</span>
              <span>Geneva Salon</span>
            </div>

            <h3 className="font-display mb-3 text-2xl font-normal text-[#f2ede4] sm:text-3xl">
              Calibre M-01 <em className="italic text-[#d4a86a]">Allocation</em>
            </h3>

            {submitted ? (
              <div className="pt-1">
                <p className="mb-5 text-sm leading-relaxed text-[#f2ede4]/80">
                  Your private dossier request has been registered with our
                  Geneva salon. A dedicated horological director will contact
                  you within 24 hours.
                </p>
                <div className="flex flex-wrap gap-3">
                  <MagneticButton variant="solid" size="sm" onClick={handleExitAcquire}>
                    Return to Movement
                  </MagneticButton>
                  <MagneticButton size="sm" onClick={handleReplayAcquire}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Replay Fitting</span>
                  </MagneticButton>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="acquire-name"
                    className="font-tech mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#9a948a]"
                  >
                    Collector Name
                  </label>
                  <input
                    id="acquire-name"
                    type="text"
                    required
                    placeholder="Julian Vance"
                    className="w-full border border-[#f2ede4]/15 bg-[#16161c] px-3.5 py-2.5 text-sm text-[#f2ede4] placeholder-[#9a948a]/60 outline-none transition-colors focus:border-[#d4a86a]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="acquire-email"
                    className="font-tech mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#9a948a]"
                  >
                    Private Email
                  </label>
                  <input
                    id="acquire-email"
                    type="email"
                    required
                    placeholder="julian@domain.com"
                    className="w-full border border-[#f2ede4]/15 bg-[#16161c] px-3.5 py-2.5 text-sm text-[#f2ede4] placeholder-[#9a948a]/60 outline-none transition-colors focus:border-[#d4a86a]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="acquire-finish"
                    className="font-tech mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#9a948a]"
                  >
                    Preferred Metallurgy
                  </label>
                  <select
                    id="acquire-finish"
                    value={finishKey}
                    onChange={(e) => setFinishKey(e.target.value as FinishKey)}
                    className="w-full border border-[#f2ede4]/15 bg-[#16161c] px-3.5 py-2.5 text-sm text-[#f2ede4] outline-none transition-colors focus:border-[#d4a86a]"
                  >
                    {FINISH_OPTIONS.map((f) => (
                      <option key={f.key} value={f.key} className="bg-[#101014] text-[#f2ede4]">
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
                  <MagneticButton type="submit" variant="solid" size="sm" className="flex-1">
                    Confirm Inquiry
                  </MagneticButton>
                  <MagneticButton type="button" size="sm" onClick={handleReplayAcquire}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Replay</span>
                  </MagneticButton>
                </div>
              </form>
            )}
          </div>
        </aside>
      )}

      {/* Collapsible Bottom Control & Inspection Dock */}
      <aside
        aria-label="Viewport inspection controls"
        className={`pointer-events-none fixed bottom-3 left-1/2 z-20 flex w-[min(780px,92vw)] -translate-x-1/2 flex-col items-center transition-transform duration-300 ease-out ${
          hudCollapsed ? 'translate-y-[calc(100%-32px)]' : 'translate-y-0'
        }`}
      >
        <button
          type="button"
          onClick={() => setHudCollapsed((v) => !v)}
          className="font-tech pointer-events-auto mb-1.5 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap border border-[#f2ede4]/15 bg-[#0e0e12]/95 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#9a948a] transition-colors hover:border-[#d4a86a]/60 hover:text-[#f2ede4] focus-visible:outline-2 focus-visible:outline-[#d4a86a]"
          aria-expanded={!hudCollapsed}
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="h-3 w-3" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        <div className="pointer-events-auto flex w-full flex-wrap items-center justify-between gap-3 border border-[#f2ede4]/15 bg-[#0e0e12]/94 px-4 py-2.5">
          <div className="font-tech flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-[#f2ede4]">
            <span className={isDragging ? 'text-[#d4a86a]' : 'text-[#f2ede4]'}>
              {acquireMode
                ? isDragging
                  ? 'Inspecting Wrist Fit'
                  : 'Wrist Fitting · Drag 360° to Inspect'
                : isDragging
                ? 'Orbit Active'
                : 'Drag 360° · Scroll to Disassemble'}
            </span>
          </div>

          <div className="font-tech flex items-center gap-4 text-[10px] uppercase tracking-[0.14em] text-[#9a948a]">
            <span className="hidden sm:inline">
              AZ {String(telemetry.az).padStart(3, '0')}° · EL {telemetry.el}°
            </span>

            <div className="hidden h-px w-16 bg-[#f2ede4]/15 md:block">
              <div ref={progressBarRef} className="h-full w-0 bg-[#d4a86a]" />
            </div>

            <span>{acquireMode ? 'FIT' : `0${activeChapter + 1} / 05`}</span>

            <button
              type="button"
              onClick={() => setIsLite((v) => !v)}
              className="cursor-pointer whitespace-nowrap border border-[#f2ede4]/15 bg-[#16161b] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[#f2ede4] transition-colors hover:border-[#d4a86a] focus-visible:outline-2 focus-visible:outline-[#d4a86a]"
              title="Switch WebGL rendering profile"
            >
              {isLite ? 'Lite Render' : 'Studio Render'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
