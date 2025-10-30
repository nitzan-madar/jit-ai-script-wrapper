import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { LLMConfig, LLMProvider, GenerateDockerfileInput } from "./llm-base.js";
import { Config } from "./config.js";

export class LLMFactory {
  /**
   * Create an LLM provider with the given configuration
   */
  static create(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'local':
        throw new Error('Local provider not implemented yet');
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Create an LLM provider using environment configuration
   */
  static createFromEnv(): LLMProvider {
    const config = Config.getValidatedConfig();
    return LLMFactory.create(config);
  }
}

// Legacy compatibility function
export async function generateDockerfile(
  input: GenerateDockerfileInput, 
  model = "gpt-4o-mini"
): Promise<string> {
  const provider = LLMFactory.createFromEnv();
  return provider.generateDockerfile(input);
}

// Export types for external use
export type { LLMConfig, LLMProvider, GenerateDockerfileInput };
