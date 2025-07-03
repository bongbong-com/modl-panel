import { Connection } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { calculatePlayerStatus } from '../utils/player-status-calculator';

interface PunishmentType {
  id: number;
  ordinal: number;
  name: string;
  category: string;
  durations?: {
    low: { 
      first: { value: number; unit: string; };
      medium: { value: number; unit: string; };
      habitual: { value: number; unit: string; };
    };
    regular: { 
      first: { value: number; unit: string; };
      medium: { value: number; unit: string; };
      habitual: { value: number; unit: string; };
    };
    severe: { 
      first: { value: number; unit: string; };
      medium: { value: number; unit: string; };
      habitual: { value: number; unit: string; };
    };
  };
  singleSeverityDurations?: {
    first: { value: number; unit: string; type: 'mute' | 'ban'; };
    medium: { value: number; unit: string; type: 'mute' | 'ban'; };
    habitual: { value: number; unit: string; type: 'mute' | 'ban'; };
  };
  singleSeverityPunishment?: boolean;
}

export class PunishmentService {
  private dbConnection: Connection;

  constructor(dbConnection: Connection) {
    this.dbConnection = dbConnection;
  }

  /**
   * Apply a punishment to a player using the existing punishment creation logic
   * @param playerIdentifier Player's UUID (preferred) or username
   * @param punishmentTypeId The ID of the punishment type to apply
   * @param severity The severity level of the punishment
   * @param reason The reason for the punishment
   * @param ticketId The ticket ID this punishment is associated with
   * @param issuerName The name of the issuer (defaults to AI Moderation System)
   */
  async applyPunishment(
    playerIdentifier: string,
    punishmentTypeId: number,
    severity: 'low' | 'regular' | 'severe',
    reason: string,
    ticketId: string,
    issuerName: string = 'AI Moderation System'
  ): Promise<{ success: boolean; punishmentId?: string; error?: string }> {
    try {
      const Player = this.dbConnection.model('Player');
      
      // Find player by UUID or username
      const player = await this.findPlayer(playerIdentifier);
      if (!player) {
        return { success: false, error: `Player ${playerIdentifier} not found` };
      }

      // Get punishment type details and calculate duration
      const punishmentData = await this.calculatePunishmentData(
        player, 
        punishmentTypeId, 
        severity, 
        reason, 
        ticketId
      );

      if (!punishmentData) {
        return { success: false, error: 'Failed to calculate punishment data' };
      }

      // Generate punishment ID
      const punishmentId = uuidv4().substring(0, 8).toUpperCase();
      
      // Create punishment data map
      const dataMap = new Map<string, any>();
      
      // Initialize required fields with defaults (matching the existing API route)
      dataMap.set('duration', punishmentData.duration);
      dataMap.set('blockedName', null);
      dataMap.set('blockedSkin', null);
      dataMap.set('linkedBanId', null);
      dataMap.set('linkedBanExpiry', null);
      dataMap.set('chatLog', null);
      dataMap.set('altBlocking', false);
      dataMap.set('wipeAfterExpiry', false);
      dataMap.set('severity', severity);
      dataMap.set('automated', true);
      dataMap.set('aiGenerated', true);
      dataMap.set('reason', reason);

      // Set expiry if duration is set
      if (punishmentData.duration > 0) {
        dataMap.set('expires', new Date(Date.now() + punishmentData.duration));
      }

      // Create punishment object (matching the existing API route structure)
      const newPunishment = {
        id: punishmentId,
        issuerName,
        issued: new Date(),
        started: (punishmentTypeId === 1 || punishmentTypeId === 2) ? new Date() : undefined, // Start immediately for bans/mutes
        type_ordinal: punishmentTypeId,
        modifications: [],
        notes: [],
        evidence: [],
        attachedTicketIds: [ticketId],
        data: dataMap
      };

      // Add punishment to player
      player.punishments.push(newPunishment);
      await player.save();

      // Create system log
      await this.createSystemLog(
        `${issuerName} applied punishment ID ${punishmentId} (${punishmentData.typeName}, Severity: ${severity}) to player ${playerIdentifier} (${player.minecraftUuid}) for ticket ${ticketId}. Reason: ${reason}`,
        'moderation',
        issuerName === 'AI Moderation System' ? 'ai-moderation' : 'player-api'
      );

      console.log(`[Punishment Service] Successfully applied punishment ${punishmentId} to ${playerIdentifier}`);
      
      return { success: true, punishmentId };
    } catch (error) {
      console.error(`[Punishment Service] Error applying punishment to ${playerIdentifier}:`, error);
      return { success: false, error: `Failed to apply punishment: ${(error as Error).message}` };
    }
  }

  /**
   * Find a player by UUID or username
   */
  private async findPlayer(playerIdentifier: string): Promise<any | null> {
    const Player = this.dbConnection.model('Player');
    
    // Check if the identifier looks like a UUID (36 chars with hyphens or 32 chars without)
    const isUuid = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(playerIdentifier);
    
    if (isUuid) {
      // Search by UUID (most efficient)
      return await Player.findOne({ minecraftUuid: playerIdentifier });
    } else {
      // Fallback to username search (case-insensitive search in usernames array)
      return await Player.findOne({
        'usernames.username': { $regex: new RegExp(`^${playerIdentifier}$`, 'i') }
      });
    }
  }

