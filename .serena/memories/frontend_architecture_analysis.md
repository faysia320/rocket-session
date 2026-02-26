# Frontend Architecture Analysis - rocket-session

**Analysis Date**: 2026-02-13  
**Project**: Claude Code Dashboard (rocket-session)  
**Scope**: Complete frontend TypeScript/React source code

---

## 1. Project Structure Summary

```
frontend/src/
├── features/
│   ├── chat/
│   │   ├── components/ (ChatPanel, MessageBubble)
│   │   └── hooks/ (useClaudeSocket - WebSocket connection)
│   ├── files/
│   │   └── components/ (FilePanel - displays file changes)
│   └── session/
│       ├── components/ (Sidebar - session list)
│       └── hooks/ (useSessions - TanStack Query)
├── routes/
│   ├── __root.tsx (Root layout with Sidebar)
│   ├── index.tsx (Home - EmptyState)
│   └── session/$sessionId.tsx (Session workspace)
├── types/
│   ├── session.ts (SessionInfo, SessionStatus)
│   └── message.ts (Message, FileChange, WebSocketEvent)
├── store/
│   └── useSessionStore.ts (Zustand - active session ID, UI state)
└── lib/api/
    └── sessions.api.ts (REST API wrapper functions)
```

---

## 2. Core Architecture Patterns

### 2.1 State Management (3-Layer)

| Layer | Tool | Purpose | Scope |
|-------|------|---------|-------|
| **Server State** | TanStack Query | API data (sessions list, session details) | Global |
| **Client State** | Zustand | UI state (active session ID, showFiles toggle) | Global |
| **Local State** | React `useState` | Component-level state (input, form values) | Component |

### 2.2 Communication Flow

```
User Input (ChatPanel)
    ↓
sendPrompt() via WebSocket
    ↓
Backend (FastAPI + subprocess)
    ↓
JSON stream parsing (useClaudeSocket)
    ↓
State update (messages, fileChanges)
    ↓
Message rendering (MessageBubble)
    ↓
File changes display (FilePanel)
```

### 2.3 WebSocket Management

- **Hook**: `useClaudeSocket(sessionId: string)`
- **Features**:
  - Auto-reconnect on disconnect (3s timeout)
  - Real-time message streaming
  - File change tracking
  - Session state synchronization
  - Prompt submission & execution control
- **Message Types Handled**: 
  - `session_state`, `session_info`, `status`
  - `user_message`, `assistant_text`, `tool_use`
  - `file_change`, `result`, `error`, `stderr`
  - `stopped`, `event`

### 2.4 Component Hierarchy

```
RootComponent (__root.tsx)
├── Sidebar (useSessions hook)
│   └── Session list items
│       └── Selection & deletion handlers
│
└── Router Outlet
    └── SessionPage (session/$sessionId.tsx)
        ├── ChatPanel (useClaudeSocket hook)
        │   ├── Message list (MessageBubble)
        │   └── Input textarea
        │
        └── FilePanel (conditional)
            └── File changes list
```

---

## 3. Key Data Types

### 3.1 Session Types
```typescript
// SessionInfo (REST API response)
{
  id: string;                    // Session UUID
  status: 'idle' | 'running' | 'error' | 'stopped';
  work_dir: string;              // Working directory path
  message_count: number;         // Total messages
  file_changes_count: number;    // Total file changes
  claude_session_id?: string;    // Claude Code session ID
  created_at?: string;           // ISO timestamp
}

// CreateSessionRequest
{
  work_dir?: string | null;
}
```

### 3.2 Message Types
```typescript
// Message (WebSocket events)
{
  type: MessageType;             // user_message, assistant_text, tool_use, error, etc.
  text?: string;                 // Formatted text output
  message?: string;              // Message content
  content?: string;              // Alternative content
  prompt?: string;               // User prompt
  tool?: string;                 // Tool name (Read, Write, Edit, Bash, etc.)
  input?: Record<string, unknown>; // Tool input parameters
  change?: FileChange;           // For file_change type
  event?: Record<string, unknown>; // Generic event data
  cost?: number;                 // API cost
  duration_ms?: number;          // Execution duration
  timestamp?: string;            // ISO timestamp
}

// FileChange
{
  tool: string;                  // Write, Edit, Read, Bash
  file: string;                  // File path
  timestamp?: string;            // ISO timestamp
}
```

