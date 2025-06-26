import { Connection } from 'mongoose';
import GeminiService from './gemini-service';
import SystemPromptsService from './system-prompts-service';

interface ChatMessage {
  username: string;
  message: string;
  timestamp: string;
}

interface PunishmentType {
  id: number;
  name: string;
  category: string;
  points: {
    low: number;
    regular: number;
    severe: number;
  };
  duration: {
    low: { value: number; unit: string };
    regular: { value: number; unit: string };
    severe: { value: number; unit: string };
  };
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
    reportedPlayer?: string
  ): Promise<AIAnalysisResult | null> {
    try {
      console.log(`[AI Moderation] Starting analysis for ticket ${ticketId}`);

      // Get AI settings
      const aiSettings = await this.getAISettings();
      if (!aiSettings) {
        console.log('[AI Moderation] AI settings not found, skipping analysis');
        return null;
      }

      // Get punishment types
      const punishmentTypes = await this.getPunishmentTypes();
      if (!punishmentTypes || punishmentTypes.length === 0) {
        console.log('[AI Moderation] No punishment types found, skipping analysis');
        return null;
      }

      // Get system prompt for strictness level
      const systemPrompt = await this.systemPromptsService.getPromptForStrictnessLevel(
        aiSettings.strictnessLevel
      );

      // Analyze with Gemini
      const geminiResponse = await this.geminiService.analyzeChatMessages(
        chatMessages,
        punishmentTypes,
        systemPrompt,
        reportedPlayer
      );

      console.log(`[AI Moderation] Analysis complete for ticket ${ticketId}:`, {
        hasAction: !!geminiResponse.suggestedAction,
        severity: geminiResponse.suggestedAction?.severity,
        confidence: geminiResponse.confidence
      });

      // Prepare AI analysis result
      const analysisResult: AIAnalysisResult = {
        analysis: geminiResponse.analysis,
        suggestedAction: geminiResponse.suggestedAction,
        wasAppliedAutomatically: false,
        createdAt: new Date()
      };

      // Apply punishment automatically if enabled and action is suggested
      if (aiSettings.enableAutomatedActions && geminiResponse.suggestedAction && reportedPlayer) {
        try {
          const punishmentApplied = await this.applyPunishment(
            reportedPlayer,
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
   * Apply a punishment to a player
   */
  private async applyPunishment(
    playerName: string,
    punishmentTypeId: number,
    severity: 'low' | 'regular' | 'severe',
    reason: string,
    ticketId: string
  ): Promise<boolean> {
    try {
      // This would integrate with your existing punishment system
      // For now, we'll make an API call to the punishment endpoint
      const response = await fetch(`${process.env.INTERNAL_API_URL || 'http://localhost:3000'}/api/panel/players/${playerName}/punish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any necessary auth headers for internal API calls
        },
        body: JSON.stringify({
          punishmentTypeId,
          severity,
          reason,
          ticketId,
          automated: true
        })
      });

      if (response.ok) {
        console.log(`[AI Moderation] Successfully applied punishment to ${playerName}`);
        return true;
      } else {
        console.error(`[AI Moderation] Failed to apply punishment to ${playerName}: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error(`[AI Moderation] Error applying punishment to ${playerName}:`, error);
      return false;
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
   * Get punishment types from database
   */
  private async getPunishmentTypes(): Promise<PunishmentType[]> {
    try {
      const PunishmentTypeModel = this.dbConnection.model('PunishmentType');
      const punishmentTypes = await PunishmentTypeModel.find({ isActive: true });
      
      return punishmentTypes.map(pt => ({
        id: pt.id || pt._id,
        name: pt.name,
        category: pt.category,
        points: pt.points,
        duration: pt.duration
      }));
    } catch (error) {
      console.error('[AI Moderation] Error fetching punishment types:', error);
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
      if (ticketData.category !== 'Player Report') {
        return;
      }

      // Extract chat messages from ticket data
      const chatMessages = ticketData.data?.get ? 
        ticketData.data.get('chatMessages') : 
        ticketData.data?.chatMessages;

      if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
        console.log(`[AI Moderation] No chat messages found for ticket ${ticketId}, skipping analysis`);
        return;
      }

      // Get reported player from ticket
      const reportedPlayer = ticketData.relatedPlayer || ticketData.reportedPlayer;

      // Run analysis asynchronously
      setImmediate(() => {
        this.analyzeTicket(ticketId, chatMessages, reportedPlayer)
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