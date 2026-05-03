export function buildGenericPrompt(prompt: string, systemInstruction?: string) {
  if (!systemInstruction) {
    return prompt;
  }

  return [systemInstruction, '', prompt].join('\n');
}
