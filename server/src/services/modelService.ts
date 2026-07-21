import axios from 'axios';
import pool  from '../config/db';

export interface AIModel {
  model_id:   string;
  model_name: string;
}

// ── Fetch from Gemini API ──────────────────────────────
const fetchGeminiModels = async (apiKey: string): Promise<AIModel[]> => {
  const response = await axios.get(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );

  return response.data.models
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => ({
      model_id:   m.name.replace('models/', ''),
      model_name: m.displayName || m.name.replace('models/', '')
    }));
};

// ── Fetch from Claude API ──────────────────────────────
const fetchClaudeModels = async (apiKey: string): Promise<AIModel[]> => {
  const response = await axios.get(
    'https://api.anthropic.com/v1/models',
    {
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      }
    }
  );

  return response.data.data.map((m: any) => ({
    model_id:   m.id,
    model_name: m.display_name || m.id
  }));
};

// ── Validate Copilot key + return fixed list ───────────
const fetchCopilotModels = async (apiKey: string): Promise<AIModel[]> => {
  // Validate key with a minimal test call
  try {
    await axios.post(
      'https://api.githubcopilot.com/chat/completions',
      {
        model:      'gpt-4o',
        messages:   [{ role: 'user', content: 'hi' }],
        max_tokens: 1
      },
      {
        headers: {
          'Authorization':          `Bearer ${apiKey}`,
          'Content-Type':           'application/json',
          'Copilot-Integration-Id': 'vscode-chat'
        }
      }
    );
  } catch (err: any) {
    if (err.response?.status === 401) {
      throw new Error('Invalid Copilot API key');
    }
    // Other errors are fine — key is valid
  }

  // Return fixed list since Copilot has no models API
  return [
    { model_id: 'gpt-4o',            model_name: 'GPT-4o'                      },
    { model_id: 'gpt-4o-mini',       model_name: 'GPT-4o Mini'                 },
    { model_id: 'o3-mini',           model_name: 'o3 Mini'                     },
    { model_id: 'o1',                model_name: 'o1'                          },
    { model_id: 'claude-sonnet-4-5', model_name: 'Claude Sonnet 4.5 (Copilot)' }
  ];
};

// ── Save models to DB (upsert) ─────────────────────────
const saveModelsToDB = async (
  provider: string,
  models:   AIModel[]
): Promise<void> => {
  for (const model of models) {
    await pool.query(
      `INSERT INTO ai_models (provider, model_id, model_name, last_synced)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (provider, model_id)
       DO UPDATE SET
         model_name  = EXCLUDED.model_name,
         is_active   = TRUE,
         last_synced = NOW()`,
      [provider, model.model_id, model.model_name]
    );
  }
};

// ── Fetch models from DB (fallback) ───────────────────
const fetchModelsFromDB = async (provider: string): Promise<AIModel[]> => {
  const result = await pool.query(
    `SELECT model_id, model_name
     FROM ai_models
     WHERE provider  = $1
     AND   is_active = TRUE
     ORDER BY model_name ASC`,
    [provider]
  );
  return result.rows;
};

// ── Main function — API first, DB fallback ─────────────
export const getModelsForProvider = async (
  provider: string,
  apiKey:   string
): Promise<{ models: AIModel[]; source: 'api' | 'cache' }> => {

  try {
    // Try fetching from provider API
    let models: AIModel[] = [];

    switch (provider.toLowerCase()) {
      case 'gemini':  models = await fetchGeminiModels(apiKey);  break;
      case 'claude':  models = await fetchClaudeModels(apiKey);  break;
      case 'copilot': models = await fetchCopilotModels(apiKey); break;
      default: throw new Error(`Unsupported provider: ${provider}`);
    }

    // Save to DB for future fallback
    await saveModelsToDB(provider, models);

    return { models, source: 'api' };

  } catch (err: any) {
    console.warn(`⚠️ Failed to fetch ${provider} models from API: ${err.message}`);

    // Fallback to DB
    const models = await fetchModelsFromDB(provider);

    if (models.length === 0) {
      throw new Error(`No models available for ${provider}. Please check your API key.`);
    }

    return { models, source: 'cache' };
  }
};