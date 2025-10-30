import { LLMConfig } from './llm-base.js';

/**
 * Configuration manager for LLM providers
 * Uses generic environment variable names for maximum flexibility
 */
export class Config {
  /**
   * Get LLM configuration from environment variables
   * Uses generic names that work across providers
   */
  static getLLMConfig(): LLMConfig {
    // Generic environment variables
    const provider = (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'local';
    const apiKey = process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL || Config.getDefaultModel(provider);
    const temperature = process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : 0.1;
    const baseUrl = process.env.LLM_BASE_URL;
    const maxTokens = process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS) : 2000;

    // Fallback to provider-specific environment variables for backward compatibility
    const fallbackApiKey = Config.getFallbackApiKey(provider);

    return {
      provider,
      apiKey: apiKey || fallbackApiKey,
      model,
      temperature,
      baseUrl,
      maxTokens
    };
  }

  /**
   * Get provider-specific fallback API key for backward compatibility
   */
  private static getFallbackApiKey(provider: string): string | undefined {
    switch (provider) {
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY;
      default:
        return undefined;
    }
  }

  /**
   * Get default model for each provider
   */
  private static getDefaultModel(provider: string): string {
    switch (provider) {
      case 'openai':
        return 'gpt-4o-mini';
      case 'anthropic':
        return 'claude-3-haiku-20240307';
      case 'local':
        return 'llama3.1';
      default:
        return 'gpt-4o-mini';
    }
  }

  /**
   * Validate that required configuration is present
   */
  static validateConfig(config: LLMConfig): void {
    if (!config.apiKey && config.provider !== 'local') {
      throw new Error(
        `API key not found. Set LLM_API_KEY or ${config.provider.toUpperCase()}_API_KEY environment variable`
      );
    }

    if (!config.model) {
      throw new Error('Model not specified. Set LLM_MODEL environment variable');
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      throw new Error('Temperature must be between 0 and 2');
    }
  }

  /**
   * Get configuration with validation
   */
  static getValidatedConfig(): LLMConfig {
    const config = Config.getLLMConfig();
    Config.validateConfig(config);
    return config;
  }
}