### 3.3 UI State (Zustand)
```typescript
{
  activeSessionId: string | null;  // Currently selected session
  showFiles: boolean;              // File panel visibility toggle
  setActiveSessionId: (id) => void;
  toggleFiles: () => void;
}
```

---

## 4. Key Hooks & APIs

### 4.1 useClaudeSocket(sessionId: string)
**Returns**:
```typescript
{
  connected: boolean;                    // WebSocket connection status
  messages: Message[];                   // Streamed messages
  status: 'idle' | 'running';           // Execution status
  sessionInfo: SessionState | null;      // Session metadata
  fileChanges: FileChange[];            // File modifications
  sendPrompt: (prompt, allowedTools?) => void;  // Send user prompt
  stopExecution: () => void;            // Stop running session
}
```

### 4.2 useSessions() Hook
**Location**: `features/session/hooks/useSessions.ts` (not shown, but inferred from usage)

**Expected Returns**:
```typescript
{
  sessions: SessionInfo[];
  activeSessionId: string | null;
  createSession: (workDir?: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  selectSession: (id: string) => void;
}
```

**Uses TanStack Query with custom keys** (sessionKeys factory pattern)

### 4.3 REST API (sessions.api.ts)
```typescript
sessionsApi = {
  create: (workDir?: string) => POST /api/sessions/
  list: () => GET /api/sessions/
  get: (id: string) => GET /api/sessions/{id}
  delete: (id: string) => DELETE /api/sessions/{id}
  stop: (id: string) => POST /api/sessions/{id}/stop
  history: (id: string) => GET /api/sessions/{id}/history
  files: (id: string) => GET /api/sessions/{id}/files
}
```

---

## 5. Styling & Design System

### 5.1 CSS Approach
- **Primary**: Tailwind CSS utility classes
- **UI Components**: shadcn/ui + Radix UI
- **Theme**: Deep Space (HSL CSS variables)
- **Utilities**: `cn()` from `@/lib/utils` (clsx + tailwind-merge)

### 5.2 Color Tokens (HSL Format)
```
--background: 220 50% 5%        (Main bg - very dark blue)
--foreground: 215 25% 90%       (Text - light blue-gray)
--card: 220 37% 7%              (Card bg - dark)
--primary: 38 92% 50%           (Accent - amber/gold)
--secondary: 217 33% 17%        (Secondary - mid-gray)
--muted: 217 33% 17%            (Muted text bg)
--input: 220 45% 8%             (Input fields - dark)
--border: 217 33% 17%           (Border color)
--destructive: 0 84% 60%        (Error/delete red)
--success: 142 71% 45%          (Success green)
--info: 217 91% 60%             (Info blue)
--warning: 38 92% 50%           (Warning amber)
```

### 5.3 Spacing System
Uses Tailwind's default spacing scale (4px grid).
Custom design tokens available in `frontend/design-system/css/variables.css`.

---

## 6. Component Deep Dive

### 6.1 ChatPanel.tsx
**Props**:
```typescript
{
  sessionId: string;
  onToggleFiles: () => void;
  showFiles: boolean;
  onFileChanges: (changes: FileChange[]) => void;
}
```

**Features**:
- Real-time message display
- Auto-scroll to latest message
- Connection status indicator (green dot + "Connected" badge)
- Running status badge with spinner
- Claude Session ID display (truncated)
- Textarea with auto-height (min 44px, max 200px)
- Shift+Enter for newline, Enter to send
- Send/Stop button toggle
- File panel toggle button

**Key Functions**:
- `handleSubmit()`: Send prompt via WebSocket
- `handleTextareaInput()`: Auto-resize textarea
- `handleKeyDown()`: Enter key handling

### 6.2 MessageBubble.tsx
**Props**: `{ message: Message }`

**Expected Behavior** (from usage):
- Renders individual messages with type-specific styling
- Supports multiple message types (user_message, assistant_text, tool_use, error, etc.)
- Markdown rendering for text content
- Tool input display

### 6.3 FilePanel.tsx
**Props**: `{ fileChanges?: FileChange[] }`

