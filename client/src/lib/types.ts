export type WindowPosition = {
  x: number | string;
  y: number | string;
};

export interface ActivityItem {
  type: 'ticket' | 'moderation' | 'report' | 'ai';
  title: string;
  description: string;
  time: string;
  color: 'primary' | 'info' | 'warning' | 'destructive' | 'success';
  actions: {
    label: string;
    primary: boolean;
  }[];
}

export interface Player {
  username: string;
  uuid: string;
  lastOnline: string;
  status: 'Active' | 'Warned' | 'Banned';
}

export interface Ticket {
  id: string;
  type: 'bug' | 'player' | 'chat' | 'appeal';
  subject: string;
  reportedBy: string;
  date: string;
  status: string;
  priority: 'Critical' | 'Medium' | 'Low' | 'Fixed';
}

export interface AuditLog {
  user: string;
  userType: string;
  actionType: 'staff' | 'ai' | 'system' | 'admin';
  action: string;
  detail: string;
  viewText: string;
  time: string;
  color: 'primary' | 'secondary' | 'info' | 'warning';
}
