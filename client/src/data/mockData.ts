import { ActivityItem, Player, Ticket, AuditLog } from "@/lib/types";

// Recent activity items for home dashboard
export const recentActivity: ActivityItem[] = [
  {
    type: 'ticket',
    title: 'New Ban Appeal',
    description: 'SkyWarrior123 appealed their ban for using prohibited mods',
    time: '10 min ago',
    color: 'primary',
    actions: [
      { label: 'View Appeal', primary: true },
      { label: 'Dismiss', primary: false }
    ]
  },
  {
    type: 'moderation',
    title: 'Mod Action',
    description: 'Moderator2 muted Player_XYZ for 30 minutes due to spam',
    time: '25 min ago',
    color: 'info',
    actions: [
      { label: 'Review', primary: true }
    ]
  },
  {
    type: 'report',
    title: 'New Chat Report',
    description: 'Player GreenDragon reported ToxicPlayer99 for hate speech',
    time: '45 min ago',
    color: 'destructive',
    actions: [
      { label: 'Investigate', primary: true },
      { label: 'Dismiss', primary: false }
    ]
  },
  {
    type: 'ai',
    title: 'AI Action',
    description: 'AI filtered message from Player123 for containing prohibited words',
    time: '1 hour ago',
    color: 'success',
    actions: [
      { label: 'Review', primary: true }
    ]
  }
];

// Recent lookups for the lookup page
export const recentLookups: Player[] = [
  {
    username: 'DragonSlayer123',
    uuid: '12a3b456-7c89-123a-4b5c-6d7890123e4f',
    lastOnline: '2 hours ago',
    status: 'Active'
  },
  {
    username: 'PixelWarrior',
    uuid: '98f7e654-3d21-321d-4c5b-6a7890123d4e',
    lastOnline: '5 hours ago',
    status: 'Warned'
  },
  {
    username: 'SkyBuilder99',
    uuid: '45b6a789-0c12-543e-6f7g-8h9012345i6j',
    lastOnline: '1 day ago',
    status: 'Banned'
  }
];

// Tickets data for the tickets page
export const tickets: Ticket[] = [
  {
    id: '#BUG-1234',
    type: 'bug',
    subject: 'Item disappears when dropped in lava biome',
    reportedBy: 'MinerGuy42',
    date: '2 hours ago',
    status: 'Open',
    priority: 'Critical'
  },
  {
    id: '#BUG-1233',
    type: 'bug',
    subject: 'Server lags when more than 50 players are online',
    reportedBy: 'AdminHelper3',
    date: '5 hours ago',
    status: 'In Progress',
    priority: 'Medium'
  },
  {
    id: '#BUG-1232',
    type: 'bug',
    subject: 'Console spam when players enter the nether',
    reportedBy: 'ServerDev1',
    date: '1 day ago',
    status: 'Open',
    priority: 'Low'
  },
  {
    id: '#BUG-1231',
    type: 'bug',
    subject: 'Wrong teleport location when using /spawn command',
    reportedBy: 'MapMaker55',
    date: '2 days ago',
    status: 'Fixed',
    priority: 'Fixed'
  },
  {
    id: '#PLR-0987',
    type: 'player',
    subject: 'Player using speed hacks',
    reportedBy: 'Referee22',
    date: '3 hours ago',
    status: 'Open',
    priority: 'Critical'
  },
  {
    id: '#PLR-0986',
    type: 'player',
    subject: 'Suspicious xray-like behavior',
    reportedBy: 'Guardian78',
    date: '1 day ago',
    status: 'In Progress',
    priority: 'Medium'
  },
  {
    id: '#CHT-0554',
    type: 'chat',
    subject: 'Player spamming in global chat',
    reportedBy: 'Peacekeeper',
    date: '4 hours ago',
    status: 'Open',
    priority: 'Medium'
  },
  {
    id: '#CHT-0553',
    type: 'chat',
    subject: 'Inappropriate language directed at moderator',
    reportedBy: 'ModHelper',
    date: '6 hours ago',
    status: 'In Progress',
    priority: 'Critical'
  },
  {
    id: '#APP-0221',
    type: 'appeal',
    subject: 'Ban appeal for minor griefing',
    reportedBy: 'BuilderX',
    date: '2 days ago',
    status: 'Open',
    priority: 'Low'
  },
  {
    id: '#APP-0220',
    type: 'appeal',
    subject: 'Ban appeal for using prohibited client mods',
    reportedBy: 'FastRunner',
    date: '3 days ago',
    status: 'In Progress',
    priority: 'Medium'
  }
];

// Audit logs for the audit page
export const auditLogs: AuditLog[] = [
  {
    user: 'Moderator2',
    userType: 'Staff',
    actionType: 'staff',
    action: 'Banned player "HackerDude420" for "Using prohibited client mods"',
    detail: 'Ban Duration: 30 days',
    viewText: 'View Details',
    time: '10 minutes ago',
    color: 'primary'
  },
  {
    user: 'ServerAI',
    userType: 'AI',
    actionType: 'ai',
    action: 'Filtered chat message from "Player123" containing prohibited words',
    detail: 'Filter Rule: #F123',
    viewText: 'View Message',
    time: '25 minutes ago',
    color: 'secondary'
  },
  {
    user: 'System',
    userType: 'Auto',
    actionType: 'system',
    action: 'Scheduled server restart completed successfully',
    detail: 'Downtime: 2 minutes',
    viewText: 'View Logs',
    time: '1 hour ago',
    color: 'info'
  },
  {
    user: 'Admin1',
    userType: 'Admin',
    actionType: 'admin',
    action: 'Modified server settings: Updated chat filter rules',
    detail: 'Changes: 5 new rules added',
    viewText: 'View Changes',
    time: '3 hours ago',
    color: 'warning'
  },
  {
    user: 'Moderator5',
    userType: 'Staff',
    actionType: 'staff',
    action: 'Issued warning to player "ImJustPlaying" for "Building inappropriate structures"',
    detail: 'Warning: First offense',
    viewText: 'View Details',
    time: '5 hours ago',
    color: 'primary'
  }
];
