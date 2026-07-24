import { Request, Response } from 'express';
import pool                   from '../config/db';
import axios                  from 'axios';

// ── RUN DISCOVERY ──────────────────────────────────────
export const runDiscovery = async (req: Request, res: Response): Promise<void> => {
  const ticketKey = req.params.ticketKey as string;
  const { apiIds, baseUrl, variables } = req.body;

  if (!apiIds || !baseUrl) {
    res.status(400).json({ error: 'apiIds and baseUrl are required' });
    return;
  }

  try {
    // Check if discovery already running
    const existing = await pool.query(
      `SELECT status FROM collection_discovery WHERE ticket_key = $1`,
      [ticketKey]
    );

    if (existing.rows.length > 0 && existing.rows[0].status === 'running') {
      res.status(409).json({ error: 'Discovery already running for this ticket' });
      return;
    }

    // Upsert discovery record
    await pool.query(
      `INSERT INTO collection_discovery
        (ticket_key, status, run_by, api_ids, base_url, started_at)
       VALUES ($1, 'running', $2, $3, $4, NOW())
       ON CONFLICT (ticket_key)
       DO UPDATE SET
         status     = 'running',
         run_by     = $2,
         api_ids    = $3,
         base_url   = $4,
         started_at = NOW(),
         error      = NULL`,
      [ticketKey, req.userId, JSON.stringify(apiIds), baseUrl]
    );

    // Return immediately
    res.json({ message: 'Discovery started', ticketKey });

    // Run async in background
    runDiscoveryAsync(ticketKey, apiIds, baseUrl, variables || {}, req.userId!);

  } catch (err: any) {
    console.error('Discovery error:', err.message);
    res.status(500).json({ error: 'Failed to start discovery' });
  }
};

