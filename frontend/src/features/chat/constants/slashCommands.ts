import type { LucideIcon } from 'lucide-react';
import { HelpCircle, Trash2, Minimize2, Cpu, Settings, FolderOpen } from 'lucide-react';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  scope: 'frontend' | 'backend';
  requiresConnection: boolean;
  availableWhileRunning: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'help',
    label: '/help',
    description: '사용 가능한 명령어 목록 표시',
    icon: HelpCircle,
    scope: 'frontend',
    requiresConnection: false,
    availableWhileRunning: true,
  },
  {
    id: 'clear',
    label: '/clear',
    description: '현재 대화 내역 초기화',
    icon: Trash2,
    scope: 'frontend',
    requiresConnection: false,
    availableWhileRunning: false,
  },
  {
    id: 'compact',
    label: '/compact',
    description: '대화를 요약하여 컨텍스트 압축',
    icon: Minimize2,
    scope: 'backend',
    requiresConnection: true,
    availableWhileRunning: false,
  },
  {
    id: 'model',
    label: '/model',
    description: '사용할 모델 변경',
    icon: Cpu,
    scope: 'backend',
    requiresConnection: true,
    availableWhileRunning: false,
  },
  {
    id: 'settings',
    label: '/settings',
    description: '세션 설정 패널 열기',
    icon: Settings,
    scope: 'frontend',
    requiresConnection: false,
    availableWhileRunning: true,
  },
  {
    id: 'files',
    label: '/files',
    description: '파일 변경 패널 토글',
    icon: FolderOpen,
    scope: 'frontend',
    requiresConnection: false,
    availableWhileRunning: true,
  },
];
