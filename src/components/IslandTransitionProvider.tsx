"use client";

import {
  createContext,
  memo,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Cursor, Loading } from "animal-island-ui";

gsap.registerPlugin(useGSAP);

type IslandTransitionContextValue = {
  startIslandTransition: (href: string) => void;
  isTransitioning: boolean;
};

type TransitionRequest = {
  href: string;
  id: number;
  targetPath: string;
};

type MaskStyle = CSSProperties & {
  "--reveal-r": string;
};

const IslandTransitionContext = createContext<IslandTransitionContextValue | null>(null);

const leaves = [
  "left-[9%] top-[18%] rotate-[-24deg] bg-[#6fba2c]/55",
  "left-[13%] bottom-[20%] rotate-[18deg] bg-[#f7cd67]/65",
  "right-[10%] top-[20%] rotate-[30deg] bg-[#f8f8f0]/65",
  "right-[15%] bottom-[18%] rotate-[-18deg] bg-[#82d5bb]/60"
] as const;

const coins = [
  "left-[23%] top-[31%]",
  "right-[24%] top-[33%]",
  "left-[27%] bottom-[25%]",
  "right-[28%] bottom-[26%]"
] as const;

const loadingSceneStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  paddingRight: 0,
  paddingBottom: 0
};

function getSameOriginPath(href: string) {
  const target = new URL(href, window.location.href);
  return target.origin === window.location.origin ? target.pathname : null;
}

