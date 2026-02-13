import { useState, useCallback, useMemo } from 'react';
import { SLASH_COMMANDS, type SlashCommand } from '../constants/slashCommands';

interface UseSlashCommandsOptions {
  connected: boolean;
  isRunning: boolean;
}

export function useSlashCommands({ connected, isRunning }: UseSlashCommandsOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [filterText, setFilterText] = useState('');

  const filteredCommands = useMemo(() => {
    const available = SLASH_COMMANDS.filter((cmd) => {
      if (cmd.requiresConnection && !connected) return false;
      if (!cmd.availableWhileRunning && isRunning) return false;
      return true;
    });

    if (!filterText) return available;

    const lower = filterText.toLowerCase();
    return available.filter(
      (cmd) =>
        cmd.id.includes(lower) ||
        cmd.label.includes(lower) ||
        cmd.description.toLowerCase().includes(lower),
    );
  }, [filterText, connected, isRunning]);

  const handleInputChange = useCallback((value: string) => {
    if (value === '/') {
      setIsOpen(true);
      setFilterText('');
      setActiveIndex(0);
    } else if (value.startsWith('/')) {
      setIsOpen(true);
      setFilterText(value.slice(1));
      setActiveIndex(0);
    } else {
      setIsOpen(false);
      setFilterText('');
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): SlashCommand | null => {
      if (!isOpen) return null;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0,
          );
          return null;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1,
          );
          return null;
        case 'Enter':
          if (filteredCommands.length > 0) {
            e.preventDefault();
            const selected = filteredCommands[activeIndex];
            setIsOpen(false);
            setFilterText('');
            return selected;
          }
          return null;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setFilterText('');
          return null;
        case 'Tab':
          if (filteredCommands.length > 0) {
            e.preventDefault();
            const selected = filteredCommands[activeIndex];
            setIsOpen(false);
            setFilterText('');
            return selected;
          }
          return null;
        default:
          return null;
      }
    },
    [isOpen, activeIndex, filteredCommands],
  );

  const selectCommand = useCallback((cmd: SlashCommand) => {
    setIsOpen(false);
    setFilterText('');
    return cmd;
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setFilterText('');
  }, []);

  return {
    isOpen,
    filteredCommands,
    activeIndex,
    setActiveIndex,
    handleInputChange,
    handleKeyDown,
    selectCommand,
    close,
  };
}
