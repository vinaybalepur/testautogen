import { Request, Response } from 'express';
import { fetchJiraTicket }   from '../services/jiraService';

// ── FETCH JIRA TICKET LIVE ────────────────────────────
export const getTicket = async (req: Request, res: Response): Promise<void> => {
  
  let ticketKey: string;
  try {
    
    ticketKey = decodeURIComponent(req.params.ticketKey as string);
  } catch {
    res.status(400).json({ error: 'Invalid ticket key — contains illegal characters' });
    return;
  }
  
  // Validate ticket key format e.g. PROJ-123
  const ticketFormat = /^[A-Z][A-Z0-9_-]+-\d+$/;
  if (!ticketFormat.test(ticketKey)) {
    res.status(400).json({ error: 'Invalid ticket key format. Are you sure you have entered valid jira id' });
    return;
  }

  try {
    // Always fetch fresh from Jira
    const ticket = await fetchJiraTicket(ticketKey);
    res.json({ ticket });

  } catch (err: any) {
    if (err.response?.status === 404) {
      res.status(404).json({ error: `Ticket ${ticketKey} not found in Jira` });
      return;
    }

    if (err.response?.status === 401) {
      res.status(401).json({ error: 'Jira authentication failed' });
      return;
    }

    console.error('Jira fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch ticket from Jira. May be jira is down. Try after some time' });
  }
};