**Features**:
- Header with folder emoji + file count badge
- Empty state with folder emoji
- File change list with:
  - Tool badge (Write=green, Edit=blue, Read=gray)
  - Formatted timestamp
  - File path (break-all for long paths)
  - Fade-in animation (fadeIn 0.2s)

**Styling**:
- Width: 280px fixed
- Scrollable content area
- Badge colors by tool type

### 6.4 Sidebar.tsx
**Props**:
```typescript
{
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: (workDir?: string) => void;
  onDelete: (id: string) => void;
}
```

**Features**:
- Header with diamond icon + "CC Dashboard" title
- New Session button with optional working directory input
- Sessions list with:
  - Status indicator dot (green=running, red=error, gray=idle)
  - Session ID
  - Delete button (x)
  - Message count + file changes count
  - Truncated work directory path
- Footer with version info
- Active session highlighting

**Path Truncation**: Shows last 2 directory parts with `~/` prefix

### 6.5 SessionPage (session/$sessionId.tsx)
**Route Parameter**: `sessionId` (from URL)

**Layout**:
- Flex container with ChatPanel (flex-1) + optional FilePanel
- Local state for showFiles toggle
- File changes state management (lifted from ChatPanel via callback)

### 6.6 RootComponent (__root.tsx)
**Layout**:
- Sidebar (260px fixed width)
- Main content area (flex-1)
- Sidebar manages:
  - Sessions list (from useSessions hook)
  - Active session selection
  - Session creation & deletion

---

## 7. Current Message Types & WebSocket Events

### 7.1 Incoming WebSocket Messages (useClaudeSocket handler)

| Type | Handler Behavior | Fields Used |
|------|------------------|-------------|
| `session_state` | Set sessionInfo + parse history | `session`, `history` |
| `session_info` | Update sessionInfo with claude_session_id | `claude_session_id` |
| `status` | Update execution status | `status` |
| `user_message` | Append to messages | All message fields |
| `assistant_text` | Append or merge with last message | All message fields |
| `tool_use` | Append to messages | `tool`, `input` |
| `file_change` | Append to fileChanges | `change.tool`, `change.file`, `change.timestamp` |
| `result` | Append after cleaning assistant_text | All message fields |
| `error` | Append to messages | `text` |
| `stderr` | Create new stderr message | `text` |
| `stopped` | Set status='idle', add system message | (none) |
| `event` | Append generic event message | `event` |

### 7.2 Outgoing WebSocket Messages

| Type | Purpose | Fields |
|------|---------|--------|
| `prompt` | Submit user input | `prompt`, `allowed_tools?` |
| `stop` | Abort execution | (none) |

---

## 8. Feature Extensibility Points

### 8.1 New Message Types
1. Add to `MessageType` in `types/message.ts`
2. Add handler case in `useClaudeSocket` `handleMessage()`
3. Create rendering component in `MessageBubble` (if needed)

### 8.2 New Data Panels
1. Create component in `features/[new-feature]/components/`
2. Add state to session route if needed
3. Wire up via callback pattern (like `onFileChanges`)
4. Add toggle button in ChatPanel header

### 8.3 New REST API Endpoints
1. Add function to `sessions.api.ts`
2. Use TanStack Query if caching needed
3. Add custom hook in `features/[feature]/hooks/`

### 8.4 New Routes
1. Create file in `routes/` with TanStack Router syntax
2. Use `createFileRoute()` with component export
3. Add to navigation (likely via Sidebar or ChatPanel)

---

## 9. Known Limitations & Gaps

1. **MessageBubble.tsx**: Not read (source file not provided)
   - Inferred: Renders individual message types
   - Likely uses markdown + syntax highlighting

2. **useSessions.ts**: Not read (only inferred from usage)
   - Expected: TanStack Query with sessionKeys factory
   - Expected: Manages session CRUD + selection logic

3. **Zustand Store**: Currently minimal
   - `activeSessionId` + `showFiles` only
   - Could expand for more global UI state

4. **No Error Boundaries**: No error handling UI visible
   - Could add retry mechanisms
   - Could add error notification system

5. **No Search/Filter**: Sessions list not searchable
   - Could add search input in Sidebar
   - Could add session tagging/filtering