  /**
   * Calculate punishment data including duration and type information
   */
  private async calculatePunishmentData(
    player: any,
    punishmentTypeId: number,
    severity: 'low' | 'regular' | 'severe',
    reason: string,
    ticketId: string
  ): Promise<{ duration: number; typeName: string } | null> {
    try {
      const Settings = this.dbConnection.model('Settings');
      const settings = await Settings.findOne({});
      
      if (!settings?.settings?.punishmentTypes) {
        return null;
      }

      const punishmentTypes = typeof settings.settings.punishmentTypes === 'string' 
        ? JSON.parse(settings.settings.punishmentTypes) 
        : settings.settings.punishmentTypes;
      
      const punishmentType = punishmentTypes.find((pt: any) => 
        pt.id === punishmentTypeId || pt.ordinal === punishmentTypeId
      );
      
      if (!punishmentType) {
        return null;
      }

      // Calculate player status to determine appropriate offense level
      let offenseLevel = 'first'; // Default to first offense
      
      try {
        // Get status thresholds from settings
        const statusThresholds = settings?.settings?.statusThresholds || {
          gameplay: { medium: 5, habitual: 10 },
          social: { medium: 4, habitual: 8 }
        };
        
        // Calculate player status based on existing punishments
        const playerStatus = calculatePlayerStatus(
          player.punishments || [],
          punishmentTypes,
          statusThresholds
        );
        
        // Determine offense level based on punishment category and player status
        const punishmentCategory = punishmentType.category?.toLowerCase();
        let relevantStatus = 'Low';
        
        if (punishmentCategory === 'social') {
          relevantStatus = playerStatus.social;
        } else if (punishmentCategory === 'gameplay') {
          relevantStatus = playerStatus.gameplay;
        } else {
          // For administrative or unknown categories, use the higher of the two statuses
          const statusPriority = { 'Low': 1, 'Medium': 2, 'Habitual': 3 };
          relevantStatus = statusPriority[playerStatus.social] >= statusPriority[playerStatus.gameplay] 
            ? playerStatus.social 
            : playerStatus.gameplay;
        }
        
        // Map status to offense level
        const statusToDurationKey = {
          'Low': 'first',
          'Medium': 'medium', 
          'Habitual': 'habitual'
        };
        offenseLevel = statusToDurationKey[relevantStatus as keyof typeof statusToDurationKey] || 'first';
      } catch (error) {
        console.error('[Punishment Service] Error calculating player status, using first offense level:', error);
        offenseLevel = 'first';
      }

      // Get duration based on punishment type configuration
      let duration = -1; // Default to permanent

      if (punishmentType.singleSeverityPunishment && punishmentType.singleSeverityDurations) {
        // Single-severity punishment - use duration from offense level
        const durationConfig = punishmentType.singleSeverityDurations[offenseLevel as 'first' | 'medium' | 'habitual'];
        if (durationConfig) {
          duration = this.convertDurationToMilliseconds(durationConfig);
        }
      } else if (punishmentType.durations?.[severity]) {
        // Multi-severity punishment - use duration from punishment type config based on severity and offense level
        const severityDuration = punishmentType.durations[severity];
        const durationConfig = severityDuration[offenseLevel as 'first' | 'medium' | 'habitual'];
        if (durationConfig) {
          duration = this.convertDurationToMilliseconds(durationConfig);
        } else {
          // Try with 'first' as fallback
          const fallbackDuration = severityDuration.first;
          if (fallbackDuration) {
            duration = this.convertDurationToMilliseconds(fallbackDuration);
          }
        }
      }

      return {
        duration,
        typeName: punishmentType.name
      };
    } catch (error) {
      console.error('[Punishment Service] Error calculating punishment data:', error);
      return null;
    }
  }

  /**
   * Convert duration configuration to milliseconds
   */
  private convertDurationToMilliseconds(durationConfig: { value: number; unit: string }): number {
    const multiplierMap: Record<string, number> = {
      'seconds': 1000,
      'minutes': 60 * 1000,
      'hours': 60 * 60 * 1000,
      'days': 24 * 60 * 60 * 1000,
      'weeks': 7 * 24 * 60 * 60 * 1000,
      'months': 30 * 24 * 60 * 60 * 1000
    };
    const multiplier = multiplierMap[durationConfig.unit] || 1;
    return durationConfig.value * multiplier;
  }

  /**
   * Create a system log entry
   */
  private async createSystemLog(
    description: string,
    level: 'info' | 'warning' | 'error' | 'moderation' = 'info',
    source: string = 'system'
  ): Promise<void> {
    try {
      const Log = this.dbConnection.model('Log');
      
      const logEntry = new Log({
        created: new Date(),
        description,
        level,
        source
      });
      
      await logEntry.save();
    } catch (error) {
      console.error('[Punishment Service] Error creating system log:', error);
      // Don't throw here as logging failure shouldn't break the main flow
    }
  }
}

export default PunishmentService;
