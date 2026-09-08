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

export interface NavItem {
  label: string;
  route: string;
  icon: LucideIcon;
  roles: Role[];
}

export const NAV: NavItem[] = [
  { label: 'Dashboard', route: '/', icon: Home, roles: ['CITIZEN', 'ADMIN'] },
  { label: 'Get Started', route: '/start', icon: Compass, roles: ['CITIZEN'] },
  { label: 'My Profile', route: '/profile', icon: UserRound, roles: ['CITIZEN'] },
  { label: 'Scheme Matches', route: '/schemes', icon: ClipboardList, roles: ['CITIZEN'] },
  { label: 'Loan Planner', route: '/loan-planner', icon: Calculator, roles: ['CITIZEN'] },
  { label: 'Documents', route: '/documents', icon: FolderOpen, roles: ['CITIZEN'] },
  { label: 'Partner Routing', route: '/partners', icon: Send, roles: ['CITIZEN'] },
  { label: 'Applications', route: '/applications', icon: FileText, roles: ['CITIZEN', 'ADMIN'] },
  { label: 'Admin Dashboard', route: '/admin', icon: BarChart3, roles: ['ADMIN'] },
];

export const navFor = (role: Role) => NAV.filter((n) => n.roles.includes(role));