6. **No Session Metadata Editing**: Session info is read-only in UI
   - Could add edit work_dir feature
   - Could add session rename feature

---

## 10. Type Safety Status

- **TypeScript**: Strict mode enabled (tsconfig.app.json)
- **Path Aliases**: Full support (`@/` prefix)
- **Types**: Well-defined in `types/` directory
- **React**: Version 18.3.x with modern hooks
- **Build**: Vite 6.x for fast dev/prod builds

---

## 11. Performance Considerations

### 11.1 Optimizations Present
1. **Virtual scrolling**: ScrollArea component from shadcn/ui
2. **Message list rendering**: Key-based (index - could be improved with UUID)
3. **WebSocket auto-reconnect**: 3-second retry timeout
4. **Auto-scroll**: Only on new messages
5. **Textarea auto-height**: Clamped max 200px

### 11.2 Potential Improvements
1. **Message virtualization**: For large message lists (1000+)
2. **Memo optimization**: ChatPanel, MessageBubble could use React.memo
3. **Debounced textarea resizing**: Could reduce reflows
4. **Key-based message lists**: Use UUIDs instead of array indices

---

## 12. Dependencies (Frontend)

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.3.x | UI framework |
| typescript | 5.x | Type safety |
| @tanstack/react-router | 1.x | File-based routing |
| @tanstack/react-query | 5.x | Server state management |
| zustand | 5.x | Client state management |
| tailwindcss | 3.4.x | Utility CSS |
| shadcn/ui | Latest | Component library |
| lucide-react | - | Icon library |
| react-markdown | 9.x | Markdown rendering |
| remark-gfm | - | GitHub-flavored markdown |
| sonner | - | Toast notifications |
| clsx + tailwind-merge | - | Class merging (via cn()) |

---

## 13. Architecture Recommendations for New Features

### 13.1 Feature-Based Structure
Always create new features in `src/features/[feature-name]/`:
```
features/my-feature/
├── components/
│   ├── MyFeaturePanel.tsx
│   └── MyFeatureItem.tsx
├── hooks/
│   ├── useMyFeature.ts
│   └── myFeatureKeys.ts (TanStack Query)
└── (optional) pages/ or context/
```

### 13.2 Type Safety Checklist
- [ ] Add types to `types/` directory
- [ ] Define WebSocket event types in `types/message.ts`
- [ ] Use TypeScript strict mode
- [ ] Path aliases for all imports (`@/`)

### 13.3 State Management Decision Tree
- **Global UI state** (active tab, sidebar collapse) → Zustand
- **Server data** (sessions, history) → TanStack Query
- **Component local state** (form input) → React useState
- **Context data** (WebSocket state) → useContext or custom hook

### 13.4 Styling Patterns
- Use `cn()` utility for conditional classes
- Leverage CSS variables from theme
- Avoid inline styles
- Use shadcn/ui components as base

---

## 14. Current Integration Points with Backend

### 14.1 REST API Endpoints
- `POST /api/sessions/` - Create session
- `GET /api/sessions/` - List sessions
- `GET /api/sessions/{id}` - Get session
- `DELETE /api/sessions/{id}` - Delete session
- `POST /api/sessions/{id}/stop` - Stop execution
- `GET /api/sessions/{id}/history` - Session history
- `GET /api/sessions/{id}/files` - File changes

### 14.2 WebSocket Endpoint
- `WS /ws/{sessionId}` - Real-time communication
- Proxy: `http://localhost:8101` (dev)
- Vite proxy configured in `vite.config.ts`

---

## Summary for Feature Planning

**Current Capabilities**:
- Real-time multi-session management
- Live message streaming
- File change tracking
- Status monitoring
- Responsive UI with Deep Space theme

**Extension Points**:
1. New message types (add to WebSocket handler)
2. New UI panels (sidebar, session details)
3. New REST endpoints (via TanStack Query)
4. New routes (file-based routing)
5. New client state (Zustand store)

**Best Practices for Additions**:
- Follow feature-based directory structure
- Use TanStack Query for server state
- Use Zustand for global UI state
- Use TypeScript strict mode
- Test accessibility with shadcn/ui components
