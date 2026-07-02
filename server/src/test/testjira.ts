import dotenv from 'dotenv';
dotenv.config();

import { fetchJiraTicket } from '../services/jiraService';

const testFetch = async () => {
  try {
    const ticket = await fetchJiraTicket('SCRUM-4');  // ← change this
    console.log('✅ Ticket fetched successfully!');
    console.log(JSON.stringify(ticket, null, 2));
  } catch (err: any) {
    console.error('❌ Failed to fetch ticket:', err.response?.data || err.message);
  }
};

testFetch();