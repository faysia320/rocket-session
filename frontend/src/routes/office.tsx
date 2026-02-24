import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/office")({
  component: OfficePage,
});

function OfficePage() {
  // OfficeLayout(__root.tsx)이 렌더링을 담당하므로 이 컴포넌트는 비어있음.
  // TanStack Router 라우트 등록 용도.
  return null;
}
