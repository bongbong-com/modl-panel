import { Connection } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import GeminiService from './gemini-service';
import SystemPromptsService from './system-prompts-service';

interface ChatMessage {
  username: string;
  message: string;
  timestamp: string;
}

interface PunishmentType {
  id: number;
  ordinal: number;
  name: string;
  category: string;
  aiDescription: string;
  enabled: boolean;
}

interface AIAnalysisResult {
  analysis: string;
  suggestedAction: {
    punishmentTypeId: number;
    severity: 'low' | 'regular' | 'severe';
  } | null;
  wasAppliedAutomatically: boolean;
  createdAt: Date;
}

interface AISettings {
  enableAutomatedActions: boolean;
  strictnessLevel: 'lenient' | 'standard' | 'strict';
}

export class AIModerationService {
  private dbConnection: Connection;
  private geminiService: GeminiService;
  private systemPromptsService: SystemPromptsService;

  constructor(dbConnection: Connection) {
    this.dbConnection = dbConnection;
    this.geminiService = new GeminiService();
    this.systemPromptsService = new SystemPromptsService(dbConnection);
  }

  /**
   * Analyze a chat report ticket using AI
   */
  async analyzeTicket(
    ticketId: string,
    chatMessages: ChatMessage[],
    playerIdentifier?: string,
    playerNameForAI?: string
  ): Promise<AIAnalysisResult | null> {
    try {
      // Starting AI analysis for ticket

      // Get AI settings
      const aiSettings = await this.getAISettings();
      if (!aiSettings) {
        // AI settings not found, skipping analysis
        return null;
      }

      // Get punishment types
      const punishmentTypes = await this.getPunishmentTypes();
      if (!punishmentTypes || punishmentTypes.length === 0) {
        // No punishment types found, skipping analysis
        return null;
      }

      // Get system prompt for strictness level with punishment types injected
      const systemPrompt = await this.systemPromptsService.getPromptForStrictnessLevel(
        aiSettings.strictnessLevel,
        punishmentTypes
      );

      // Analyze with Gemini
      const geminiResponse = await this.geminiService.analyzeChatMessages(
        chatMessages,
        systemPrompt,
        playerNameForAI
      );

      // Prepare AI analysis result
      const analysisResult: AIAnalysisResult = {
        analysis: geminiResponse.analysis,
        suggestedAction: geminiResponse.suggestedAction,
        wasAppliedAutomatically: false,
        createdAt: new Date()
      };

      // Apply punishment automatically if enabled and action is suggested
      if (aiSettings.enableAutomatedActions && geminiResponse.suggestedAction && playerIdentifier) {
        try {
          const punishmentApplied = await this.applyPunishment(
            playerIdentifier,
            geminiResponse.suggestedAction.punishmentTypeId,
            geminiResponse.suggestedAction.severity,
            `Automated AI moderation - ${geminiResponse.analysis}`,
            ticketId
          );

          if (punishmentApplied) {
            analysisResult.wasAppliedAutomatically = true;
            console.log(`[AI Moderation] Automatically applied punishment for ticket ${ticketId}`);
          }
        } catch (error) {
          console.error(`[AI Moderation] Failed to apply automatic punishment for ticket ${ticketId}:`, error);
          // Continue without failing the analysis
        }
      }

      // Store AI analysis in ticket data
      await this.storeAIAnalysis(ticketId, analysisResult);

      return analysisResult;
    } catch (error) {
      console.error(`[AI Moderation] Error analyzing ticket ${ticketId}:`, error);
      return null;
    }
  }

