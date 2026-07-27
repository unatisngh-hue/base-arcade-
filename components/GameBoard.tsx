'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface GameBoardProps {
  gameLabel?: string;
  showLabel: boolean;
  onCanvasClick?: (x: number, y: number) => void;
}

export interface GameBoardRef {
  canvas: HTMLCanvasElement | null;
  wrap: HTMLDivElement | null;
  pixFrame: SVGSVGElement | null;
}

export const GameBoard = forwardRef<GameBoardRef, GameBoardProps>(
  ({ gameLabel, showLabel, onCanvasClick }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const pixFrameRef = useRef<SVGSVGElement>(null);

    useImperativeHandle(ref, () => ({
      canvas: canvasRef.current,
      wrap: wrapRef.current,
      pixFrame: pixFrameRef.current,
    }));

    const handlePointerDown = (e: React.PointerEvent) => {
      if (!onCanvasClick || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      onCanvasClick(e.clientX - rect.left, e.clientY - rect.top);
    };

    return (
      <div
        ref={wrapRef}
        className="relative w-full mt-[10px] box-border bg-board-bg border border-board-edge rounded-[22.5px] overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="block absolute"
          onPointerDown={handlePointerDown}
        />
        <svg
          ref={pixFrameRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-[3]"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        />
        <div
          className={`gameLabel ${showLabel ? 'show' : ''}`}
        >
          {gameLabel}
        </div>
      </div>
    );
  }
);

GameBoard.displayName = 'GameBoard';
