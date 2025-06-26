import { Connection, Schema, Document } from 'mongoose';

interface ISystemPrompt extends Document {
  strictnessLevel: 'lenient' | 'standard' | 'strict';
  prompt: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SystemPromptSchema = new Schema<ISystemPrompt>({
  strictnessLevel: {
    type: String,
    enum: ['lenient', 'standard', 'strict'],
    required: true,
    unique: true
  },
  prompt: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export class SystemPromptsService {
  private dbConnection: Connection;

  constructor(dbConnection: Connection) {
    this.dbConnection = dbConnection;
  }

  /**
   * Get system prompt for a specific strictness level
   */
  async getPromptForStrictnessLevel(strictnessLevel: 'lenient' | 'standard' | 'strict'): Promise<string> {
    try {
      const SystemPromptModel = this.dbConnection.model<ISystemPrompt>('SystemPrompt', SystemPromptSchema);
      
      const prompt = await SystemPromptModel.findOne({
        strictnessLevel,
        isActive: true
      });

      if (!prompt) {
        console.warn(`[System Prompts] No prompt found for strictness level: ${strictnessLevel}, using default`);
        return this.getDefaultPrompt(strictnessLevel);
      }

      return prompt.prompt;
    } catch (error) {
      console.error('[System Prompts] Error fetching prompt:', error);
      return this.getDefaultPrompt(strictnessLevel);
    }
  }

  /**
   * Initialize default system prompts if they don't exist
   */
  async initializeDefaultPrompts(): Promise<void> {
    try {
      const SystemPromptModel = this.dbConnection.model<ISystemPrompt>('SystemPrompt', SystemPromptSchema);

      const defaultPrompts = [
        {
          strictnessLevel: 'lenient' as const,
          prompt: this.getDefaultPrompt('lenient'),
          isActive: true
        },
        {
          strictnessLevel: 'standard' as const,
          prompt: this.getDefaultPrompt('standard'),
          isActive: true
        },
        {
          strictnessLevel: 'strict' as const,
          prompt: this.getDefaultPrompt('strict'),
          isActive: true
        }
      ];

      for (const promptData of defaultPrompts) {
        const existing = await SystemPromptModel.findOne({
          strictnessLevel: promptData.strictnessLevel
        });

        if (!existing) {
          await SystemPromptModel.create(promptData);
          console.log(`[System Prompts] Created default prompt for ${promptData.strictnessLevel} level`);
        }
      }
    } catch (error) {
      console.error('[System Prompts] Error initializing default prompts:', error);
    }
  }

  /**
   * Get all system prompts
   */
  async getAllPrompts(): Promise<ISystemPrompt[]> {
    try {
      const SystemPromptModel = this.dbConnection.model<ISystemPrompt>('SystemPrompt', SystemPromptSchema);
      return await SystemPromptModel.find({}).sort({ strictnessLevel: 1 });
    } catch (error) {
      console.error('[System Prompts] Error fetching all prompts:', error);
      return [];
    }
  }

  /**
   * Update a system prompt
   */
  async updatePrompt(strictnessLevel: 'lenient' | 'standard' | 'strict', prompt: string): Promise<boolean> {
    try {
      const SystemPromptModel = this.dbConnection.model<ISystemPrompt>('SystemPrompt', SystemPromptSchema);
      
      const result = await SystemPromptModel.updateOne(
        { strictnessLevel },
        { 
          prompt, 
          updatedAt: new Date() 
        },
        { upsert: true }
      );

      return result.acknowledged;
    } catch (error) {
      console.error('[System Prompts] Error updating prompt:', error);
      return false;
    }
  }

  /**
   * Get default prompts for each strictness level
   */
  private getDefaultPrompt(strictnessLevel: 'lenient' | 'standard' | 'strict'): string {
    const baseJsonFormat = `
{
  "analysis": "Brief explanation of what rule violations (if any) were found in the chat",
  "suggestedAction": {
    "punishmentTypeId": <punishment_type_id_number>,
    "severity": "low|regular|severe"
  } OR null if no action needed,
  "confidence": <number between 0 and 1>
}`;

    const commonInstructions = `
You are an AI moderator analyzing Minecraft server chat logs for rule violations. Analyze the provided chat transcript and determine if any moderation action is needed.

IMPORTANT RULES TO ENFORCE:
- Harassment, bullying, or toxic behavior toward other players
- Excessive profanity or inappropriate language
- Spam or flooding chat
- Advertising other servers
- Cheating accusations or discussions
- Threats or doxxing
- Inappropriate content (sexual, violent, etc.)
- Discrimination based on race, gender, religion, etc.

RESPONSE FORMAT:
You must respond with a valid JSON object in this exact format:
${baseJsonFormat}

PUNISHMENT SEVERITY GUIDELINES:
- "low": Minor infractions, first-time offenses, borderline cases
- "regular": Clear rule violations, repeat minor offenses
- "severe": Serious violations, multiple rule breaks, toxic behavior

Choose the most appropriate punishment type from the provided list based on the violation category and severity.`;

    const strictnessPrompts = {
      lenient: `${commonInstructions}

LENIENT MODE - Additional Guidelines:
- Give players the benefit of the doubt when context is unclear
- Only suggest action for clear, obvious rule violations
- Prefer warnings and lighter punishments for first-time offenses
- Consider context and intent - friendly banter may not require action
- Be more forgiving of minor language issues
- Focus on patterns of behavior rather than isolated incidents

If there's any ambiguity about whether something violates rules, err on the side of no action.`,

      standard: `${commonInstructions}

STANDARD MODE - Additional Guidelines:
- Apply consistent moderation based on clear rule violations
- Consider the severity and impact of violations on the community
- Balance player behavior with server standards
- Escalate punishment severity for repeat offenses when evident
- Take context into account but enforce rules fairly
- Focus on maintaining a positive gaming environment

Apply appropriate action when rules are clearly violated, using good judgment for edge cases.`,

      strict: `${commonInstructions}

STRICT MODE - Additional Guidelines:
- Enforce rules rigorously with zero tolerance for violations
- Take action on borderline cases that could negatively impact the community
- Prefer higher severity punishments to maintain server standards
- Consider even minor infractions as worthy of moderation action
- Prioritize community safety and positive environment over individual leniency
- Be proactive in preventing escalation of problematic behavior

When in doubt, err on the side of taking moderation action to maintain high community standards.`
    };

    return strictnessPrompts[strictnessLevel];
  }
}

export default SystemPromptsService; 