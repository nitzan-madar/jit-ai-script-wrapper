// Input sanitization and prompt injection protection

export interface SanitizationResult {
  sanitized: string;
  warnings: string[];
  safe: boolean;
}

export class InputSanitizer {
  // Common prompt injection patterns
  private static readonly INJECTION_PATTERNS = [
    // Direct instruction attempts
    /ignore\s+(?:previous|above|all)\s+(?:instructions?|prompts?|rules?|commands?)/i,
    /forget\s+(?:everything|all|instructions?|previous)/i,
    /(?:start|begin)\s+(?:new|fresh|different)\s+(?:conversation|session|context)/i,
    
    // Role manipulation
    /(?:you\s+are\s+now|now\s+you\s+are|act\s+as|pretend\s+to\s+be|role\s*[:=]\s*)/i,
    /(?:system|assistant|user)\s*[:=]\s*["\']?/i,
    
    // Instruction overrides
    /(?:instead|rather|but\s+actually|however),?\s+(?:do|say|write|output|generate|create)/i,
    /(?:don['']t|do\s+not|never)\s+(?:follow|obey|use|apply)\s+(?:the|those|previous)/i,
    
    // Context manipulation
    /(?:the\s+)?(?:real|actual|true)\s+(?:task|instruction|prompt|goal)\s+is/i,
    /(?:this\s+is\s+)?(?:a\s+)?(?:test|simulation|example)\s+(?:of|for)/i,
    
    // Code injection attempts
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript\s*:/i,
    /(?:eval|exec|system|shell_exec|passthru)\s*\(/i,
    
    // Template/variable injection
    /\{\{\s*[^}]+\s*\}\}/g,
    /\$\{[^}]+\}/g,
    /%\{[^}]+\}/g,
  ];

  // Suspicious keywords that might indicate injection
  private static readonly SUSPICIOUS_KEYWORDS = [
    'jailbreak', 'bypass', 'override', 'ignore', 'forget', 'disregard',
    'admin', 'root', 'sudo', 'administrator', 'privilege', 'elevated',
    'backdoor', 'exploit', 'vulnerability', 'payload', 'injection',
    'malicious', 'harmful', 'dangerous', 'execute', 'run_command'
  ];

  static sanitizeScript(scriptContent: string): SanitizationResult {
    const warnings: string[] = [];
    let sanitized = scriptContent;
    let safe = true;

    // Check for dangerous commands
    const dangerousCommands = [
      /rm\s+-rf\s+\//, // rm -rf /
      /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // fork bomb
      /curl\s+.*\|\s*(?:bash|sh|python)/, // curl pipe to shell
      /wget\s+.*\|\s*(?:bash|sh|python)/, // wget pipe to shell
      /(?:sudo|su)\s+/, // privilege escalation
      /(?:chmod|chown)\s+/, // permission changes
      /(?:iptables|ufw|firewall)/, // firewall manipulation
      /(?:crontab|systemctl|service)/, // system service manipulation
    ];

    for (const pattern of dangerousCommands) {
      if (pattern.test(sanitized)) {
        warnings.push(`Potentially dangerous command detected: ${pattern.source}`);
        safe = false;
      }
    }

    return { sanitized, warnings, safe };
  }

  static sanitizeReadme(readmeContent: string): SanitizationResult {
    const warnings: string[] = [];
    let sanitized = readmeContent;
    let safe = true;

    // Check for prompt injection patterns
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        warnings.push(`Potential prompt injection pattern detected: ${pattern.source}`);
        // Don't mark as unsafe for README, just warn
      }
    }

    // Check for suspicious keywords
    const lowerContent = sanitized.toLowerCase();
    for (const keyword of this.SUSPICIOUS_KEYWORDS) {
      if (lowerContent.includes(keyword)) {
        warnings.push(`Suspicious keyword detected: ${keyword}`);
      }
    }

    // Limit length to prevent DoS
    const MAX_README_LENGTH = 10000;
    if (sanitized.length > MAX_README_LENGTH) {
      sanitized = sanitized.substring(0, MAX_README_LENGTH);
      warnings.push(`README truncated to ${MAX_README_LENGTH} characters`);
    }

    return { sanitized, warnings, safe };
  }

  static sanitizeFilePath(filePath: string): SanitizationResult {
    const warnings: string[] = [];
    let sanitized = filePath;
    let safe = true;

    // Check for path traversal
    if (sanitized.includes('..')) {
      warnings.push('Path traversal detected (..)');
      safe = false;
    }

    // Check for absolute paths outside allowed directories
    if (sanitized.startsWith('/') && !sanitized.startsWith('/tmp/')) {
      warnings.push('Absolute path outside allowed directories');
      safe = false;
    }

    // Check for null bytes
    if (sanitized.includes('\0')) {
      warnings.push('Null byte detected in path');
      safe = false;
    }

    return { sanitized, warnings, safe };
  }

  static sanitizeAllInputs(scriptPath: string, scriptContent: string, readmeContent: string): {
    scriptPath: SanitizationResult;
    script: SanitizationResult;
    readme: SanitizationResult;
    overallSafe: boolean;
  } {
    const scriptPathResult = this.sanitizeFilePath(scriptPath);
    const scriptResult = this.sanitizeScript(scriptContent);
    const readmeResult = this.sanitizeReadme(readmeContent);

    const overallSafe = scriptPathResult.safe && scriptResult.safe && readmeResult.safe;

    return {
      scriptPath: scriptPathResult,
      script: scriptResult,
      readme: readmeResult,
      overallSafe
    };
  }
}
