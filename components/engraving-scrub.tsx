"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  engravingPoster,
  engravingSrc,
  sellPoints,
  type SellPoint,
} from "@/lib/engraving";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function Callout({
  point,
  visible,
  align,
}: {
  point: SellPoint;
  visible: boolean;
  align: "left" | "right";
}) {
  return (
    <article
      className={cn(
        "max-w-[13.5rem] border border-paper/12 bg-steel/88 px-3 py-2.5 text-paper shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-[opacity,transform] duration-300 ease-out",
        align === "left" ? "origin-left" : "origin-right self-end",
        visible
          ? "translate-x-0 scale-100 opacity-100"
          : cn(
              "pointer-events-none scale-95 opacity-0",
              align === "left" ? "-translate-x-3" : "translate-x-3"
            )
      )}
      aria-hidden={!visible}
    >
      <p className="font-mono text-[10px] tracking-[0.16em] text-laser uppercase">
        {point.id}
      </p>
      <p className="mt-1 text-sm leading-snug font-medium">{point.title}</p>
      {point.detail ? (
        <p className="mt-0.5 text-xs leading-snug text-paper/65">{point.detail}</p>
      ) : null}
    </article>
  );
}

export function EngravingScrub() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetTime = useRef(0);
  const seeking = useRef(false);
  const frame = useRef(0);
  const [progress, setProgress] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  const applyTime = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }
    if (seeking.current) return;

    const next = clamp(targetTime.current, 0, Math.max(video.duration - 0.04, 0));
    if (Math.abs(video.currentTime - next) < 0.02) return;

    seeking.current = true;
    video.currentTime = next;
  }, []);

  const syncFromScroll = useCallback(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    const rect = section.getBoundingClientRect();
    const scrollable = section.offsetHeight - window.innerHeight;
    const nextProgress =
      scrollable <= 0 ? 0 : clamp(-rect.top / scrollable, 0, 1);

    setProgress(nextProgress);

    if (Number.isFinite(video.duration) && video.duration > 0) {
      targetTime.current = nextProgress * video.duration;
      applyTime();
    }
  }, [applyTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onSeeked = () => {
      seeking.current = false;
      applyTime();
    };

    const onReady = () => {
      syncFromScroll();
    };

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("loadedmetadata", onReady);
    if (video.readyState >= 1) onReady();

    const unlockSeeking = async () => {
      try {
        video.muted = true;
        await video.play();
        video.pause();
      } catch {
        // Desktop browsers typically allow currentTime without a play unlock.
      }
    };
    void unlockSeeking();

    return () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("loadedmetadata", onReady);
    };
  }, [applyTime, syncFromScroll]);

  useEffect(() => {
    const video = videoRef.current;

    if (reducedMotion) {
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration;
      }
      return;
    }

    const onScroll = () => {
      if (frame.current) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = 0;
        syncFromScroll();
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [reducedMotion, syncFromScroll]);

  const displayProgress = reducedMotion ? 1 : progress;
  const leftPoints = sellPoints.filter((point) => point.side === "left");
  const rightPoints = sellPoints.filter((point) => point.side === "right");
  const activeMobile =
    [...sellPoints]
      .reverse()
      .find((point) => displayProgress >= point.appear) ?? null;

  return (
    <section
      ref={sectionRef}
      id="engraving"
      aria-label="Traffolyte laser engraving"
      className="relative bg-charcoal"
      style={{ height: reducedMotion ? undefined : "420vh" }}
    >
      <div
        className={cn(
          "flex flex-col justify-center overflow-hidden bg-charcoal",
          reducedMotion
            ? "relative min-h-[min(100svh,46rem)]"
            : "sticky top-[3.75rem] h-[calc(100svh-3.75rem)]"
        )}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          muted
          playsInline
          preload="auto"
          poster={engravingPoster}
          disablePictureInPicture
          aria-hidden
          tabIndex={-1}
        >
          <source src={engravingSrc} type="video/mp4" />
        </video>

        <p className="sr-only">
          Scroll to scrub the Traffolyte engraving film. The laser cuts
          TraffLabels into a centred plate. Sell points: no minimum and easy
          instant online ordering; engraved finish, not printed, will not rub off
          like stickers; 3M adhesive option; 100% owned and manufactured in
          Australia; bulk discounts.
        </p>

        <div className="pointer-events-none relative z-10 mx-auto hidden h-full w-full max-w-[90rem] px-[4vw] md:flex md:items-center md:justify-between">
          <div className="flex w-[min(13.5rem,22vw)] flex-col gap-3">
            {leftPoints.map((point) => (
              <Callout
                key={point.id}
                point={point}
                align="left"
                visible={displayProgress >= point.appear}
              />
            ))}
          </div>
          <div className="flex w-[min(13.5rem,22vw)] flex-col gap-3">
            {rightPoints.map((point) => (
              <Callout
                key={point.id}
                point={point}
                align="right"
                visible={displayProgress >= point.appear}
              />
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4 md:hidden">
          {activeMobile ? (
            <Callout point={activeMobile} align="left" visible />
          ) : null}
        </div>
      </div>
    </section>
  );
}
