import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Moon, Pause, Play, Sun } from "lucide-react";
import { ErrorBoundary } from "../ErrorBoundary";
import { LegacyLuxHero } from "./LegacyLuxHero";
const Atmosphere = lazy(() => import("./HeroAtmosphere"));

type HeroProps = { roomCount: number; rating?: string; reviewCount?: number; onCheckAvailability: () => void; onExploreRooms: () => void };
export function LuxHero(props: HeroProps) {
  return import.meta.env.VITE_CINEMATIC_HERO === "false" ? <LegacyLuxHero {...props} /> : <CinematicHero {...props} />;
}
function CinematicHero({ onCheckAvailability, onExploreRooms }: HeroProps) {
  const [night, setNight] = useState(false);
  const [motion, setMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const sunsetVid = useRef<HTMLVideoElement>(null);
  const nightVid = useRef<HTMLVideoElement>(null);
  const disableAtmosphere = useCallback(() => { setUnavailable(true); }, []);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const update = () => {
      setReduced(preference.matches);
      setMotion(!preference.matches && !connection?.saveData);
    };
    update(); preference.addEventListener("change", update);
    const timer = window.setTimeout(() => setReady(true), 400);
    return () => { clearTimeout(timer); preference.removeEventListener("change", update); };
  }, []);

  const sceneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    if (typeof CSS !== "undefined" && CSS.supports?.("animation-timeline", "scroll()")) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 900);
        el.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const live = night ? nightVid.current : sunsetVid.current;
    const idle = night ? sunsetVid.current : nightVid.current;
    idle?.pause();
    if (!ready || !motion || reduced || !live) {
      live?.pause();
      setVideoOn(false);
      return;
    }
    let cancelled = false;
    const play = () => {
      if (cancelled) return;
      live.play().then(() => { if (!cancelled) setVideoOn(true); }).catch(() => { if (!cancelled) setVideoOn(false); });
    };
    if (live.readyState >= 2) play();
    else {
      const onReady = () => play();
      live.addEventListener("canplay", onReady);
      live.load();
      return () => { cancelled = true; live.removeEventListener("canplay", onReady); };
    }
    return () => { cancelled = true; };
  }, [ready, motion, reduced, night]);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      const live = night ? nightVid.current : sunsetVid.current;
      if (!live) return;
      if (entry.isIntersecting && motion && !reduced) live.play().catch(() => setVideoOn(false));
      else live.pause();
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [motion, reduced, night]);

  const useVideo = ready && motion && !reduced;
  const showAtmosphere = useVideo && !videoOn && !unavailable;

  return (
    <section className={`lux-hero cinema-hero ${night ? "is-night" : "is-sunset"}${videoOn ? " is-video" : ""}`} aria-label="Không gian Sao Mai Hotel">
      <div className="cinema-scene" aria-hidden="true" ref={sceneRef}>
        <picture>
          <source media="(max-width: 700px)" srcSet="/media/hero-sunset-mobile.webp" />
          <img className="cinema-poster" src="/media/hero-sunset.webp" width="2200" height="1228" alt="" fetchPriority="high" decoding="async" />
        </picture>
        <picture>
          <source media="(max-width: 700px)" srcSet="/media/hero-night-mobile.webp" />
          <img className="cinema-poster cinema-poster--night" src="/media/hero-night.webp" width="2200" height="1228" alt="" />
        </picture>
        <video
          ref={sunsetVid}
          className="cinema-video"
          muted
          loop
          playsInline
          preload="none"
          poster="/media/hero-sunset.webp"
          src="/media/hero-sunset.mp4"
        />
        <video
          ref={nightVid}
          className="cinema-video cinema-video--night"
          muted
          loop
          playsInline
          preload="none"
          poster="/media/hero-night.webp"
          src="/media/hero-night.mp4"
        />
        {showAtmosphere && <ErrorBoundary scope="hero-atmosphere" fallback={<span className="cinema-poster-fallback" />}>
          <Suspense fallback={null}><Atmosphere night={night} onUnavailable={disableAtmosphere} /></Suspense>
        </ErrorBoundary>}
      </div>
      <div className="cinema-shade" aria-hidden="true" />
      <div className="cinema-topline lux-shell lux-shell--wide">
        <div className="cinema-setting" role="group" aria-label="Ánh sáng khung cảnh">
          <button type="button" aria-pressed={!night} onClick={() => setNight(false)}><Sun size={15} />Hoàng hôn</button>
          <button type="button" aria-pressed={night} onClick={() => setNight(true)}><Moon size={15} />Về đêm</button>
          <button type="button" className="cinema-motion" disabled={reduced} aria-pressed={motion} onClick={() => setMotion(v => !v)}>
            {motion ? <Pause size={14} /> : <Play size={14} />}
            <span className="sr-only">{reduced ? "Giảm chuyển động" : motion ? "Tắt video nền" : "Bật video nền"}</span>
          </button>
        </div>
      </div>
      <div className="lux-shell lux-shell--wide cinema-content">
        <div className="cinema-copy">
          <h1>Một khoảng<br /><em>trời riêng.</em></h1>
          <div className="cinema-actions">
            <button type="button" className="lux-linkline cinema-link" onClick={onCheckAvailability}>Đặt residences</button>
            <button type="button" className="lux-linkline cinema-link" onClick={onExploreRooms}>Khám phá 13 căn</button>
          </div>
        </div>
      </div>
    </section>
  );
}
