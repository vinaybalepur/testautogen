import axios                                 from 'axios';
import { AIRequest, AIResponse }             from '../types';

// ── Provider configurations ────────────────────────────
const providerConfigs: Record<string, any> = {
  copilot: {
    url: 'https://api.githubcopilot.com/chat/completions',
    headers: (apiKey?: string | null) => ({                          // ← add apiKey param
      'Authorization':          `Bearer ${apiKey || process.env.GITHUB_TOKEN}`,  // ← use apiKey
      'Content-Type':           'application/json',
      'Copilot-Integration-Id': 'vscode-chat'
    }),
    buildBody: (model: string, prompt: string, jsonMode: boolean) => ({
      model,
      messages: [
        {
          role:    'system',
          content: jsonMode
            ? 'You are an expert API test engineer. Always respond with valid JSON only.'
            : 'You are an expert QA engineer. Always respond with valid JSON only.'
        },
        { role: 'user', content: prompt }
      ],
      temperature:     0.3,
      response_format: { type: 'json_object' }
    }),
    extractContent: (data: any) => data.choices[0].message.content,
    extractTokens:  (data: any) => data.usage?.total_tokens || 0
  },

  gemini: {
    url: (model: string, apiKey?: string | null) =>                  // ← add apiKey param
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey || process.env.GEMINI_API_KEY}`,  // ← use apiKey
    headers: (_apiKey?: string | null) => ({                         // ← add param (unused for gemini)
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
    extractContent: (data: any) => data.candidates[0].content.parts[0].text,
    extractTokens:  (data: any) => data.usageMetadata?.totalTokenCount || 0
  },

  claude: {
    url: 'https://api.anthropic.com/v1/messages',
    headers: (apiKey?: string | null) => ({                          // ← add apiKey param
      'x-api-key':         apiKey || process.env.ANTHROPIC_API_KEY, // ← use apiKey
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
    extractContent: (data: any) => data.content[0].text,
    extractTokens:  (data: any) =>
      (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
  }
};

// ── Call AI provider ───────────────────────────────────
const callProvider = async (
  request:  AIRequest,
  prompt:   string,
  jsonMode: boolean = true,
  userId?:  number
): Promise<{ content: string; tokensConsumed: number }> => {

  const config = providerConfigs[request.provider.toLowerCase()];
  if (!config) throw new Error(`Unsupported AI provider: ${request.provider}`);

  // Get API key from DB if userId provided, fallback to .env
  let apiKey: string | null = null;
  if (userId) {
    const { getDecryptedKey } = await import('../controllers/aiConfigController');
    apiKey = await getDecryptedKey(userId, request.provider);
  }

  // Pass apiKey to url (for Gemini) and headers
  const url = typeof config.url === 'function'
    ? config.url(request.model, apiKey)    // ← pass apiKey to url
    : config.url;

  const response = await axios.post(
    url,
    config.buildBody(request.model, prompt, jsonMode),
    { headers: config.headers(apiKey) }    // ← pass apiKey to headers
  );

  return {
    content:        config.extractContent(response.data),
    tokensConsumed: config.extractTokens(response.data)
  };
};

const buildBDDPrompt = (
  summary:     string,
  description: string | null
): string => `
You are an expert API QA engineer. Analyze the following Jira ticket and generate
comprehensive BDD test cases in Gherkin format.

JIRA TICKET:
Summary: ${summary}
Description: ${description || 'No description provided'}

STEP 1 — ANALYSE THE API CONTRACT:
Before generating test cases, identify for EACH field in the request:
- Field name
- Expected data type (string, integer, float, boolean, date, object, array)
- Required or optional
- Any format constraints mentioned in the requirement

STEP 2 — GENERATE POSITIVE SCENARIOS:
- Happy path with all valid fields
- Valid variations mentioned in requirement

STEP 3 — FOR EVERY STRING FIELD GENERATE ALL OF THESE (19 scenarios per field):
  WRONG TYPE:
  1.  Send integer instead of string                e.g. fieldname: 123
  2.  Send float instead of string                  e.g. fieldname: 12.34
  3.  Send boolean instead of string                e.g. fieldname: true
  4.  Send array instead of string                  e.g. fieldname: ["value"]
  5.  Send object instead of string                 e.g. fieldname: {"key": "value"}
  6.  Send null instead of string                   e.g. fieldname: null

  EMPTY VALUES:
  7.  Send empty string                             e.g. fieldname: ""
  8.  Send whitespace only                          e.g. fieldname: "   "
  9.  Send tab character                            e.g. fieldname: "\\t"
  10. Send newline character                        e.g. fieldname: "\\n"

  SPECIAL CHARACTERS:
  11. Send special characters                       e.g. fieldname: "@#\$%^&*()"
  12. Send SQL injection                            e.g. fieldname: "' OR '1'='1"
  13. Send HTML injection                           e.g. fieldname: "<script>alert(1)</script>"
  14. Send unicode characters                       e.g. fieldname: "用户名"
  15. Send emoji                                    e.g. fieldname: "admin😀"
  16. Send alphanumeric                             e.g. fieldname: "admin123"

  FIELD PRESENCE:
  17. Field missing from request body entirely
  18. Field name with wrong case                    e.g. Fieldname instead of fieldname
  19. Extra unexpected fields in request body

STEP 4 — FOR EVERY INTEGER FIELD GENERATE ALL OF THESE (14 scenarios per field):
  WRONG TYPE:
  1.  Send string instead of integer                e.g. fieldname: "abc"
  2.  Send alphanumeric instead of integer          e.g. fieldname: "123abc"
  3.  Send float instead of integer                 e.g. fieldname: 12.34
  4.  Send boolean instead of integer               e.g. fieldname: true
  5.  Send array instead of integer                 e.g. fieldname: [1]
  6.  Send object instead of integer                e.g. fieldname: {"value": 1}
  7.  Send null instead of integer                  e.g. fieldname: null

  BOUNDARY VALUES:
  8.  Send zero                                     e.g. fieldname: 0
  9.  Send negative integer                         e.g. fieldname: -1
  10. Send very large integer                       e.g. fieldname: 999999999
  11. Send very large negative integer              e.g. fieldname: -999999999

  FIELD PRESENCE:
  12. Field missing from request body entirely
  13. Field name with wrong case
  14. Extra unexpected fields in request body

STEP 5 — FOR EVERY FLOAT/DECIMAL FIELD GENERATE ALL OF THESE (10 scenarios per field):
  WRONG TYPE:
  1.  Send string instead of float                  e.g. fieldname: "abc"
  2.  Send boolean instead of float                 e.g. fieldname: true
  3.  Send array instead of float                   e.g. fieldname: [1.5]
  4.  Send null instead of float                    e.g. fieldname: null

  BOUNDARY VALUES:
  5.  Send zero                                     e.g. fieldname: 0.0
  6.  Send negative float                           e.g. fieldname: -1.5
  7.  Send very large float                         e.g. fieldname: 999999.99
  8.  Send integer instead of float                 e.g. fieldname: 1

  FIELD PRESENCE:
  9.  Field missing from request body entirely
  10. Extra unexpected fields in request body

STEP 6 — FOR EVERY BOOLEAN FIELD GENERATE ALL OF THESE (10 scenarios per field):
  WRONG TYPE:
  1.  Send string "true" instead of boolean         e.g. fieldname: "true"
  2.  Send string "false" instead of boolean        e.g. fieldname: "false"
  3.  Send integer 1 instead of boolean             e.g. fieldname: 1
  4.  Send integer 0 instead of boolean             e.g. fieldname: 0
  5.  Send string "yes" instead of boolean          e.g. fieldname: "yes"
  6.  Send string "no" instead of boolean           e.g. fieldname: "no"
  7.  Send null instead of boolean                  e.g. fieldname: null

  FIELD PRESENCE:
  8.  Field missing from request body entirely
  9.  Field name with wrong case
  10. Extra unexpected fields in request body

STEP 7 — FOR EVERY DATE FIELD GENERATE ALL OF THESE (11 scenarios per field):
  WRONG FORMAT:
  1.  Send wrong date format                        e.g. fieldname: "01-01-2026"
  2.  Send date with time                           e.g. fieldname: "2026-01-01T00:00:00"
  3.  Send invalid date                             e.g. fieldname: "2026-13-45"
  4.  Send past date                                e.g. fieldname: "2020-01-01"
  5.  Send future date                              e.g. fieldname: "2030-01-01"
  6.  Send string instead of date                   e.g. fieldname: "not-a-date"
  7.  Send integer instead of date                  e.g. fieldname: 20260101
  8.  Send null instead of date                     e.g. fieldname: null
  9.  Send empty string                             e.g. fieldname: ""

  FIELD PRESENCE:
  10. Field missing from request body entirely
  11. Extra unexpected fields in request body

STEP 8 — FOR EVERY OBJECT FIELD GENERATE ALL OF THESE (7 scenarios per field):
  1.  Send empty object                             e.g. fieldname: {}
  2.  Send null instead of object                   e.g. fieldname: null
  3.  Send string instead of object                 e.g. fieldname: "value"
  4.  Send array instead of object                  e.g. fieldname: []
  5.  Missing required nested fields
  6.  Extra unexpected nested fields
  7.  Field missing from request body entirely

STEP 9 — FOR EVERY ARRAY FIELD GENERATE ALL OF THESE (7 scenarios per field):
  1.  Send empty array                              e.g. fieldname: []
  2.  Send null instead of array                    e.g. fieldname: null
  3.  Send string instead of array                  e.g. fieldname: "value"
  4.  Send object instead of array                  e.g. fieldname: {}
  5.  Send array with wrong type elements
  6.  Send array with null elements
  7.  Field missing from request body entirely

STEP 10 — GENERAL SCENARIOS (for all APIs):
  1.  Send empty request body                       e.g. {}
  2.  Send null request body
  3.  Send array instead of object                  e.g. []
  4.  All required fields missing at once

STRICT RULES:
1.  Generate a SEPARATE test case for EACH scenario listed above
2.  ONLY cover fields mentioned in the requirement
3.  Status codes are FIXED per scenario — always include exact status code
4.  For DYNAMIC response values (token, ID) — describe by field name only
5.  For STATIC response values (error messages) — hardcode exact value
6.  DO NOT include response time, performance or load testing
7.  DO NOT include concurrent request scenarios
8.  Each scenario must be atomic and independent
9.  Scenario name MUST clearly state:
    - The field name being tested
    - The invalid value or type being sent
    e.g. "Send integer 123 for username field instead of string"
10. Cover ALL fields in the request body — do not skip any field

EXAMPLES OF CORRECT FORMAT:
✅ "Feature: Auth API\\nScenario: Send integer 123 for username field instead of string\\nGiven the auth API is available\\nWhen I send a POST request to /auth with username as integer 123 and valid password\\nThen the response status code should be 200\\nAnd the reason field should equal Bad credentials"

✅ "Feature: Auth API\\nScenario: Send null for password field\\nGiven the auth API is available\\nWhen I send a POST request to /auth with valid username and password as null\\nThen the response status code should be 200\\nAnd the reason field should equal Bad credentials"

✅ "Feature: Auth API\\nScenario: Send SQL injection for username field\\nGiven the auth API is available\\nWhen I send a POST request to /auth with username as \\' OR \\'1\\'=\\'1 and valid password\\nThen the response status code should be 200\\nAnd the reason field should equal Bad credentials"

❌ "Then the token should be eyJhbGci..."
❌ "Then the response time should be under 200ms"
❌ "When I send concurrent requests"

Return ONLY a JSON object in this exact format with no additional text:
{
  "testCases": [
    "Feature: <feature name>\\nScenario: <field name + invalid value/type>\\nGiven <precondition>\\nWhen <specific action with exact invalid value>\\nThen <exact status code>\\nAnd <response validation>"
  ]
}
`;

// ── Generate BDD test cases ────────────────────────────
export const generateBDDTestCases = async (
  request: AIRequest
): Promise<AIResponse> => {

  const prompt = request.description?.startsWith('\nYou are an expert API')
    ? request.description
    : buildBDDPrompt(request.summary, request.description);

  // Pass userId to callProvider for DB key lookup
  const { content, tokensConsumed } = await callProvider(
    request,
    prompt,
    true,
    request.userId    // ← pass userId here
  );

  const clean  = content.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  return {
    testCases:      parsed.testCases || [parsed],
    tokensConsumed,
    provider:       request.provider,
    model:          request.model
  };
};

// ── Generate raw JSON (for Postman collection) ─────────
export const generateRawJSON = async (
  request: AIRequest,
  prompt:  string
): Promise<{ data: any; tokensConsumed: number }> => {

  const { content, tokensConsumed } = await callProvider(request, prompt, true);

  // Clean and parse
  const clean  = content.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  return {
    data: parsed,
    tokensConsumed
  };
};