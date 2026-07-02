import axios                                 from 'axios';
import { AIRequest, AIResponse } from '../types';

// ── Provider configurations ────────────────────────────
const providerConfigs: Record<string, any> = {
  copilot: {
    url: 'https://api.githubcopilot.com/chat/completions',
    headers: () => ({
      'Authorization':          `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type':           'application/json',
      'Copilot-Integration-Id': 'vscode-chat'
    }),
    buildBody: (model: string, prompt: string) => ({
      model,
      messages: [
        { role: 'system', content: 'You are an expert QA engineer. Always respond with valid JSON only.' },
        { role: 'user',   content: prompt }
      ],
      temperature:     0.3,
      response_format: { type: 'json_object' }
    }),
    extractContent:  (data: any) => data.choices[0].message.content,
    extractTokens:   (data: any) => data.usage?.total_tokens || 0
  },

  gemini: {
    url: (model: string) => 
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    headers: () => ({
      'Content-Type': 'application/json'
    }),
    buildBody: (_model: string, prompt: string) => ({
      contents: [
        { parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature:      0.3,
        responseMimeType: 'application/json'
      }
    }),
    extractContent:  (data: any) => data.candidates[0].content.parts[0].text,
    extractTokens:   (data: any) => data.usageMetadata?.totalTokenCount || 0
  },

  claude: {
    url: 'https://api.anthropic.com/v1/messages',
    headers: () => ({
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json'
    }),
    buildBody: (model: string, prompt: string) => ({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt }
      ]
    }),
    extractContent:  (data: any) => data.content[0].text,
    extractTokens:   (data: any) => 
      (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
  }
};

// ── Single prompt for all providers ───────────────────
const buildPrompt = (
  summary:     string,
  description: string | null
): string => `
You are an expert QA engineer. Analyze the following Jira ticket and generate
comprehensive BDD test cases in Gherkin format.

JIRA TICKET:
Summary: ${summary}
Description: ${description || 'No description provided'}

INSTRUCTIONS:
- Generate as many test cases as needed to cover the requirement thoroughly
- Use proper Gherkin syntax: Feature, Scenario, Given, When, Then, And
- Decide the types of test cases needed based on the requirement
- Each scenario must be independent and self contained
- Be specific with test data where applicable
- Return ONLY a JSON object in this exact format:
{
  "testCases": [
    "Feature: <name>\\nScenario: <name>\\nGiven <precondition>\\nWhen <action>\\nThen <result>"
  ]
}
`;

// ── Main generate function ─────────────────────────────
export const generateBDDTestCases = async (
  request: AIRequest
): Promise<AIResponse> => {
  const config = providerConfigs[request.provider.toLowerCase()];

  if (!config) {
    throw new Error(`Unsupported AI provider: ${request.provider}`);
  }

  const prompt = buildPrompt(request.summary, request.description);

  // Resolve URL — some providers need model in URL (Gemini)
  const url = typeof config.url === 'function'
    ? config.url(request.model)
    : config.url;

  const response = await axios.post(
    url,
    config.buildBody(request.model, prompt),
    { headers: config.headers() }
  );

  const content        = config.extractContent(response.data);
  const parsed         = JSON.parse(content);
  const tokensConsumed = config.extractTokens(response.data);

  return {
    testCases:      parsed.testCases,
    tokensConsumed,
    provider:       request.provider,
    model:          request.model
  };
};