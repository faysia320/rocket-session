import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-12 p-10">
      <div className="text-center animate-[fadeIn_0.5s_ease]">
        <div className="font-mono text-5xl text-primary mb-4 animate-[blink_1.2s_ease-in-out_infinite]">
          {">"}_
        </div>
        <h1 className="font-mono text-[28px] font-semibold text-foreground mb-2 tracking-tight">
          Claude Code Dashboard
        </h1>
        <p className="text-muted-foreground text-[15px] mb-6">
          Create a session to start sending commands to Claude Code CLI
        </p>
        <Button
          size="lg"
          onClick={onNew}
          className="font-mono text-sm font-medium"
        >
          + New Session
        </Button>
      </div>

      <div className="flex gap-4 max-w-[700px]">
        {[
          {
            icon: "\u{1F4AC}",
            title: "Send Commands",
            desc: "Write prompts and get real-time streaming responses",
            delay: "0s",
          },
          {
            icon: "\u{1F4C1}",
            title: "Track Changes",
            desc: "Monitor file modifications as Claude works",
            delay: "0.1s",
          },
          {
            icon: "\u{1F504}",
            title: "Resume Sessions",
            desc: "Continue conversations across multiple prompts",
            delay: "0.2s",
          },
        ].map((feature, i) => (
          <Card
            key={i}
            className="flex-1 p-5 animate-[fadeIn_0.5s_ease_both]"
            style={{ animationDelay: feature.delay }}
          >
            <span className="text-2xl block mb-2.5">{feature.icon}</span>
            <h3 className="font-mono text-[13px] font-semibold text-foreground mb-1.5">
              {feature.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-normal">
              {feature.desc}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
