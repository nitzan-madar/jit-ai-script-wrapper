import { BaseLLMProvider, GenerateDockerfileInput, LLMConfig } from "../llm-base.js";

export class AnthropicProvider extends BaseLLMProvider {
  name = "Anthropic Claude";

  constructor(config: LLMConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }
  }

  async generateDockerfile(input: GenerateDockerfileInput): Promise<string> {
    // TODO: Implement Anthropic API calls
    // This would use the Anthropic SDK with the generic config
    
    const systemPrompt = this.createSystemPrompt();
    const userPrompt = this.createUserPrompt(input);

    // Example structure:
    // const response = await fetch('https://api.anthropic.com/v1/messages', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'x-api-key': this.config.apiKey,
    //     'anthropic-version': '2023-01-01'
    //   },
    //   body: JSON.stringify({
    //     model: this.config.model,
    //     max_tokens: this.config.maxTokens || 500,
    //     temperature: this.config.temperature || 0,
    //     system: systemPrompt,
    //     messages: [{ role: 'user', content: userPrompt }]
    //   })
    // });

    throw new Error('Anthropic provider not implemented yet. Set LLM_PROVIDER=openai');
  }
}
