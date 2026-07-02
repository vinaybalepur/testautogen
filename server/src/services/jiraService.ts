import axios            from 'axios';
import { JiraTicket }   from '../types';
import { response } from 'express';

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

// ── Extract plain text from Jira's rich text description ──
const extractDescription = (description: any): string | null => {
    
  if (!description || !description.content) return null;

  try {
    return description.content
      .map((block: any) =>
        block.content
          ?.map((item: any) => item.text || '')
          .join('') || ''
      )
      .join('\n')
      .trim();
  } catch {
    return null;
  }
};

// ── Fetch a single Jira ticket by key ──────────────────
export const fetchJiraTicket = async (ticketKey: string): Promise<JiraTicket> => {
  const response = await jiraClient.get(`/rest/api/3/issue/${ticketKey}`);
  const fields = response.data.fields;
  console.log("Fields" + response.data.renderedFields);
  return {
    id:          response.data.id,
    key:         response.data.key,
    summary:     fields.summary,
    description: extractDescription(fields.description),
    status:      fields.status?.name || 'Unknown',
    priority:    fields.priority?.name || 'None',
    issueType:   fields.issuetype?.name || 'Unknown',
    reporter:    fields.reporter?.displayName || 'Unknown',
    assignee:    fields.assignee?.displayName || null
  };
};