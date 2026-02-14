import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel } from "@/features/chat/components/ChatPanel";

export const Route = createFileRoute("/session/$sessionId")({
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();

  return (
    <div className="flex flex-1 overflow-hidden">
      <ChatPanel key={sessionId} sessionId={sessionId} />
    </div>
  );
}