// ── RUN DISCOVERY ASYNC ────────────────────────────────
const runDiscoveryAsync = async (
  ticketKey: string,
  apiIds:    number[],
  baseUrl:   string,
  variables: Record<string, string>,
  userId:    number
): Promise<void> => {
    console.log('🚀 runDiscoveryAsync started', { ticketKey, apiIds, baseUrl, userId }); 
  try {
    // Fetch APIs in order
    // const apiResults = await Promise.all(
    //   apiIds.map(id =>
    //     pool.query(
    //       `SELECT ar.*,
    //         COALESCE(
    //           json_object_agg(arv.name, arv.value)
    //           FILTER (WHERE arv.name IS NOT NULL),
    //           '{}'::json
    //         ) as saved_vars
    //        FROM api_registry ar
    //        LEFT JOIN api_registry_variables arv
    //          ON arv.api_id = ar.id AND arv.user_id = $2
    //        WHERE ar.id = $1
    //        GROUP BY ar.id`,
    //       [id, userId]
    //     )
    //   )
    // );

    const apiResults = await Promise.all(
  apiIds.map((id: number) =>
    pool.query(
      `SELECT * FROM api_registry WHERE id = $1`,
      [id]
    )
  )
);

    const apiList = apiResults.map(r => r.rows[0]).filter(Boolean);
    console.log('API IDs received:', apiIds);
    console.log('API list fetched:', apiList.length, apiList.map((a: any) => a?.name));


    // Build collection variables
    const collectionVars: Record<string, string> = {
      base_url: baseUrl,
      ...variables
    };

    // Add saved variables from DB
    // for (const api of apiList) {
    //   if (api.saved_vars) {
    //     Object.assign(collectionVars, api.saved_vars);
    //   }
    // }

    for (const api of apiList) {
  const varsResult = await pool.query(
    `SELECT name, value FROM api_registry_variables
     WHERE api_id = $1 AND user_id = $2`,
    [api.id, userId]
  );
  api.saved_vars = {};
  varsResult.rows.forEach((v: any) => {
    api.saved_vars[v.name] = v.value;
  });
}

    const responseSchemas: any[] = [];
    const extractedVars:   any[] = [];
    const apiChain:        any[] = [];

    // Run each API sequentially
    for (const api of apiList) {
      try {
        console.log(`🔍 Discovery: ${api.method} ${baseUrl}${api.path}`);

        // Replace variables in path
        let path = api.path;
        for (const [key, value] of Object.entries(collectionVars)) {
          path = path.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }

        // Replace variables in body
        let body = null;
        if (api.body) {
          let bodyStr = JSON.stringify(api.body);
          for (const [key, value] of Object.entries(collectionVars)) {
            bodyStr = bodyStr.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          }
          body = JSON.parse(bodyStr);
        }

        // Build headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (api.auth_type === 'bearer' && collectionVars['token']) {
          headers['Authorization'] = `Bearer ${collectionVars['token']}`;
        }

        if (api.headers?.length > 0) {
          for (const h of api.headers) {
            if (h.key && h.value) headers[h.key] = h.value;
          }
        }

        // Call the API
        const response = await axios({
  method:  api.method.toLowerCase(),
  url:     `${baseUrl}${path}`,
  headers,
  data:    api.method === 'GET' ? undefined : body,  // ← don't send body for GET
  timeout: 10000
});

        const responseData = response.data;
        const statusCode   = response.status;

        console.log(`✅ Discovery: ${api.method} ${path} → ${statusCode}`);

        // Extract variables from response
        const vars = extractVariables(api.name, responseData);

        // Add extracted vars to collection for next API
        Object.assign(collectionVars, vars);

        // Cache response schema in api_registry
        await pool.query(
          `UPDATE api_registry
           SET response_schema = $1, discovered_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(buildSchema(responseData)), api.id]
        );

        responseSchemas.push({
          apiId:      api.id,
          apiName:    api.name,
          method:     api.method,
          path:       api.path,
          statusCode,
          schema:     buildSchema(responseData)
        });

        extractedVars.push({
          apiId:     api.id,
          apiName:   api.name,
          variables: vars
        });

        apiChain.push({
          apiId:    api.id,
          name:     api.name,
          method:   api.method,
          path:     api.path,
          extracts: Object.keys(vars),
          needs:    getNeededVars(api)
        });

      } catch (apiErr: any) {
        console.error(`❌ Discovery failed: ${api.method} ${api.path}:`, apiErr.message);
        responseSchemas.push({
          apiId:   api.id,
          apiName: api.name,
          error:   apiErr.message
        });
        apiChain.push({
          apiId:  api.id,
          name:   api.name,
          method: api.method,
          path:   api.path,
          error:  apiErr.message
        });
      }
    }

    // Save discovery results
    await pool.query(
      `UPDATE collection_discovery
       SET
         status           = 'completed',
         response_schemas = $1,
         extracted_vars   = $2,
         api_chain        = $3,
         completed_at     = NOW()
       WHERE ticket_key = $4`,
      [
        JSON.stringify(responseSchemas),
        JSON.stringify(extractedVars),
        JSON.stringify(apiChain),
        ticketKey
      ]
    );

    console.log(`✅ Discovery completed for ${ticketKey}`);

  } catch (err: any) {
    console.error('Discovery async error:', err.message);
    await pool.query(
      `UPDATE collection_discovery
       SET status = 'failed', error = $1
       WHERE ticket_key = $2`,
      [err.message, ticketKey]
    );
  }
};

// ── EXTRACT VARIABLES FROM RESPONSE ───────────────────
const extractVariables = (
  apiName:      string,
  responseData: any
): Record<string, string> => {
  const vars:      Record<string, string> = {};
  const namePrefix = apiName.toLowerCase().replace(/\s+/g, '_');

  const extract = (obj: any, path: string = '') => {
    // ── Handle arrays — only extract first item ──────
    if (Array.isArray(obj)) {
      if (obj.length > 0) extract(obj[0], path);
      return;
    }
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}_${key}` : key;
      if (typeof value === 'string' || typeof value === 'number') {
        vars[`${namePrefix}_${fullPath}`] = String(value);
        // Common names without prefix
        if (['token', 'access_token', 'id', 'session_id', 'basket_id', 'order_id'].includes(key.toLowerCase())) {
          vars[key.toLowerCase()] = String(value);
        }
      } else if (Array.isArray(value)) {
        if (value.length > 0) extract(value[0], fullPath);
      } else if (typeof value === 'object' && value !== null) {
        extract(value, fullPath);
      }
    }
  };

  extract(responseData);
  return vars;
};

// ── BUILD SCHEMA FROM RESPONSE ─────────────────────────
const buildSchema = (data: any): any => {
  if (Array.isArray(data)) {
    // For arrays — only capture schema of first item
    return data.length > 0 ? [buildSchema(data[0])] : [];
  }
  if (!data || typeof data !== 'object') return typeof data;
  const schema: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      schema[key] = value.length > 0 ? [buildSchema(value[0])] : [];
    } else if (typeof value === 'object' && value !== null) {
      schema[key] = buildSchema(value);
    } else {
      schema[key] = typeof value;
    }
  }
  return schema;
};

// ── GET NEEDED VARS FROM API ───────────────────────────
const getNeededVars = (api: any): string[] => {
  const needed:  string[] = [];
  const bodyStr  = JSON.stringify(api.body || {});
  const pathStr  = api.path || '';
  const combined = bodyStr + pathStr;
  const matches  = combined.matchAll(/\{\{(\w+)\}\}/g);
  for (const match of matches) {
    if (!needed.includes(match[1])) needed.push(match[1]);
  }
  return needed;
};

// ── GET DISCOVERY STATUS ───────────────────────────────
export const getDiscoveryStatus = async (req: Request, res: Response): Promise<void> => {
  const { ticketKey } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         cd.*,
         u.first_name as run_by_name
       FROM collection_discovery cd
       LEFT JOIN users u ON u.id = cd.run_by
       WHERE cd.ticket_key = $1`,
      [ticketKey]
    );

    if (result.rows.length === 0) {
      res.json({ status: 'not_started', ticketKey });
      return;
    }

    res.json({ discovery: result.rows[0] });

  } catch (err) {
    console.error('Get discovery error:', err);
    res.status(500).json({ error: 'Failed to fetch discovery status' });
  }
};