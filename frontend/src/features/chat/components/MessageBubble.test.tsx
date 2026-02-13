import { render, screen } from '@testing-library/react';
import type { Message } from '@/types';
import { MessageBubble } from './MessageBubble';

// Mock heavy dependencies at the top of the file
vi.mock('@/components/ui/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, ...props }: any) => <div data-testid="collapsible" {...props}>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div data-testid="collapsible-content">{children}</div>,
  CollapsibleTrigger: ({ children }: any) => <div data-testid="collapsible-trigger">{children}</div>,
}));

vi.mock('./PlanApprovalButton', () => ({
  PlanApprovalButton: (props: any) => <div data-testid="plan-approval" data-executed={props.planExecuted} />,
}));

/** Helper: create a Message with sensible defaults */
function makeMsg(overrides: Partial<Message> = {}): Message {
  return { id: 'test-1', type: 'user_message' as const, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. Type Routing
// ---------------------------------------------------------------------------
describe('Type Routing', () => {
  it('user_message renders "You" label', () => {
    render(<MessageBubble message={makeMsg({ type: 'user_message', prompt: 'hello' })} />);
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('assistant_text renders MarkdownRenderer with streaming indicator', () => {
    render(<MessageBubble message={makeMsg({ type: 'assistant_text', text: 'thinking...' })} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('thinking...');
    expect(screen.getByText(/streaming/)).toBeInTheDocument();
  });

  it('result renders MarkdownRenderer (no streaming indicator)', () => {
    render(<MessageBubble message={makeMsg({ type: 'result', text: 'final answer' })} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('final answer');
    expect(screen.queryByText(/streaming/)).not.toBeInTheDocument();
  });

  it('tool_use renders tool name in Collapsible', () => {
    render(<MessageBubble message={makeMsg({ type: 'tool_use', tool: 'Read' })} />);
    expect(screen.getByTestId('collapsible')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('file_change renders file change info', () => {
    render(
      <MessageBubble
        message={makeMsg({ type: 'file_change', change: { tool: 'Write', file: 'src/app.ts' } })}
      />,
    );
    expect(screen.getByText('src/app.ts')).toBeInTheDocument();
  });

  it('error renders error text with warning icon', () => {
    render(<MessageBubble message={makeMsg({ type: 'error', text: 'something broke' })} />);
    expect(screen.getByText('something broke')).toBeInTheDocument();
    expect(screen.getByText('\u26A0')).toBeInTheDocument();
  });

  it('stderr renders stderr text', () => {
    render(<MessageBubble message={makeMsg({ type: 'stderr', text: 'warn: deprecated' })} />);
    expect(screen.getByText('warn: deprecated')).toBeInTheDocument();
  });

  it('system renders italic text', () => {
    render(<MessageBubble message={makeMsg({ type: 'system', text: 'session started' })} />);
    const el = screen.getByText('session started');
    expect(el).toBeInTheDocument();
    expect(el.closest('.italic')).toBeTruthy();
  });

  it('event renders Event label', () => {
    render(
      <MessageBubble
        message={makeMsg({ type: 'event', event: { type: 'heartbeat' } })}
      />,
    );
    expect(screen.getByText(/Event:/)).toBeInTheDocument();
    // "heartbeat" appears in both the trigger label and the JSON dump
    expect(screen.getAllByText(/heartbeat/).length).toBeGreaterThanOrEqual(1);
  });

  it('permission_request renders "Permission Required" text', () => {
    render(
      <MessageBubble message={makeMsg({ type: 'permission_request', tool: 'Bash' })} />,
    );
    expect(screen.getByText('Permission Required')).toBeInTheDocument();
    expect(screen.getByText('Bash')).toBeInTheDocument();
  });

  it('unknown/default type renders [type] debug element', () => {
    render(
      <MessageBubble message={makeMsg({ type: 'tool_result' as any })} />,
    );
    expect(screen.getByText('[tool_result]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. UserMessage
// ---------------------------------------------------------------------------
describe('UserMessage', () => {
  it('extracts text from message.message.content (nested object)', () => {
    const msg = makeMsg({
      type: 'user_message',
      message: { content: 'nested content', prompt: 'ignored' } as any,
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('nested content')).toBeInTheDocument();
  });

  it('falls back to message.prompt', () => {
    const msg = makeMsg({ type: 'user_message', prompt: 'fallback prompt' });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('fallback prompt')).toBeInTheDocument();
  });

  it('applies search highlight when searchQuery provided', () => {
    const msg = makeMsg({ type: 'user_message', prompt: 'hello world' });
    render(<MessageBubble message={msg} searchQuery="world" />);
    const mark = screen.getByText('world');
    expect(mark.tagName).toBe('MARK');
  });
});

// ---------------------------------------------------------------------------
// 3. AssistantText
// ---------------------------------------------------------------------------
describe('AssistantText', () => {
  it('passes message.text to MarkdownRenderer', () => {
    render(<MessageBubble message={makeMsg({ type: 'assistant_text', text: 'hello from claude' })} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('hello from claude');
  });

  it('shows "streaming..." indicator', () => {
    render(<MessageBubble message={makeMsg({ type: 'assistant_text', text: '' })} />);
    expect(screen.getByText(/streaming/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. ResultMessage
// ---------------------------------------------------------------------------
describe('ResultMessage', () => {
  it('shows cost when present (e.g. "$0.0123")', () => {
    render(<MessageBubble message={makeMsg({ type: 'result', cost: 0.0123 })} />);
    // Text nodes are split by the emoji and whitespace, so use a function matcher
    expect(screen.getByText((_content, el) =>
      el?.tagName === 'SPAN' && el.textContent?.includes('$0.0123') === true,
    )).toBeInTheDocument();
  });

  it('shows duration when present (e.g. "1.5s")', () => {
    render(<MessageBubble message={makeMsg({ type: 'result', duration_ms: 1500 })} />);
    expect(screen.getByText((_content, el) =>
      el?.tagName === 'SPAN' && el.textContent?.includes('1.5s') === true,
    )).toBeInTheDocument();
  });

  it('shows Plan badge when mode="plan"', () => {
    render(
      <MessageBubble
        message={makeMsg({ type: 'result', mode: 'plan' })}
        onExecutePlan={vi.fn()}
      />,
    );
    expect(screen.getByText('Plan')).toBeInTheDocument();
  });

  it('shows PlanApprovalButton when mode="plan" and onExecutePlan provided', () => {
    render(
      <MessageBubble
        message={makeMsg({ type: 'result', mode: 'plan', planExecuted: false })}
        onExecutePlan={vi.fn()}
      />,
    );
    expect(screen.getByTestId('plan-approval')).toBeInTheDocument();
    expect(screen.getByTestId('plan-approval')).toHaveAttribute('data-executed', 'false');
  });
});

// ---------------------------------------------------------------------------
// 5. ToolUseMessage
// ---------------------------------------------------------------------------
describe('ToolUseMessage', () => {
  it('shows tool name', () => {
    render(<MessageBubble message={makeMsg({ type: 'tool_use', tool: 'Write' })} />);
    expect(screen.getByText('Write')).toBeInTheDocument();
  });

  it('running status applies border-l-info', () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ type: 'tool_use', tool: 'Bash', status: 'running' })} />,
    );
    const bordered = container.querySelector('.border-l-info');
    expect(bordered).toBeInTheDocument();
  });

  it('done status applies border-l-success', () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ type: 'tool_use', tool: 'Bash', status: 'done' })} />,
    );
    const bordered = container.querySelector('.border-l-success');
    expect(bordered).toBeInTheDocument();
  });

  it('error status applies border-l-destructive', () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ type: 'tool_use', tool: 'Bash', status: 'error' })} />,
    );
    const bordered = container.querySelector('.border-l-destructive');
    expect(bordered).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. ToolStatusIcon (via ToolUseMessage)
// ---------------------------------------------------------------------------
describe('ToolStatusIcon via ToolUseMessage', () => {
  it('done status renders checkmark character (\u2713)', () => {
    render(<MessageBubble message={makeMsg({ type: 'tool_use', tool: 'T', status: 'done' })} />);
    expect(screen.getByText('\u2713')).toBeInTheDocument();
  });

  it('error status renders X character (\u2715)', () => {
    render(<MessageBubble message={makeMsg({ type: 'tool_use', tool: 'T', status: 'error' })} />);
    expect(screen.getByText('\u2715')).toBeInTheDocument();
  });

  it('running status renders spinner (animated element)', () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ type: 'tool_use', tool: 'T', status: 'running' })} />,
    );
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. ErrorMessage
// ---------------------------------------------------------------------------
describe('ErrorMessage', () => {
  it('shows error text from message.message or message.text', () => {
    render(
      <MessageBubble message={makeMsg({ type: 'error', message: 'msg error' as any })} />,
    );
    expect(screen.getByText('msg error')).toBeInTheDocument();
  });

  it('applies search highlight', () => {
    render(
      <MessageBubble
        message={makeMsg({ type: 'error', text: 'fatal crash' })}
        searchQuery="fatal"
      />,
    );
    const mark = screen.getByText('fatal');
    expect(mark.tagName).toBe('MARK');
  });
});

// ---------------------------------------------------------------------------
// 8. SystemMessage
// ---------------------------------------------------------------------------
describe('SystemMessage', () => {
  it('shows italic text', () => {
    render(<MessageBubble message={makeMsg({ type: 'system', text: 'system notice' })} />);
    const el = screen.getByText('system notice');
    expect(el).toBeInTheDocument();
    // The span has class "italic"
    expect(el.className).toContain('italic');
  });
});

// ---------------------------------------------------------------------------
// 9. Memo behavior
// ---------------------------------------------------------------------------
describe('Memo behavior', () => {
  it('MessageBubble is wrapped with React.memo', () => {
    // React.memo wraps the component; the $$typeof for memo is Symbol.for('react.memo')
    // We can check the component's type displayName or the memo wrapper
    expect(MessageBubble).toHaveProperty('$$typeof', Symbol.for('react.memo'));
  });
});
