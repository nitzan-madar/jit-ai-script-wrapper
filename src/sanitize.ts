export function sanitizeDockerfile(text: string): string {
  // Remove markdown code blocks and clean up
  const cleaned = text
    .replace(/```(?:dockerfile)?/gi, "")
    .replace(/```/g, "")
    .trim();
  
  if (/(curl|wget)\s+http/i.test(cleaned)) throw new Error("Unsafe Dockerfile.");
  const fromLine = cleaned.split("\n").find(l => l.toUpperCase().startsWith("FROM "));
  if (!fromLine) throw new Error("Missing FROM line.");
  return cleaned;
}

export function parseExample(example: string, filename: string): { containerArgs: string[] } {
  const parts = smartSplit(example.trim());
  const idx = parts.findIndex(p => p.includes(filename));
  const args = idx >= 0 ? parts.slice(idx + 1) : [];
  return { containerArgs: args };
}

function smartSplit(cmd: string): string[] {
  const out: string[] = []; let cur = ""; let q: "'"|'"'|null = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) { if (c === q) { q = null; continue; } cur += c; continue; }
    if (c === "'" || c === '"') { q = c as any; continue; }
    if (/\s/.test(c)) { if (cur) { out.push(cur); cur=""; } continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}
