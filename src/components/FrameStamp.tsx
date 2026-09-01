"use client";

import { useEffect, useRef, useState } from "react";

const FRAME_INTERVAL_MS = 90;

/**
 * Section 8.2: plays a stamp's 2-4 frame images in sequence when `play`
 * flips true (e.g. right after completing a task), landing on the last
 * frame ("settled"). A single-frame stamp just renders statically — no
 * animation is forced, matching the spec's fallback rule.
 */
export function FrameStamp({
  frames,
  play,
  alt = "",
  className,
}: {
  frames: string[];
  play: boolean;
  alt?: string;
  className?: string;
}) {
  const [frameIndex, setFrameIndex] = useState(frames.length - 1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!play || frames.length <= 1) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- restarting the animation is the point of this effect
    setFrameIndex(0);
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 1;
      if (i >= frames.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setFrameIndex(frames.length - 1);
        return;
      }
      setFrameIndex(i);
    }, FRAME_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [play, frames]);

  const src = frames[Math.min(frameIndex, frames.length - 1)];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}
