import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTeamMessages } from "../hooks/useTeamMessages";
import type { TeamMemberInfo, TeamMessageInfo } from "@/types";

interface TeamMessagePanelProps {
  teamId: string;
  members: TeamMemberInfo[];
  leadMemberId: number | null;
}

const typeColors: Record<string, string> = {
  info: "border-l-muted-foreground/30",
  task_update: "border-l-info/50",
  request: "border-l-warning/50",
  result: "border-l-success/50",
  delegate: "border-l-primary/50",
};

function MessageBubble({
  msg,
  members,
}: {
  msg: TeamMessageInfo;
  members: TeamMemberInfo[];
}) {
  const member = members.find((m) => m.id === msg.from_member_id);
  const name = msg.from_nickname || member?.nickname || `멤버#${msg.from_member_id}`;
  const isLead = member?.role === "lead";

  return (
    <div
      className={cn(
        "border-l-2 pl-3 py-1.5 space-y-0.5",
        typeColors[msg.message_type] || typeColors.info,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-2xs font-medium text-foreground/80">
          {name}
        </span>
        {isLead ? (
          <span className="font-mono text-2xs text-primary/70">리드</span>
        ) : null}
        <span className="font-mono text-2xs text-muted-foreground/50 ml-auto">
          {new Date(msg.created_at).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="font-mono text-xs text-foreground/90 whitespace-pre-wrap break-words">
        {msg.content}
      </p>
    </div>
  );
}

export function TeamMessagePanel({
  teamId,
  members,
  leadMemberId,
}: TeamMessagePanelProps) {
  const { messages, isLoading, sendMessage, isSending } =
    useTeamMessages(teamId);
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 메시지 도착 시 하단 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    // 리드 멤버 ID가 있으면 리드로 전송, 아니면 첫 번째 멤버
    const fromId = leadMemberId || members[0]?.id;
    if (fromId == null) return;

    await sendMessage({
      from_member_id: fromId,
      content: text,
    });
    setInput("");
  }, [input, leadMemberId, members, sendMessage]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* 헤더 */}
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/50 hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-xs font-medium">팀 메시지</span>
        <span className="font-mono text-2xs text-muted-foreground ml-auto">
          {messages.length}
        </span>
      </button>

      {collapsed ? null : (
        <>
          {/* 메시지 목록 */}
          <ScrollArea className="h-48" ref={scrollRef}>
            <div className="p-2 space-y-2">
              {isLoading ? (
                <div className="py-6 text-center">
                  <span className="font-mono text-2xs text-muted-foreground animate-pulse">
                    로딩 중…
                  </span>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-6 text-center">
                  <span className="font-mono text-2xs text-muted-foreground/50">
                    아직 메시지가 없습니다
                  </span>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} members={members} />
                ))
              )}
            </div>
          </ScrollArea>

          {/* 입력 */}
          <div className="flex items-center gap-2 p-2 border-t border-border/50">
            <input
              className="flex-1 font-mono text-xs bg-input border border-border rounded px-2.5 py-1.5 outline-none focus:border-primary/50"
              placeholder="메시지 입력…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isSending}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              aria-label="메시지 전송"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
