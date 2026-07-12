import { generateRawJSON } from './aiService';

// ── Ask AI to extract API details from ONE test case ───
const extractAPIDetails = async (
  testCase: string,
  baseUrl:  string,
  provider: string,
  model:    string
): Promise<any> => {

  const prompt = `
Analyze this BDD test case and extract the API request details.

BDD TEST CASE:
${testCase}

BASE URL: ${baseUrl}

Extract and return ONLY a JSON object in this exact format:
{
  "name":           "<scenario name>",
  "method":         "<HTTP METHOD e.g. GET, POST, PUT, DELETE>",
  "path":           "<endpoint path e.g. /auth>",
  "headers":        [{ "key": "<header name>", "value": "<header value>" }],
  "body":           "<request body as JSON string or null if no body>",
  "expectedStatus": <expected HTTP status code as integer>,
  "testScript":     "<pm.test assertion as single line string>",
  "isAuth":         <true if this is a login/auth request, false otherwise>
}

RULES:
- Use {{base_url}} for base URL
- Use {{auth_token}} for bearer token
- Use {{username}} for username variable
- Use {{password}} for password variable
- For auth/login request set isAuth to true and add test script to store token:
  pm.collectionVariables.set("auth_token", pm.response.json().token);
- For non-auth requests add Authorization header with Bearer {{auth_token}}
- Body must be valid JSON string or null
- testScript must validate the expected status code
- Return ONLY valid JSON no additional text
`;

  const { data } = await generateRawJSON(
    { summary: '', description: null, provider, model },
    prompt
  );

  return data;
};

// ── Build Postman request item from API details ────────
const buildRequestItem = (details: any, baseUrl: string): any => {

  // Parse path into segments
  const pathSegments = details.path
    .split('/')
    .filter((s: string) => s.length > 0);

  // Build test script
  const testScript = details.isAuth
    ? [
        `pm.test("Status code is ${details.expectedStatus}", function() {`,
        `  pm.response.to.have.status(${details.expectedStatus});`,
        `});`,
        `if(pm.response.code === 200 && pm.response.json().token) {`,
        `  pm.collectionVariables.set("auth_token", pm.response.json().token);`,
        `}`
      ]
    : [
        `pm.test("Status code is ${details.expectedStatus}", function() {`,
        `  pm.response.to.have.status(${details.expectedStatus});`,
        `});`
      ];

  return {
    name:    details.name,
    request: {
      method:  details.method,
      header:  details.headers || [],
      body:    details.body
        ? {
            mode:    'raw',
            raw:     details.body,
            options: { raw: { language: 'json' } }
          }
        : undefined,
      url: {
        raw:  `{{base_url}}${details.path}`,
        host: ['{{base_url}}'],
        path: pathSegments
      }
    },
    event: [
      {
        listen: 'test',
        script: {
          exec: testScript,
          type: 'text/javascript'
        }
      }
    ]
  };
};

// ── Generate Postman Collection ────────────────────────
export const generatePostmanCollection = async (
  ticketKey:  string,
  testCases:  string[],
  baseUrl:    string,
  username:   string,
  password:   string,
  provider:   string,
  model:      string
): Promise<{ collection: any; tokensConsumed: number }> => {

  console.log(`Generating collection for ${testCases.length} test cases...`);

  let totalTokens = 0;
  const items:    any[] = [];
  const failed:   any[] = [];

  // Process each test case individually
  for (let i = 0; i < testCases.length; i++) {
    try {
      console.log(`Processing test case ${i + 1}/${testCases.length}...`);

      const { data: details, tokensConsumed } = await generateRawJSON(
        { summary: '', description: null, provider, model },
        `
Analyze this BDD test case and extract the API request details.

BDD TEST CASE:
${testCases[i]}

BASE URL: ${baseUrl}

Extract and return ONLY a JSON object in this exact format:
{
  "name":           "<scenario name>",
  "method":         "<HTTP METHOD e.g. GET, POST, PUT, DELETE>",
  "path":           "<endpoint path e.g. /auth>",
  "headers":        [{ "key": "<header name>", "value": "<header value>" }],
  "body":           "<request body as JSON string or null if no body>",
  "expectedStatus": <expected HTTP status code as integer>,
  "isAuth":         <true if this is a login/auth request, false otherwise>
}

RULES:
- Use {{base_url}} for base URL
- Use {{auth_token}} for bearer token  
- Use {{username}} for username variable
- Use {{password}} for password variable
- For auth/login request set isAuth to true
- For non-auth requests include Authorization header: Bearer {{auth_token}}
- Body must be valid JSON string or null
- Return ONLY valid JSON no additional text
        `
      );

      totalTokens += tokensConsumed;
      items.push(buildRequestItem(details, baseUrl));

    } catch (err: any) {
      console.error(`Failed to process test case ${i + 1}:`, err.message);
      failed.push({ index: i + 1, error: err.message });
    }
  }

  // Build complete Postman collection
  const collection = {
    info: {
      name:   `${ticketKey} Test Collection`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    variable: [
      { key: 'base_url',   value: baseUrl,    type: 'string' },
      { key: 'auth_token', value: '',         type: 'string' },
      { key: 'username',   value: username,   type: 'string' },
      { key: 'password',   value: password,   type: 'string' }
    ],
    item: items
  };

  console.log(`Collection generated: ${items.length} requests, ${failed.length} failed`);

  return {
    collection,
    tokensConsumed: totalTokens
  };
};