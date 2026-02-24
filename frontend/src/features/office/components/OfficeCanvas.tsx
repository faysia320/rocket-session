import { memo, useRef, useEffect, useCallback } from "react";
import { OfficeEngine, type HitResult } from "../engine/OfficeEngine";
import { DEFAULT_LAYOUT } from "../layouts/defaultLayout";
import { readThemeFromCSS } from "../engine/themeReader";
import { useOfficeStore } from "../hooks/useOfficeStore";
import type { AgentState } from "../types/office";

interface OfficeCanvasProps {
  onAgentClick: (agent: AgentState) => void;
  onEmptyDeskClick: () => void;
}

export const OfficeCanvas = memo(function OfficeCanvas({
  onAgentClick,
  onEmptyDeskClick,
}: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OfficeEngine | null>(null);

  const agents = useOfficeStore((s) => s.agents);
  const zoom = useOfficeStore((s) => s.zoom);
  const showLabels = useOfficeStore((s) => s.showLabels);
  const setHoveredAgent = useOfficeStore((s) => s.setHoveredAgent);
  const setZoom = useOfficeStore((s) => s.setZoom);

  // Refs: React 리렌더 없이 엔진에 데이터 전달
  const agentsRef = useRef(agents);
  const hoveredAgentIdRef = useRef<string | null>(null);
  const showLabelsRef = useRef(showLabels);

  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);

  // Engine 라이프사이클
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const theme = readThemeFromCSS();
    const engine = new OfficeEngine(canvas, DEFAULT_LAYOUT, theme);
    engineRef.current = engine;
    engine.start(agentsRef, hoveredAgentIdRef, showLabelsRef);

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  // 줌 동기화
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.camera.setZoom(zoom);
    }
  }, [zoom]);

  // 테마 변경 감지 (MutationObserver)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      engineRef.current?.setTheme(readThemeFromCSS());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // 마우스 휠: 줌
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      setZoom(zoom + delta);
    },
    [zoom, setZoom],
  );

  // 마우스 이동: 호버 히트 테스트
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!engineRef.current) return;

      // 드래그 중이면 팬
      if (e.buttons === 1 || e.buttons === 4) {
        engineRef.current.camera.pan(e.movementX, e.movementY);
        return;
      }

      const hit = engineRef.current.hitTest(e.clientX, e.clientY);
      const agentId = hit?.type === "agent" ? hit.agent.sessionId : null;
      if (agentId !== hoveredAgentIdRef.current) {
        hoveredAgentIdRef.current = agentId;
        setHoveredAgent(agentId);
      }
    },
    [setHoveredAgent],
  );

  // 마우스 클릭
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!engineRef.current) return;
      const hit: HitResult = engineRef.current.hitTest(e.clientX, e.clientY);
      if (!hit) return;
      if (hit.type === "agent") onAgentClick(hit.agent);
      else if (hit.type === "emptyDesk") onEmptyDeskClick();
    },
    [onAgentClick, onEmptyDeskClick],
  );

  // 마우스 나감
  const handleMouseLeave = useCallback(() => {
    hoveredAgentIdRef.current = null;
    setHoveredAgent(null);
  }, [setHoveredAgent]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block cursor-crosshair"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={handleMouseLeave}
    />
  );
});
