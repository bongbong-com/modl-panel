import { Connection } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import GeminiService from './gemini-service';
import SystemPromptsService from './system-prompts-service';
import PunishmentService from './punishment-service';

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
  points?: {
    low: number;
    regular: number;
    severe: number;
  };
  customPoints?: number;
  singleSeverityPoints?: number;
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
  private punishmentService: PunishmentService;

  constructor(dbConnection: Connection) {
    this.dbConnection = dbConnection;
    this.geminiService = new GeminiService();
    this.systemPromptsService = new SystemPromptsService(dbConnection);
    this.punishmentService = new PunishmentService(dbConnection);
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
          const punishmentResult = await this.punishmentService.applyPunishment(
            playerIdentifier,
            geminiResponse.suggestedAction.punishmentTypeId,
            geminiResponse.suggestedAction.severity,
            `Automated AI moderation - ${geminiResponse.analysis}`,
            ticketId
          );

          if (punishmentResult.success) {
            analysisResult.wasAppliedAutomatically = true;
            console.log(`[AI Moderation] Automatically applied punishment ${punishmentResult.punishmentId} for ticket ${ticketId}`);
          } else {
            console.error(`[AI Moderation] Failed to apply automatic punishment for ticket ${ticketId}: ${punishmentResult.error}`);
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