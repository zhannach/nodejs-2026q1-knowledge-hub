import { AnalyzeTask } from '../dto/analyze-article.dto';
import { SummaryLength } from '../dto/summarize-article.dto';

interface ArticlePromptInput {
  title: string;
  content: string;
}

const lengthInstructions: Record<SummaryLength, string> = {
  [SummaryLength.SHORT]: 'Use 2-3 concise sentences.',
  [SummaryLength.MEDIUM]: 'Use one compact paragraph of 4-6 sentences.',
  [SummaryLength.DETAILED]:
    'Use 2-3 short paragraphs with key context and nuance.',
};

export function buildSummarizeArticlePrompt(
  article: ArticlePromptInput,
  maxLength: SummaryLength,
) {
  return [
    'Summarize this Knowledge Hub article for a technical reader.',
    lengthInstructions[maxLength],
    'Return only the summary text.',
    '',
    `Title: ${article.title}`,
    '',
    article.content,
  ].join('\n');
}

export function buildTranslateArticlePrompt(
  article: ArticlePromptInput,
  targetLanguage: string,
  sourceLanguage?: string,
) {
  const sourceInstruction = sourceLanguage
    ? `The source language is ${sourceLanguage}.`
    : 'Detect the source language.';

  return [
    'Translate this Knowledge Hub article content.',
    sourceInstruction,
    `Translate into ${targetLanguage}.`,
    'Return valid JSON only with this exact shape:',
    '{"translatedText":"...","detectedLanguage":"..."}',
    '',
    `Title: ${article.title}`,
    '',
    article.content,
  ].join('\n');
}

export function buildAnalyzeArticlePrompt(
  article: ArticlePromptInput,
  task: AnalyzeTask,
) {
  return [
    'Analyze this Knowledge Hub article for a technical audience.',
    `Task: ${task}.`,
    'Return valid JSON only with this exact shape:',
    '{"analysis":"...","suggestions":["..."],"severity":"info|warning|error"}',
    'Use severity "error" only for serious correctness or safety problems, "warning" for meaningful concerns, and "info" for general observations.',
    '',
    `Title: ${article.title}`,
    '',
    article.content,
  ].join('\n');
}
