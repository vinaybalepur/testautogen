import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.githubcopilot.com',
  apiKey:  process.env.GITHUB_TOKEN as string
});

const test = async () => {
  try {
    const response = await client.chat.completions.create({
      model:    process.env.COPILOT_MODEL as string,
      messages: [
        { role: 'user', content: 'Say hello in one sentence.' }
      ]
    });
    console.log('✅ Copilot connected!');
    console.log('Response:', response.choices[0].message.content);
    console.log('Tokens used:', response.usage?.total_tokens);
  } catch (err: any) {
    console.error('❌ Copilot connection failed:', err.message);
  }
};

test();