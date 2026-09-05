"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  engravingPoster,
  engravingSrc,
  isCalloutRevealed,
  sellPoints,
  type SellPoint,
} from "@/lib/engraving";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sectionProgress(section: HTMLElement) {
  const rect = section.getBoundingClientRect();
  const scrollable = section.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  return clamp(-rect.top / scrollable, 0, 1);
}

function Callout({
  point,
  align,
  compact = false,
}: {
  point: SellPoint;
  align: "left" | "right";
  compact?: boolean;
}) {
  return (
    <article
      className={cn(
        "w-full rounded-sm border border-paper/15 bg-steel/94 text-paper shadow-[0_12px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm",
        compact ? "max-w-[17.5rem] px-3.5 py-2.5" : "max-w-xs px-4 py-3.5",
        align === "right" && "self-end"
      )}
      data-callout={point.id}
    >
      <p className="font-mono text-[11px] tracking-[0.16em] text-laser uppercase">
        {point.id}
      </p>
      <p
        className={cn(
          "mt-1 font-heading leading-snug font-semibold",
          compact ? "text-base" : "text-lg md:text-xl"
        )}
      >
        {point.title}
      </p>
      {point.detail ? (
        <p
          className={cn(
            "mt-1 leading-snug text-haze",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {point.detail}
        </p>
      ) : null}
    </article>
  );
}

function CalloutColumn({
  points,
  align,
  compact = false,
}: {
  points: SellPoint[];
  align: "left" | "right";
  compact?: boolean;
}) {
  if (points.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col",
        compact ? "gap-2.5" : "gap-5",
        align === "right" && "items-end"
      )}
    >
      {points.map((point) => (
        <Callout
          key={point.id}
          point={point}
          align={align}
          compact={compact}
        />
      ))}
    </div>
  );
}

export function EngravingScrub() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    video.muted = true;
    video.defaultPlaybackRate = 1;
    video.pause();

    let frame = 0;
    let lastProgress = -1;
    let lastTime = -1;
    let seeking = false;
    let unlockTimer = 0;

    const unlock = () => {
      video.muted = true;
      const play = video.play();
      if (play) {
        play
          .then(() => {
            video.pause();
          })
          .catch(() => {
            // currentTime still works in Chromium once metadata is loaded.
          });
      }
    };

    const applyVideo = (nextProgress: number) => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const nextTime = clamp(
        nextProgress * video.duration,
        0,
        Math.max(video.duration - 0.04, 0)
      );
      if (Math.abs(nextTime - lastTime) < 0.03 || seeking) return;

      seeking = true;
      lastTime = nextTime;
      try {
        if (!video.paused) video.pause();
        video.currentTime = nextTime;
      } catch {
        seeking = false;
      }
      window.clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(() => {
        seeking = false;
      }, 90);
    };

    const onSeeked = () => {
      seeking = false;
    };

    const tick = () => {
      const next = reducedMotion ? 1 : sectionProgress(section);
      if (Math.abs(next - lastProgress) >= 0.008) {
        lastProgress = next;
        setProgress(next);
      }
      applyVideo(next);
      frame = window.requestAnimationFrame(tick);
    };

    video.addEventListener("seeked", onSeeked);
    if (video.readyState >= 1) {
      unlock();
    } else {
      video.addEventListener("loadedmetadata", unlock, { once: true });
    }

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(unlockTimer);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [reducedMotion]);

  const revealed = sellPoints.filter((point) =>
    reducedMotion ? true : isCalloutRevealed(progress, point)
  );
  const leftPoints = revealed.filter((point) => point.side === "left");
  const rightPoints = revealed.filter((point) => point.side === "right");

  return (
    <section
      ref={sectionRef}
      id="engraving"
      aria-label="Traffolyte laser engraving"
      data-progress={progress.toFixed(2)}
      className="relative bg-charcoal"
      style={{ height: reducedMotion ? undefined : "480vh" }}
    >
      <div
        className={cn(
          "flex flex-col justify-center bg-charcoal",
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
          TraffLabels into a centred plate. Sell points stay on screen once they
          appear: no minimum and easy instant online ordering; engraved finish,
          not printed, will not rub off like stickers; 3M adhesive option; 100%
          owned and manufactured in Australia; bulk discounts.
        </p>

        <div className="pointer-events-none relative z-20 mx-auto hidden h-full w-full max-w-[96rem] items-center justify-between px-[2.5vw] md:flex">
          <div className="flex w-[min(18rem,22vw)] flex-col justify-evenly self-stretch py-6">
            <CalloutColumn points={leftPoints} align="left" />
          </div>
          <div className="flex w-[min(18rem,22vw)] flex-col justify-evenly self-stretch py-6">
            <CalloutColumn points={rightPoints} align="right" />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-3 bottom-3 z-20 flex flex-col justify-between px-3 md:hidden">
          <CalloutColumn points={leftPoints} align="left" compact />
          <CalloutColumn points={rightPoints} align="right" compact />
        </div>
      </div>
    </section>
  );
}
