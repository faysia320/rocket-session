import type { PaletteCommand, CommandContext } from "./types";

export interface RuntimeContext {
  activeSessionId: string | null;
  sessionStatus: string | null;
  isGitRepo: boolean;
}

function isCommandAvailable(
  context: CommandContext | undefined,
  runtime: RuntimeContext,
): boolean {
  if (!context) return true;

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