  /**
   * Apply a punishment to a player directly via database
   * @param playerIdentifier Player's UUID (preferred) or username
   * @param punishmentTypeId The ID of the punishment type to apply
   * @param severity The severity level of the punishment
   * @param reason The reason for the punishment
   * @param ticketId The ticket ID this punishment is associated with
   */
  private async applyPunishment(
    playerIdentifier: string,
    punishmentTypeId: number,
    severity: 'low' | 'regular' | 'severe',
    reason: string,
    ticketId: string
  ): Promise<boolean> {
    try {
      const Player = this.dbConnection.model('Player');
      const Settings = this.dbConnection.model('Settings');
      
      // Try to find player by UUID first (more efficient), fallback to username
      let player;
      
      // Check if the identifier looks like a UUID (36 chars with hyphens or 32 chars without)
      const isUuid = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(playerIdentifier);
      
      if (isUuid) {
        // Search by UUID (most efficient)
        player = await Player.findOne({ minecraftUuid: playerIdentifier });
      } else {
        // Fallback to username search (case-insensitive search in usernames array)
        player = await Player.findOne({
          'usernames.username': { $regex: new RegExp(`^${playerIdentifier}$`, 'i') }
        });
      }
      
      if (!player) {
        console.error(`[AI Moderation] Player ${playerIdentifier} not found`);
        return false;
      }
      
      // Get punishment type details from settings to determine duration
      const settings = await Settings.findOne({});
      let punishmentTypes = [];
      let duration = -1; // Default to permanent
      let punishmentTypeName = 'Unknown';
      
      if (settings?.settings?.punishmentTypes) {
        punishmentTypes = typeof settings.settings.punishmentTypes === 'string' 
          ? JSON.parse(settings.settings.punishmentTypes) 
          : settings.settings.punishmentTypes;
        
        const punishmentType = punishmentTypes.find((pt: any) => 
          pt.id === punishmentTypeId || pt.ordinal === punishmentTypeId
        );
        
        if (punishmentType) {
          punishmentTypeName = punishmentType.name;
          
          // Get duration based on severity if available
          if (punishmentType.durations?.[severity]) {
            const severityDuration = punishmentType.durations[severity];
            // For AI moderation, we'll use the 'first' offense duration
            const durationConfig = severityDuration.first;
            if (durationConfig) {
              const multiplierMap: Record<string, number> = {
                'seconds': 1000,
                'minutes': 60 * 1000,
                'hours': 60 * 60 * 1000,
                'days': 24 * 60 * 60 * 1000,
                'weeks': 7 * 24 * 60 * 60 * 1000,
                'months': 30 * 24 * 60 * 60 * 1000
              };
              const multiplier = multiplierMap[durationConfig.unit] || 1;
              duration = durationConfig.value * multiplier;
            }
          }
        }
      }
      
      // Generate punishment ID
      const id = uuidv4().substring(0, 8).toUpperCase();
      
      // Create punishment data map
      const punishmentData = new Map<string, any>();
      punishmentData.set('reason', reason);
      punishmentData.set('automated', true);
      punishmentData.set('severity', severity);
      punishmentData.set('aiGenerated', true);
      
      if (duration > 0) {
        punishmentData.set('duration', duration);
        punishmentData.set('expires', new Date(Date.now() + duration));
      } else {
        punishmentData.set('duration', -1); // Permanent
      }
      
      // Create punishment object matching the structure in player routes
      const newPunishment = {
        id,
        issuerName: 'AI Moderation System',
        issued: new Date(),
        started: (punishmentTypeId === 1 || punishmentTypeId === 2) ? new Date() : undefined, // Start immediately for bans/mutes
        type_ordinal: punishmentTypeId,
        modifications: [],
        notes: [],
        attachedTicketIds: [ticketId],
        data: punishmentData
      };
      
      // Add punishment to player
      player.punishments.push(newPunishment);
      await player.save();
      
             // Create system log
       await this.createSystemLog(
         `AI automatically applied punishment ID ${id} (${punishmentTypeName}, Severity: ${severity}) to player ${playerIdentifier} (${player.minecraftUuid}) for ticket ${ticketId}. Reason: ${reason}`,
         'moderation',
         'ai-moderation'
       );
       
       console.log(`[AI Moderation] Successfully applied punishment ${id} to ${playerIdentifier}`);
       return true;
     } catch (error) {
       console.error(`[AI Moderation] Error applying punishment to ${playerIdentifier}:`, error);
       return false;
     }
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
      console.error('[AI Moderation] Error creating system log:', error);
      // Don't throw here as logging failure shouldn't break the main flow
    }
  }

  /**
   * Store AI analysis result in ticket data
   */
  private async storeAIAnalysis(ticketId: string, analysisResult: AIAnalysisResult): Promise<void> {
    try {
      const TicketModel = this.dbConnection.model('Ticket');
      
      await TicketModel.updateOne(
        { _id: ticketId },
        {
          $set: {
            'data.aiAnalysis': analysisResult
          }
        }
      );

      console.log(`[AI Moderation] Stored analysis result for ticket ${ticketId}`);
    } catch (error) {
      console.error(`[AI Moderation] Error storing analysis for ticket ${ticketId}:`, error);
    }
  }

  /**
   * Get AI moderation settings
   */
  private async getAISettings(): Promise<AISettings | null> {
    try {
      const SettingsModel = this.dbConnection.model('Settings');
      const settingsDoc = await SettingsModel.findOne({});

      if (!settingsDoc) {
        return null;
      }

      const aiSettings = settingsDoc.settings.get('aiModerationSettings');
      return aiSettings || {
        enableAutomatedActions: true,
        strictnessLevel: 'standard'
      };
    } catch (error) {
      console.error('[AI Moderation] Error fetching AI settings:', error);
      return null;
    }
  }

  /**
   * Get punishment types from AI moderation settings (enabled types only)
   */
  private async getPunishmentTypes(): Promise<PunishmentType[]> {
    try {
      const SettingsModel = this.dbConnection.model('Settings');
      const settingsDoc = await SettingsModel.findOne({});

      if (!settingsDoc || !settingsDoc.settings) {
        console.error('[AI Moderation] Settings document not found.');
        return [];
      }

      const aiModerationSettings = settingsDoc.settings.get('aiModerationSettings');
      const allPunishmentTypes = settingsDoc.settings.get('punishmentTypes') || [];
      
      if (!aiModerationSettings || !aiModerationSettings.aiPunishmentConfigs) {
        console.error('[AI Moderation] AI moderation settings or punishment configs not found.');
        return [];
      }

      const aiPunishmentConfigs = aiModerationSettings.aiPunishmentConfigs;

      // Combine punishment types with AI configurations for enabled types only
      const enabledAIPunishmentTypes = allPunishmentTypes
        .filter((pt: any) => 
          aiPunishmentConfigs[pt.id] && 
          aiPunishmentConfigs[pt.id].enabled === true
        )
        .map((pt: any) => ({
          id: pt.id,
          ordinal: pt.ordinal,
          name: pt.name,
          category: pt.category,
          aiDescription: aiPunishmentConfigs[pt.id].aiDescription || `${pt.name} punishment in ${pt.category} category`,
          enabled: true
        }));

      console.log(`[AI Moderation] Found ${enabledAIPunishmentTypes.length} enabled AI punishment types.`);

      return enabledAIPunishmentTypes;
    } catch (error) {
      console.error('[AI Moderation] Error fetching AI punishment types from settings:', error);
      return [];
    }
  }

  /**
   * Initialize the AI moderation system
   */
  async initialize(): Promise<void> {
    try {
      // Initialize default system prompts
      await this.systemPromptsService.initializeDefaultPrompts();
      
      // Test Gemini connection
      const connectionTest = await this.geminiService.testConnection();
      if (connectionTest) {
        console.log('[AI Moderation] Successfully connected to Gemini API');
      } else {
        console.warn('[AI Moderation] Failed to connect to Gemini API - check API key');
      }
      
      console.log('[AI Moderation] Service initialized');
    } catch (error) {
      console.error('[AI Moderation] Error during initialization:', error);
    }
  }

  /**
   * Process a ticket for AI analysis (called after ticket creation)
   */
  async processNewTicket(ticketId: string, ticketData: any): Promise<void> {
    try {
      // Only process Chat Report tickets with chat messages
      if (ticketData.category !== 'chat' && ticketData.type !== 'chat') {
        return;
      }

      // Extract chat messages from ticket data
      let chatMessagesRaw = ticketData.chatMessages;
      if (!chatMessagesRaw) {
        // Fallback for when it might be in the 'data' map
        chatMessagesRaw = ticketData.data?.get ? ticketData.data.get('chatMessages') : ticketData.data?.chatMessages;
      }

      if (!chatMessagesRaw || !Array.isArray(chatMessagesRaw) || chatMessagesRaw.length === 0) {
        console.log(`[AI Moderation] No chat messages found for ticket ${ticketId}, skipping analysis`);
        return;
      }

      // Parse chat messages if they are strings
      const chatMessages: ChatMessage[] = chatMessagesRaw.map((msg: any) => {
        if (typeof msg === 'string') {
          try {
            return JSON.parse(msg);
          } catch (e) {
            console.error(`[AI Moderation] Failed to parse chat message string: ${msg}`, e);
            return null;
          }
        }
        return msg;
      }).filter((msg): msg is ChatMessage => msg !== null);

      if (chatMessages.length === 0) {
        console.log(`[AI Moderation] No valid chat messages found after parsing for ticket ${ticketId}, skipping analysis`);
        return;
      }

      // Get reported player's name and identifier (UUID preferred) from ticket
      const reportedPlayerName = ticketData.reportedPlayer || ticketData.relatedPlayer;
      const reportedPlayerIdentifier = ticketData.reportedPlayerUuid || ticketData.relatedPlayerUuid || reportedPlayerName;

      if (!reportedPlayerIdentifier) {
        console.log(`[AI Moderation] No reported player identifier found for ticket ${ticketId}, skipping punishment application.`);
      }

      // Run analysis asynchronously
      setImmediate(() => {
        this.analyzeTicket(ticketId, chatMessages, reportedPlayerIdentifier, reportedPlayerName)
          .catch(error => {
            console.error(`[AI Moderation] Async analysis failed for ticket ${ticketId}:`, error);
          });
      });

      console.log(`[AI Moderation] Queued analysis for ticket ${ticketId}`);
    } catch (error) {
      console.error(`[AI Moderation] Error processing new ticket ${ticketId}:`, error);
    }
  }
}

export default AIModerationService; 