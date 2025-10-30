import OpenAI from "openai";
import { BaseLLMProvider, GenerateDockerfileInput, LLMConfig } from "../llm-base.js";

export class OpenAIProvider extends BaseLLMProvider {
  name = "OpenAI";
  private client: OpenAI;

  constructor(config: LLMConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.client = new OpenAI({ 
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
  }

  async generateDockerfile(input: GenerateDockerfileInput): Promise<string> {
    const systemPrompt = this.createSystemPrompt();
    const userPrompt = this.createUserPrompt(input);

    const resp = await this.client.chat.completions.create({
      model: this.config.model, 
      temperature: this.config.temperature || 0, 
      max_tokens: this.config.maxTokens || 500,
      messages: [
        { role: "system", content: systemPrompt }, 
        { role: "user", content: userPrompt }
      ]
    });

    const text = (resp.choices?.[0]?.message?.content ?? "").trim();
    
    // Check if it's a valid Dockerfile (might be wrapped in markdown)
    const cleaned = text.replace(/```(?:dockerfile)?/gi, "").replace(/```/g, "").trim();
    if (!cleaned.toUpperCase().startsWith("FROM ")) {
      throw new Error(`Model did not return a Dockerfile. Response: ${text}`);
    }
    return text;
  }
}
