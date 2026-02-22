import type { PaletteCommand, CommandContext, RouteZone } from "./types";

export interface RuntimeContext {
  activeSessionId: string | null;
  sessionStatus: string | null;
  isGitRepo: boolean;
  routeZone: RouteZone;
}

/** pathname을 RouteZone으로 변환 */
export function resolveRouteZone(pathname: string): RouteZone {
  if (pathname === "/") return "home";
  if (pathname === "/session/new") return "session-new";
  if (pathname.startsWith("/session/")) return "session-workspace";
  if (pathname === "/history") return "history";
  if (pathname === "/analytics") return "analytics";
  return "home";
}

function isCommandAvailable(
  context: CommandContext | undefined,
  runtime: RuntimeContext,
): boolean {
  if (!context) return true;

  if (context.allowedZones && !context.allowedZones.includes(runtime.routeZone))
    return false;

  if (context.requiresActiveSession && !runtime.activeSessionId) return false;
  if (context.requiresRunning === true && runtime.sessionStatus !== "running")
    return false;
  if (context.requiresRunning === false && runtime.sessionStatus === "running")
    return false;
  if (context.requiresGit && !runtime.isGitRepo) return false;

  return true;
}

export function filterCommandsByContext(
  commands: PaletteCommand[],
  runtime: RuntimeContext,
): PaletteCommand[] {
  return commands.filter((cmd) => isCommandAvailable(cmd.context, runtime));
}
