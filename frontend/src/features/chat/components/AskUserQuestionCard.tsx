import { useState, useCallback, memo } from "react";
import { MessageCircleQuestion, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { AskUserQuestionMsg } from "@/types";

interface AskUserQuestionCardProps {
  message: AskUserQuestionMsg;
  onAnswer: (messageId: string, questionIndex: number, labels: string[]) => void;
  onConfirm: (messageId: string) => void;
}

export const AskUserQuestionCard = memo(function AskUserQuestionCard({
  message,
  onAnswer,
  onConfirm,
}: AskUserQuestionCardProps) {
  const { questions, answers = {}, answered, sent } = message;
  const disabled = !!answered;

  const allAnswered = questions.every(
    (_, i) => (answers[i]?.length ?? 0) > 0,
  );

  return (
    <div className="animate-[slideInLeft_0.2s_ease]">
      <div
        className={cn(
          "px-3 py-2.5 bg-secondary border border-border rounded-sm border-l-[3px]",
          answered ? "border-l-success" : "border-l-info",
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <MessageCircleQuestion className="h-3.5 w-3.5 text-info shrink-0" />
          <span className="font-mono text-xs font-semibold text-foreground">
            Answer questions
          </span>
          {answered ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/15 text-success border border-success/30">
              <Check className="h-2.5 w-2.5" />
              {sent ? "sent" : "answered"}
            </span>
          ) : null}
        </div>

        <div className="space-y-3">
          {questions.map((q, qIdx) => (
            <QuestionItem
              key={qIdx}
              question={q}
              questionIndex={qIdx}
              messageId={message.id}
              selected={answers[qIdx] || []}
              disabled={disabled}
              onAnswer={onAnswer}
            />
          ))}
        </div>

        {!answered ? (
          <div className="flex justify-end mt-3 pt-2 border-t border-border/30">
            <button
              type="button"
              disabled={!allAnswered}
              onClick={() => onConfirm(message.id)}
              className={cn(
                "font-mono text-[11px] font-semibold px-3 py-1.5 rounded transition-colors",
                allAnswered
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
              aria-label="confirm answers"
            >
              confirm
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});

interface QuestionItemProps {
  question: AskUserQuestionMsg["questions"][number];
  questionIndex: number;
  messageId: string;
  selected: string[];
  disabled: boolean;
  onAnswer: (messageId: string, questionIndex: number, labels: string[]) => void;
}

function QuestionItem({
  question,
  questionIndex,
  messageId,
  selected,
  disabled,
  onAnswer,
}: QuestionItemProps) {
  const [customText, setCustomText] = useState("");
  const isCustom = selected.length === 1 && selected[0] === "__custom__";

  const handleSingleSelect = useCallback(
    (label: string) => {
      if (disabled) return;
      onAnswer(messageId, questionIndex, [label]);
    },
    [disabled, messageId, questionIndex, onAnswer],
  );

  const handleMultiToggle = useCallback(
    (label: string) => {
      if (disabled) return;
      const next = selected.includes(label)
        ? selected.filter((l) => l !== label)
        : [...selected.filter((l) => l !== "__custom__"), label];
      onAnswer(messageId, questionIndex, next);
    },
    [disabled, selected, messageId, questionIndex, onAnswer],
  );

  const handleCustomSelect = useCallback(() => {
    if (disabled) return;
    onAnswer(messageId, questionIndex, ["__custom__"]);
  }, [disabled, messageId, questionIndex, onAnswer]);

  const handleCustomTextConfirm = useCallback(() => {
    if (disabled || !customText.trim()) return;
    onAnswer(messageId, questionIndex, [customText.trim()]);
  }, [disabled, customText, messageId, questionIndex, onAnswer]);

  const { options, multiSelect } = question;

  return (
    <div>
      {question.header ? (
        <div className="font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {question.header}
        </div>
      ) : null}
      <div className="font-mono text-[12px] text-foreground mb-1.5">
        {question.question}
      </div>

      {options.length > 0 ? (
        <div className="space-y-1">
          {options.map((opt) => {
            const isSelected = selected.includes(opt.label);
            if (multiSelect) {
              return (
                <label
                  key={opt.label}
                  className={cn(
                    "flex items-start gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-input border border-transparent hover:border-border",
                    disabled && "opacity-60 cursor-default",
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleMultiToggle(opt.label)}
                    disabled={disabled}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] font-semibold text-foreground">
                      {opt.label}
                    </div>
                    {opt.description ? (
                      <div className="font-mono text-[10px] text-muted-foreground leading-tight">
                        {opt.description}
                      </div>
                    ) : null}
                  </div>
                </label>
              );
            }

            return (
              <button
                key={opt.label}
                type="button"
                disabled={disabled}
                onClick={() => handleSingleSelect(opt.label)}
                className={cn(
                  "w-full text-left flex items-start gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors",
                  isSelected
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-input border border-transparent hover:border-border",
                  disabled && "opacity-60 cursor-default",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground",
                  )}
                >
                  {isSelected ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                  ) : null}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] font-semibold text-foreground">
                    {opt.label}
                  </div>
                  {opt.description ? (
                    <div className="font-mono text-[10px] text-muted-foreground leading-tight">
                      {opt.description}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}

          {/* Other (custom) option */}
          <div>
            <button
              type="button"
              disabled={disabled}
              onClick={handleCustomSelect}
              className={cn(
                "w-full text-left flex items-start gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors",
                isCustom
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-input border border-transparent hover:border-border",
                disabled && "opacity-60 cursor-default",
              )}
            >
              {multiSelect ? (
                <Checkbox
                  checked={isCustom}
                  disabled={disabled}
                  className="mt-0.5"
                />
              ) : (
                <span
                  className={cn(
                    "mt-0.5 w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center",
                    isCustom
                      ? "border-primary bg-primary"
                      : "border-muted-foreground",
                  )}
                >
                  {isCustom ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                  ) : null}
                </span>
              )}
              <span className="font-mono text-[11px] font-semibold text-foreground">
                Other
              </span>
            </button>
            {isCustom ? (
              <div className="flex gap-1.5 mt-1 ml-5">
                <input
                  className="flex-1 font-mono text-[11px] bg-input border border-border rounded px-2 py-1 outline-none focus:border-primary/50"
                  placeholder="custom answer"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCustomTextConfirm();
                    }
                  }}
                  disabled={disabled}
                  autoFocus
                />
                <button
                  type="button"
                  disabled={disabled || !customText.trim()}
                  onClick={handleCustomTextConfirm}
                  className="font-mono text-[10px] font-semibold px-2 py-1 rounded bg-primary/80 text-primary-foreground hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="apply custom answer"
                >
                  OK
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* options가 없는 경우: 자유 입력 */
        <div>
          <textarea
            className="w-full font-mono text-[11px] bg-input border border-border rounded px-2.5 py-1.5 outline-none focus:border-primary/50 resize-none min-h-[60px]"
            placeholder="answer here"
            value={selected[0] || ""}
            onChange={(e) =>
              onAnswer(messageId, questionIndex, [e.target.value])
            }
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
