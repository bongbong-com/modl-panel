import { GoogleGenerativeAI } from '@google/generative-ai';

interface ChatMessage {
  username: string;
  message: string;
  timestamp: string;
}

interface PunishmentType {
  id: number;
  name: string;
  category: string;
}

interface GeminiAnalysisResponse {
  analysis: string;
  suggestedAction: {
    punishmentTypeId: number;
    severity: 'low' | 'regular' | 'severe';
  } | null;
  confidence: number;
}

interface SystemPrompt {
  _id?: string;
  strictnessLevel: 'lenient' | 'standard' | 'strict';
  prompt: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Analyze chat messages for rule violations using Gemini AI
   */
  async analyzeChatMessages(
    chatMessages: ChatMessage[],
    punishmentTypes: PunishmentType[],
    systemPrompt: string,
    reportedPlayer?: string
  ): Promise<GeminiAnalysisResponse> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-lite-preview-06-17",
        generationConfig: {
          temperature: 0.1, // Lower temperature for more consistent responses
          topP: 0.8,
          maxOutputTokens: 1024,
        }
      });

      // Format chat messages into a readable transcript
      const chatTranscript = this.formatChatTranscript(chatMessages, reportedPlayer);
      
      // Format punishment types for the AI
      const punishmentTypesJson = JSON.stringify(punishmentTypes.map(pt => ({
        id: pt.id,
        name: pt.name,
        category: pt.category
      })), null, 2);

      // Construct the full prompt
      const fullPrompt = `${systemPrompt}

AVAILABLE PUNISHMENT TYPES:
${punishmentTypesJson}

CHAT TRANSCRIPT TO ANALYZE:
${chatTranscript}

${reportedPlayer ? `REPORTED PLAYER: ${reportedPlayer}` : ''}

Please analyze the chat transcript and respond with a JSON object following the exact format specified in the system prompt.`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      console.log('[Gemini Service] Raw response from Gemini:', text);

      // Parse the JSON response
      const analysisResponse = this.parseGeminiResponse(text);
      
      console.log('[Gemini Service] Parsed response:', analysisResponse);

      return analysisResponse;
    } catch (error) {
      console.error('[Gemini Service] Error analyzing chat messages:', error);
      throw new Error(`Failed to analyze chat messages: ${error.message}`);
    }
  }

  /**
   * Format chat messages into a readable transcript
   */
  private formatChatTranscript(chatMessages: ChatMessage[], reportedPlayer?: string): string {
    if (!chatMessages || chatMessages.length === 0) {
      return 'No chat messages provided.';
    }

    const transcript = chatMessages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(msg => {
        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        const playerIndicator = reportedPlayer && msg.username === reportedPlayer ? ' [REPORTED]' : '';
        return `[${timestamp}] ${msg.username}${playerIndicator}: ${msg.message}`;
      })
      .join('\n');

    return transcript;
  }

  /**
   * Parse the JSON response from Gemini
   */
  private parseGeminiResponse(responseText: string): GeminiAnalysisResponse {
    try {
      // Clean up the response text - remove markdown code blocks if present
      let cleanedResponse = responseText.trim();
      
      // Remove markdown code block indicators
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
      }

      // Try to find JSON within the response if it's not pure JSON
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const parsed = JSON.parse(cleanedResponse);

      // Validate the response structure
      if (typeof parsed.analysis !== 'string') {
        throw new Error('Missing or invalid analysis field');
      }

      if (parsed.suggestedAction !== null) {
        if (!parsed.suggestedAction.punishmentTypeId || !parsed.suggestedAction.severity) {
          throw new Error('Invalid suggestedAction structure');
        }
        
        if (!['low', 'regular', 'severe'].includes(parsed.suggestedAction.severity)) {
          throw new Error('Invalid severity level');
        }
      }

      return {
        analysis: parsed.analysis,
        suggestedAction: parsed.suggestedAction,
        confidence: parsed.confidence || 0.8 // Default confidence if not provided
      };
    } catch (error) {
      console.error('[Gemini Service] Failed to parse response:', responseText);
      throw new Error(`Failed to parse Gemini response: ${error.message}`);
    }
  }

  /**
   * Test the Gemini API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-06-17" });
      const result = await model.generateContent("Test connection. Respond with 'OK'.");
      const response = await result.response;
      const text = response.text();
      return text.toLowerCase().includes('ok');
    } catch (error) {
      console.error('[Gemini Service] Connection test failed:', error);
      return false;
    }
  }
}

export default GeminiService; 