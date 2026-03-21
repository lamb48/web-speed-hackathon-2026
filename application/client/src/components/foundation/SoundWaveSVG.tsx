import { useEffect, useRef, useState } from "react";

interface ParsedData {
  max: number;
  peaks: number[];
}

async function calculate(data: ArrayBuffer): Promise<ParsedData> {
  const audioCtx = new AudioContext();
  try {
    const buffer = await audioCtx.decodeAudioData(data.slice(0));
    const leftData = Array.from(buffer.getChannelData(0), Math.abs);
    const rightData =
      buffer.numberOfChannels > 1 ? Array.from(buffer.getChannelData(1), Math.abs) : leftData;

    const normalized = leftData.map((v, i) => (v + rightData[i]!) / 2);

    const chunkSize = Math.max(1, Math.ceil(normalized.length / 100));
    const peaks: number[] = [];
    for (let i = 0; i < normalized.length; i += chunkSize) {
      const chunk = normalized.slice(i, i + chunkSize);
      peaks.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
    }

    const max = Math.max(...peaks) || 0;

    return { max, peaks };
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

interface Props {
  soundData: ArrayBuffer;
}

export const SoundWaveSVG = ({ soundData }: Props) => {
  const uniqueIdRef = useRef(Math.random().toString(16));
  const containerRef = useRef<SVGSVGElement>(null);
  const [{ max, peaks }, setPeaks] = useState<ParsedData>({
    max: 0,
    peaks: [],
  });

  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const svg = containerRef.current;
    if (!svg) return;

    // IntersectionObserver で可視領域に入るまで計算開始しない
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          // requestIdleCallback でメインスレッドがアイドルのときに計算
          const run = () => {
            if (cancelled) return;
            calculate(soundData).then((result) => {
              if (!cancelled) {
                setPeaks(result);
              }
            });
          };
          if ("requestIdleCallback" in window) {
            idleHandle = requestIdleCallback(run, { timeout: 5000 });
          } else {
            timeoutHandle = setTimeout(run, 100);
          }
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(svg);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (idleHandle !== undefined) cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, [soundData]);

  return (
    <svg
      ref={containerRef}
      className="h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 1"
    >
      {peaks.map((peak, idx) => {
        const ratio = peak / max;
        return (
          <rect
            key={`${uniqueIdRef.current}#${idx}`}
            fill="var(--color-cax-accent)"
            height={ratio}
            width="1"
            x={idx}
            y={1 - ratio}
          />
        );
      })}
    </svg>
  );
};
