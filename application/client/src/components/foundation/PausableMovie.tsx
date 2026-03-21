import classNames from "classnames";
import { useCallback, useEffect, useRef, useState } from "react";

import { AspectRatioBox } from "@web-speed-hackathon-2026/client/src/components/foundation/AspectRatioBox";
import { FontAwesomeIcon } from "@web-speed-hackathon-2026/client/src/components/foundation/FontAwesomeIcon";
import type { GifDecoderResult } from "@web-speed-hackathon-2026/client/src/workers/gif_decoder.worker";

interface Props {
  src: string;
}

interface DecodedGif {
  width: number;
  height: number;
  frames: Array<{ imageData: ImageData; delay: number }>;
}

/**
 * クリックすると再生・一時停止を切り替えます。
 * GIF のデコードは Web Worker 内で行い、メインスレッドをブロックしません。
 */
export const PausableMovie = ({ src }: Props) => {
  const [isVisible, setIsVisible] = useState(false);
  const [decodedGif, setDecodedGif] = useState<DecodedGif | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  // IntersectionObserver: 可視領域に入るまで fetch/decode を開始しない
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 可視後: fetch → Worker decode
  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    const worker = new Worker(new URL("../../workers/gif_decoder.worker.ts", import.meta.url));

    fetch(src)
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        if (cancelled) return;
        worker.postMessage(buf, [buf]);
      })
      .catch(() => {
        if (!cancelled) worker.terminate();
      });

    worker.onmessage = (e: MessageEvent<GifDecoderResult>) => {
      if (cancelled) return;
      const { width, height, frames } = e.data;
      const decoded: DecodedGif = {
        width,
        height,
        frames: frames.map((f) => ({
          imageData: new ImageData(new Uint8ClampedArray(f.data), width, height),
          delay: f.delay,
        })),
      };
      setDecodedGif(decoded);
      worker.terminate();
    };

    return () => {
      cancelled = true;
      worker.terminate();
    };
  }, [isVisible, src]);

  // 初期描画 + prefers-reduced-motion チェック
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !decodedGif || decodedGif.frames.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = decodedGif.width;
    canvas.height = decodedGif.height;

    // 最初のフレームを描画
    ctx.putImageData(decodedGif.frames[0]!.imageData, 0, 0);
    frameIndexRef.current = 0;
    lastFrameTimeRef.current = 0;

    // 視覚効果 off のとき GIF を自動再生しない
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  }, [decodedGif]);

  // アニメーションループ（再生/一時停止統合 — 二重起動を防止）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !decodedGif || decodedGif.frames.length === 0) return;
    if (!isPlaying) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    lastFrameTimeRef.current = 0;

    const animate = (time: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = time;
      }
      const currentFrame = decodedGif.frames[frameIndexRef.current]!;
      const elapsed = time - lastFrameTimeRef.current;
      const delay = currentFrame.delay * 10 || 100; // delay は 1/100秒単位

      if (elapsed >= delay) {
        frameIndexRef.current = (frameIndexRef.current + 1) % decodedGif.frames.length;
        const nextFrame = decodedGif.frames[frameIndexRef.current]!;
        ctx.putImageData(nextFrame.imageData, 0, 0);
        lastFrameTimeRef.current = time;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, decodedGif]);

  const handleClick = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  if (!decodedGif) {
    return (
      <AspectRatioBox aspectHeight={1} aspectWidth={1}>
        <div ref={sentinelRef} className="h-full w-full" />
      </AspectRatioBox>
    );
  }

  return (
    <AspectRatioBox aspectHeight={1} aspectWidth={1}>
      <button
        aria-label="動画プレイヤー"
        className="group relative block h-full w-full"
        onClick={handleClick}
        type="button"
      >
        <canvas ref={canvasRef} className="w-full" />
        <div
          className={classNames(
            "absolute left-1/2 top-1/2 flex items-center justify-center w-16 h-16 text-cax-surface-raised text-3xl bg-cax-overlay/50 rounded-full -translate-x-1/2 -translate-y-1/2",
            {
              "opacity-0 group-hover:opacity-100": isPlaying,
            },
          )}
        >
          <FontAwesomeIcon iconType={isPlaying ? "pause" : "play"} styleType="solid" />
        </div>
      </button>
    </AspectRatioBox>
  );
};
