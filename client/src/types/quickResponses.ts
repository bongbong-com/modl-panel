export interface QuickResponseAction {
  id: string;
  name: string;
  message: string;
  order: number;
  
  // For punishment-related actions (Player/Chat Reports)
  issuePunishment?: boolean;
  punishmentTypeId?: number;
  punishmentSeverity?: 'low' | 'regular' | 'severe';
  customDuration?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  };
  
  // For appeal actions
  appealAction?: 'pardon' | 'reduce' | 'reject' | 'none';
  durationReduction?: {
    type: 'percentage' | 'fixed';
    value: number; // percentage (0-100) or fixed duration
    unit?: 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; // only for fixed type
  };
}

export interface QuickResponseCategory {
  id: string;
  name: string;
  ticketTypes: string[]; // ['player_report', 'chat_report', 'bug_report', 'appeal', 'support', 'other']
  actions: QuickResponseAction[];
  order: number;
}

export interface QuickResponsesConfiguration {
  categories: QuickResponseCategory[];
}

// Default configuration that will be used for provisioning
export const defaultQuickResponsesConfig: QuickResponsesConfiguration = {
  categories: [
    {
      id: 'report_actions',
      name: 'Report Actions',
      ticketTypes: ['player_report', 'chat_report'],
      order: 1,
      actions: [
        {
          id: 'accept_with_punishment',
          name: 'Accept & Punish',
          message: 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment.',
          order: 1,
          issuePunishment: true,
          // Will use staff discretion for punishment type and severity
        },
        {
          id: 'accept_warning',
          name: 'Accept & Warn',
          message: 'Thank you for creating this report. We have accepted this report and issued a warning to the reported player.',
          order: 2,
          issuePunishment: false,
        },
        {
          id: 'reject_insufficient',
          name: 'Reject - Insufficient Evidence',
          message: 'Thank you for submitting this report. After reviewing the evidence provided, we need additional evidence to proceed with action.',
          order: 3,
        },
        {
          id: 'reject_no_violation',
          name: 'Reject - No Violation',
          message: 'Thank you for submitting this report. After reviewing the evidence provided, we have determined that this does not violate our community guidelines.',
          order: 4,
        },
        {
          id: 'close_resolved',
          name: 'Close - Resolved',
          message: 'This ticket has been closed as resolved. Please feel free to open a new report if you encounter any other issues.',
          order: 5,
        }
      ]
    },
    {
      id: 'appeal_actions',
      name: 'Appeal Actions',
      ticketTypes: ['appeal'],
      order: 2,
      actions: [
        {
          id: 'pardon_full',
          name: 'Pardon - Full',
          message: 'After reviewing your appeal, we have decided to remove the punishment completely. We apologize for any inconvenience.',
          order: 1,
          appealAction: 'pardon',
        },
        {
          id: 'reduce_50',
          name: 'Reduce - 50%',
          message: 'We have reviewed your appeal and decided to reduce the duration of your punishment by 50%.',
          order: 2,
          appealAction: 'reduce',
          durationReduction: {
            type: 'percentage',
            value: 50,
          },
        },
        {
          id: 'reduce_25',
          name: 'Reduce - 25%',
          message: 'We have reviewed your appeal and decided to reduce the duration of your punishment by 25%.',
          order: 3,
          appealAction: 'reduce',
          durationReduction: {
            type: 'percentage',
            value: 25,
          },
        },
        {
          id: 'reduce_custom',
          name: 'Reduce - Custom',
          message: 'We have reviewed your appeal and decided to reduce the duration of your punishment.',
          order: 4,
          appealAction: 'reduce',
          // Custom duration will be set by staff
        },
        {
          id: 'reject_upheld',
          name: 'Reject - Upheld',
          message: 'After careful consideration of your appeal, we have decided to uphold the original punishment.',
          order: 5,
          appealAction: 'reject',
        },
        {
          id: 'close_appeal',
          name: 'Close',
          message: 'This appeal has been closed. If you have additional information, please create a new appeal.',
          order: 6,
        }
      ]
    },
    {
      id: 'bug_actions',
      name: 'Bug Report Actions',
      ticketTypes: ['bug_report'],
      order: 3,
      actions: [
        {
          id: 'completed',
          name: 'Completed',
          message: 'Thank you for reporting this bug. We have fixed the issue and it will be included in our next update.',
          order: 1,
        },
        {
          id: 'investigating',
          name: 'Investigating',
          message: 'Thank you for this bug report. We are currently investigating the issue and will provide updates as they become available.',
          order: 2,
        },
        {
          id: 'need_more_info',
          name: 'Need More Info',
          message: 'Thank you for this bug report. We need additional information to investigate this issue. Please provide more details about how to reproduce this bug.',
          order: 3,
        },
        {
          id: 'duplicate',
          name: 'Duplicate',
          message: 'This bug has been identified as a duplicate of an existing issue. We appreciate your report and are working on a fix.',
          order: 4,
        },
        {
          id: 'stale',
          name: 'Stale',
          message: 'This bug report has been marked as stale due to inactivity or lack of information.',
          order: 5,
        },
        {
          id: 'close_bug',
          name: 'Close',
          message: 'This bug report has been closed. Thank you for your contribution to improving our game.',
          order: 6,
        }
      ]
    },
    {
      id: 'support_actions',
      name: 'Support Actions',
      ticketTypes: ['support'],
      order: 4,
      actions: [
        {
          id: 'resolved',
          name: 'Resolved',
          message: 'Your support request has been resolved. If you need further assistance, please feel free to create a new ticket.',
          order: 1,
        },
        {
          id: 'escalated',
          name: 'Escalated',
          message: 'Your support request has been escalated to our specialized team. They will contact you with additional information.',
          order: 2,
        },
        {
          id: 'need_info_support',
          name: 'Need More Info',
          message: 'We need additional information to assist you with your request. Please provide more details about your issue.',
          order: 3,
        },
        {
          id: 'close_support',
          name: 'Close',
          message: 'This support ticket has been closed. Thank you for contacting us.',
          order: 4,
        }
      ]
    },
    {
      id: 'general_actions',
      name: 'General Actions',
      ticketTypes: ['other', 'support', 'bug_report', 'player_report', 'chat_report', 'appeal'],
      order: 5,
      actions: [
        {
          id: 'acknowledge',
          name: 'Acknowledge',
          message: 'Thank you for your message. We have received your ticket and will review it shortly.',
          order: 1,
        },
        {
          id: 'follow_up',
          name: 'Follow Up',
          message: 'We are following up on your ticket. Please let us know if you have any additional information or questions.',
          order: 2,
        },
        {
          id: 'close_general',
          name: 'Close - General',
          message: 'This ticket has been closed. Thank you for your message.',
          order: 3,
        }
      ]
    }
  ]
};