export function IslandTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const requestIdRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const [request, setRequest] = useState<TransitionRequest | null>(null);

  const finishTransition = useCallback(() => {
    isTransitioningRef.current = false;
    setRequest(null);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const startIslandTransition = useCallback(
    (href: string) => {
      if (isTransitioningRef.current) return;

      const targetPath = getSameOriginPath(href);
      if (!targetPath) {
        window.location.assign(href);
        return;
      }

      if (targetPath === pathname) return;

      isTransitioningRef.current = true;
      requestIdRef.current += 1;
      setRequest({ href, id: requestIdRef.current, targetPath });
    },
    [pathname]
  );

  return (
    <IslandTransitionContext.Provider
      value={{ startIslandTransition, isTransitioning: request !== null }}
    >
      {children}
      {request ? (
        <IslandTransitionOverlay
          key={request.id}
          href={request.href}
          onDone={finishTransition}
          onNavigate={navigate}
          routeReady={pathname === request.targetPath}
        />
      ) : null}
    </IslandTransitionContext.Provider>
  );
}

export function useIslandTransition() {
  const context = useContext(IslandTransitionContext);

  if (!context) {
    throw new Error("useIslandTransition must be used inside IslandTransitionProvider.");
  }

  return context;
}

const OfficialIslandLoadingScene = memo(function OfficialIslandLoadingScene() {
  return <Loading active className="island-route-loading-scene" style={loadingSceneStyle} />;
});

function IslandTransitionOverlay({
  href,
  onDone,
  onNavigate,
  routeReady
}: {
  href: string;
  onDone: () => void;
  onNavigate: (href: string) => void;
  routeReady: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const navStartedRef = useRef(false);
  const routeReadyRef = useRef(routeReady);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  routeReadyRef.current = routeReady;

  useEffect(() => {
    const timeline = timelineRef.current;

    if (!routeReady || !timeline) return;

    const exitTime = timeline.labels.exit ?? 0;
    if (timeline.paused() && timeline.time() >= exitTime - 0.01) {
      timeline.play();
    }
  }, [routeReady]);

  useGSAP(
    () => {
      const root = rootRef.current;
      const curtain = curtainRef.current;
      const island = islandRef.current;
      const stamp = stampRef.current;
      const copy = copyRef.current;

      if (!root || !curtain || !island || !stamp || !copy) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const particles = gsap.utils.toArray<HTMLElement>("[data-island-particle]", root);
      const waves = gsap.utils.toArray<HTMLElement>("[data-island-wave]", root);
      const dots = gsap.utils.toArray<HTMLElement>("[data-island-dot]", root);
      const maskRadius = Math.ceil(Math.hypot(root.offsetWidth, root.offsetHeight) / 2) + 96;

      root.style.setProperty("--reveal-r", "0px");
      navStartedRef.current = false;

      const navigateOnce = () => {
        if (navStartedRef.current) return;
        navStartedRef.current = true;
        onNavigate(href);
      };

      if (reduceMotion) {
        const reducedTimeline = gsap.timeline({
          defaults: { ease: "none" },
          onComplete: onDone
        });

        reducedTimeline
          .set(root, { autoAlpha: 1 })
          .set([curtain, island, stamp, copy, dots], { autoAlpha: 1 })
          .addLabel("curtain", 0)
          .addLabel("island", 0)
          .addLabel("stamp", 0)
          .addLabel("copy", 0)
          .addLabel("navigate", 0.05)
          .call(navigateOnce, [], "navigate")
          .addLabel("exit", 0.12)
          .addPause("exit", () => {
            if (routeReadyRef.current) reducedTimeline.play();
          })
          .to(root, { autoAlpha: 0, duration: 0.22 }, "exit+=0.01");

        timelineRef.current = reducedTimeline;
        return () => {
          reducedTimeline.kill();
          timelineRef.current = null;
        };
      }

      const timeline = gsap.timeline({
        defaults: { ease: "power2.out" },
        onComplete: onDone
      });
      const dotLoop = gsap.to(dots, {
        y: -9,
        scale: 1.28,
        duration: 0.38,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: { each: 0.12, from: "start" },
        paused: true
      });

      timelineRef.current = timeline;

      timeline
        .set(root, { autoAlpha: 1, "--reveal-r": "0px" })
        .set(curtain, { autoAlpha: 0, scale: 0.985 })
        .set(island, { autoAlpha: 0, y: 54, scale: 0.82, transformOrigin: "50% 62%" })
        .set(stamp, { autoAlpha: 0, y: 18, scale: 0.42, rotation: -14 })
        .set(copy, { autoAlpha: 0, y: 18, scale: 0.96 })
        .set(dots, { autoAlpha: 0, y: 10, scale: 0.7 })
        .set(particles, { autoAlpha: 0, y: 18, scale: 0.72, rotation: -8 })
        .set(waves, { autoAlpha: 0, y: 16, scaleX: 0.9 })
        .addLabel("curtain", 0)
        .to(curtain, { autoAlpha: 1, scale: 1, duration: 0.24 }, "curtain")
        .to(waves, { autoAlpha: 1, y: 0, scaleX: 1, duration: 0.3, stagger: 0.05 }, "curtain+=0.08")
        .addLabel("island", 0.28)
        .to(island, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.55)" }, "island")
        .to(
          particles,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotation: 0,
            duration: 0.34,
            ease: "back.out(1.7)",
            stagger: { each: 0.04, from: "center" }
          },
          "island+=0.1"
        )
        .addLabel("stamp", 0.88)
        .to(
          stamp,
          { autoAlpha: 1, y: 0, scale: 1, rotation: 6, duration: 0.3, ease: "back.out(2.2)" },
          "stamp"
        )
        .addLabel("copy", 1.22)
        .to(copy, { autoAlpha: 1, y: 0, scale: 1, duration: 0.32 }, "copy")
        .to(
          dots,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.28,
            ease: "back.out(1.8)",
            stagger: 0.08
          },
          "copy+=0.08"
        )
        .call(() => dotLoop.play(), [], "copy+=0.36")
        .to(stamp, { rotation: 0, scale: 0.98, duration: 0.22, ease: "power1.inOut" }, "copy+=0.1")
        .addLabel("navigate", 1.64)
        .call(navigateOnce, [], "navigate")
        .addLabel("exit", 2.35)
        .addPause("exit", () => {
          if (routeReadyRef.current) timeline.play();
        })
        .to([stamp, copy], { autoAlpha: 0, y: -10, duration: 0.18, ease: "power1.inOut" }, "exit+=0.01")
        .to(root, { "--reveal-r": `${maskRadius}px`, duration: 0.42, ease: "power1.inOut" }, "exit+=0.01")
        .to(root, { autoAlpha: 0, duration: 0.06, ease: "none" }, ">");

      return () => {
        dotLoop.kill();
        timeline.kill();
        timelineRef.current = null;
      };
    },
    { dependencies: [href, onDone, onNavigate], scope: rootRef, revertOnUpdate: true }
  );

  const maskStyle: MaskStyle = {
    "--reveal-r": "0px",
    WebkitMaskImage:
      "radial-gradient(circle at center, transparent var(--reveal-r), black calc(var(--reveal-r) + 1px))",
    maskImage:
      "radial-gradient(circle at center, transparent var(--reveal-r), black calc(var(--reveal-r) + 1px))"
  };

  return (
    <Cursor>
      <div
        ref={rootRef}
        role="status"
        aria-live="polite"
        aria-label="正在打开小岛信箱"
        data-island-transition="overlay"
        className="fixed inset-0 z-[2147483647] flex min-h-screen items-center justify-center overflow-hidden bg-[#7DC395] px-4 py-6 text-[#794f27]"
        style={maskStyle}
      >
        <div
          ref={curtainRef}
          aria-hidden="true"
          data-island-transition="curtain"
          className="absolute inset-0 opacity-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 17% 18%, rgba(248,248,240,0.36) 0 88px, transparent 89px), radial-gradient(circle at 85% 17%, rgba(247,205,103,0.38) 0 112px, transparent 113px), radial-gradient(circle at 7% 78%, rgba(25,200,185,0.24) 0 136px, transparent 137px), linear-gradient(135deg, rgba(255,255,255,0.18) 0 11%, transparent 11% 50%, rgba(255,255,255,0.12) 50% 61%, transparent 61% 100%)",
            backgroundSize: "auto, auto, auto, 42px 42px",
            willChange: "opacity, transform"
          }}
        />

        <span
          data-island-wave
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[-6rem] h-60 rounded-[50%_50%_0_0] bg-[#6fba2c]/34 opacity-0"
        />
        <span
          data-island-wave
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[-8.5rem] h-60 rounded-[50%_50%_0_0] bg-[#4f9f68]/24 opacity-0"
        />

        {leaves.map((leaf) => (
          <span
            key={leaf}
            data-island-particle
            aria-hidden="true"
            className={`absolute h-12 w-7 rounded-[100%_0_100%_0] shadow-[0_5px_0_rgba(93,112,67,0.12)] will-change-transform ${leaf}`}
          />
        ))}
        {coins.map((coin) => (
          <span
            key={coin}
            data-island-particle
            aria-hidden="true"
            className={`absolute h-7 w-7 rounded-full border-[3px] border-[#d3993b] bg-[#f7cd67] shadow-[0_5px_0_rgba(121,79,39,0.18)] will-change-transform ${coin}`}
          />
        ))}

        <section className="relative z-10 flex w-full max-w-5xl flex-col items-center justify-center">
          <div className="relative flex h-[min(72vh,680px)] min-h-[420px] w-full items-center justify-center">
            <div
              aria-hidden="true"
              className="absolute bottom-[9%] h-[66%] w-[min(78vw,620px)] rounded-[50%] bg-[#f8f8f0]/20 blur-[2px]"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-[13%] h-[54%] w-[min(64vw,500px)] rounded-[50%] border-[10px] border-[#f7cd67]/25 bg-[#19c8b9]/10 shadow-[0_22px_60px_rgba(55,86,54,0.22)]"
            />

            <div
              ref={islandRef}
              data-island-transition="island"
              className="pointer-events-none absolute inset-0 opacity-0 will-change-transform"
            >
              <OfficialIslandLoadingScene />
            </div>

            <div
              ref={stampRef}
              data-island-transition="stamp"
              className="absolute right-[20%] top-[18%] rotate-6 rounded-full bg-[#f7cd67] px-5 py-3 text-base font-black text-[#794f27] opacity-0 shadow-[0_7px_0_#d9a43e] will-change-transform sm:text-xl"
            >
              登岛中
            </div>

            <div
              ref={copyRef}
              data-island-transition="copy"
              className="absolute inset-x-0 bottom-[0%] z-20 flex flex-col items-center text-center opacity-0 will-change-transform"
            >
              <p className="whitespace-nowrap text-lg font-black leading-8 text-[#794f27] drop-shadow-[0_3px_0_rgba(248,248,240,0.75)] sm:text-2xl">
                正在打开小岛信箱...
              </p>

              <div className="mt-3 flex items-center justify-center gap-2">
                <span
                  data-island-dot
                  className="h-4 w-4 rounded-full border-2 border-[#f8f8f0]/90 bg-[#19c8b9] shadow-[0_5px_0_rgba(121,79,39,0.22),0_9px_16px_rgba(25,200,185,0.28)] sm:h-5 sm:w-5"
                />
                <span
                  data-island-dot
                  className="h-4 w-4 rounded-full border-2 border-[#f8f8f0]/90 bg-[#f7cd67] shadow-[0_5px_0_rgba(121,79,39,0.22),0_9px_16px_rgba(247,205,103,0.3)] sm:h-5 sm:w-5"
                />
                <span
                  data-island-dot
                  className="h-4 w-4 rounded-full border-2 border-[#f8f8f0]/90 bg-[#8ac68a] shadow-[0_5px_0_rgba(121,79,39,0.22),0_9px_16px_rgba(138,198,138,0.3)] sm:h-5 sm:w-5"
                />
              </div>
            </div>
          </div>
        </section>

        <style>{`
          .island-route-loading-scene .illustration {
            width: min(78vw, 540px) !important;
            max-width: min(78vw, 540px) !important;
            max-height: min(62vh, 640px) !important;
          }

          @media (max-width: 640px) {
            .island-route-loading-scene .illustration {
              width: min(84vw, 380px) !important;
              max-width: min(84vw, 380px) !important;
              max-height: 48vh !important;
            }
          }
        `}</style>
      </div>
    </Cursor>
  );
}
