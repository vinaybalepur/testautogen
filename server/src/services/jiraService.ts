import axios          from 'axios';
import { JiraTicket } from '../types';

const jiraClient = axios.create({
  baseURL: process.env.JIRA_BASE_URL,
  auth: {
    username: process.env.JIRA_EMAIL as string,
    password: process.env.JIRA_API_TOKEN as string
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

// ── Recursively extract plain text from any ADF node ──
const extractTextFromNode = (node: any): string => {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.content && Array.isArray(node.content)) {
    const childText = node.content
      .map((child: any) => extractTextFromNode(child))
      .join('');
    const blockTypes = ['paragraph', 'heading', 'listItem'];
    return blockTypes.includes(node.type) ? childText + '\n' : childText;
  }
  return '';
};

const extractDescription = (description: any): string | null => {
  if (!description) return null;
  try {
    const text = extractTextFromNode(description).trim();
    return text || null;
  } catch {
    return null;
  }
};

// ── Fetch a single Jira ticket by key ─────────────────
export const fetchJiraTicket = async (ticketKey: string): Promise<JiraTicket> => {
  const response = await jiraClient.get(`/rest/api/3/issue/${ticketKey}`);
  const fields   = response.data.fields;

  return {
    id:          response.data.id,
    key:         response.data.key,
    summary:     fields.summary,
    description: extractDescription(fields.description),
    status:      fields.status?.name    || 'Unknown',
    priority:    fields.priority?.name  || 'None',
    issueType:   fields.issuetype?.name || 'Unknown',
    reporter:    fields.reporter?.displayName || 'Unknown',
    assignee:    fields.assignee?.displayName || null
  };
};

// ── Create a Test ticket in Jira ───────────────────────
export const createTestTicket = async (
  summary:        string,
  description:    string,
  testProjectKey: string
): Promise<string> => {
  console.log('Pushing to project key:', testProjectKey);

  const createResponse = await jiraClient.post('/rest/api/3/issue', {
    fields: {
      project:   { key: testProjectKey },
      summary,
      description: {
        type:    'doc',
        version: 1,
        content: [
          {
            type:    'paragraph',
            content: [{ type: 'text', text: description }]
          }
        ]
      },
      issuetype: { name: 'Task' }    // ← changed from Test to Task
    }
  });

  return createResponse.data.key;
};

// ── Update existing Test ticket in Jira ───────────────
export const updateTestTicket = async (
  jiraKey:     string,
  description: string
): Promise<void> => {
  await jiraClient.put(`/rest/api/3/issue/${jiraKey}`, {
    fields: {
      description: {
        type:    'doc',
        version: 1,
        content: [
          {
            type:    'paragraph',
            content: [{ type: 'text', text: description }]
          }
        ]
      }
    }
  });
};

// ── Check if ticket exists in Jira ─────────────────────
export const ticketExistsInJIRA = async (jiraKey: string): Promise<boolean> => {
  try {
    await jiraClient.get(`/rest/api/3/issue/${jiraKey}?fields=id`);
    return true;
  } catch {
    return false;
  }
};

// ── Create a Bug defect in Jira ────────────────────────
export const createDefect = async (
  ticketKey:    string,
  summary:      string,
  description:  string
): Promise<string> => {

  // Extract project key from ticket key e.g. SCRUM from SCRUM-7
  const projectKey = ticketKey.split('-')[0];

  const response = await jiraClient.post('/rest/api/3/issue', {
    fields: {
      project:   { key: projectKey },
      summary,
      description: {
        type:    'doc',
        version: 1,
        content: [
          {
            type:    'paragraph',
            content: [{ type: 'text', text: description }]
          }
        ]
      },
      issuetype: { name: 'Bug' }
    }
  });

  return response.data.key;
};