// LLM vendor-agnostic interface
export interface LLMProvider {
  name: string;
  generateDockerfile(input: GenerateDockerfileInput): Promise<string>;
}

export interface GenerateDockerfileInput {
  filename: string;
  script: string;
  readme: string;
  exampleInsideContainer: string;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model: string;
  temperature?: number;
  baseUrl?: string;
  maxTokens?: number;
}

export abstract class BaseLLMProvider implements LLMProvider {
  abstract name: string;
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract generateDockerfile(input: GenerateDockerfileInput): Promise<string>;

  protected createSystemPrompt(): string {
    return `You are a senior build engineer. Output ONLY a valid Dockerfile. No prose.`;
  }

  protected createUserPrompt(input: GenerateDockerfileInput): string {
    return [
      `Create a minimal Dockerfile that runs the provided script exactly like the example.`,
      `Script filename: ${input.filename}`,
      `Script contents:\n<<<BEGIN_SCRIPT\n${input.script}\n<<<END_SCRIPT`,
      `Script documentation:\n<<<BEGIN_README\n${input.readme}\n<<<END_README`,
      `How it should be run INSIDE the container: ${input.exampleInsideContainer}`,
      `Rules:`,
      `- For bash scripts, use "bash:latest" base image.`,
      `- COPY the script to /${input.filename} in the container root.`,
      `- RUN chmod +x /${input.filename} to make it executable.`,
      `- Use ENTRYPOINT ["bash", "/${input.filename}"] for bash scripts to ensure proper execution.`,
      `- Use CMD with default arguments from the example.`,
      `- Do NOT modify the script or download external files.`,
      `- Use the README documentation to understand the script's purpose and requirements.`,
      `- Ensure the script runs exactly as shown in the documentation.`,
      `- Output ONLY the Dockerfile text.`
    ].join("\n");
  }
}
