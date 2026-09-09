import {
  Home,
  UserRound,
  ClipboardList,
  Calculator,
  FolderOpen,
  Send,
  FileText,
  BarChart3,
  Compass,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../api/types';
import type { DictKey } from '../i18n/dict';

export interface NavItem {
  labelKey: DictKey;
  route: string;
  icon: LucideIcon;
  roles: Role[];
}

export const NAV: NavItem[] = [
  { labelKey: 'nav.dashboard', route: '/', icon: Home, roles: ['CITIZEN', 'ADMIN'] },
  { labelKey: 'nav.getStarted', route: '/start', icon: Compass, roles: ['CITIZEN'] },
  { labelKey: 'nav.profile', route: '/profile', icon: UserRound, roles: ['CITIZEN'] },
  { labelKey: 'nav.schemes', route: '/schemes', icon: ClipboardList, roles: ['CITIZEN'] },
  { labelKey: 'nav.loanPlanner', route: '/loan-planner', icon: Calculator, roles: ['CITIZEN'] },
  { labelKey: 'nav.documents', route: '/documents', icon: FolderOpen, roles: ['CITIZEN'] },
  { labelKey: 'nav.partners', route: '/partners', icon: Send, roles: ['CITIZEN'] },
  { labelKey: 'nav.applications', route: '/applications', icon: FileText, roles: ['CITIZEN', 'ADMIN'] },
  { labelKey: 'nav.admin', route: '/admin', icon: BarChart3, roles: ['ADMIN'] },
];

export const navFor = (role: Role) => NAV.filter((n) => n.roles.includes(role));
