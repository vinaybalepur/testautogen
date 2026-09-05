/**
 * Converts a Postman collection (v2.1 format, as generated elsewhere in
 * TestSage) into a JMeter JMX test plan for load testing.
 *
 * Only structural elements needed for load testing are carried over:
 * method, URL, headers, body. Postman test scripts (pm.test assertions)
 * are intentionally NOT converted — functional correctness is already
 * covered by the Newman run; this JMX is for throughput/latency only.
 *
 * Postman {{variable}} syntax is mapped to JMeter's ${variable} syntax.
 */

interface PostmanHeader {
  key: string;
  value: string;
}

interface PostmanBody {
  mode?: string;
  raw?: string;
}

interface PostmanUrl {
  raw: string;
}

interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  url: PostmanUrl;
}

interface PostmanItem {
  name: string;
  request: PostmanRequest;
}

interface PostmanVariable {
  key: string;
  value: string;
}

interface PostmanCollection {
  variable?: PostmanVariable[];
  item: PostmanItem[];
}

export interface LoadTestParams {
  threads: number;          // number of virtual users
  rampUpSeconds: number;    // time to ramp up to full thread count
  loops?: number;           // iterations per thread (mutually exclusive with durationSeconds)
  durationSeconds?: number; // run for a fixed duration instead of fixed loop count
}

/** Converts {{var}} → ${var} for JMeter variable substitution. */
function toJMeterVar(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, '${$1}');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Parses a raw URL string into protocol/domain/port/path for JMeter's HTTPSamplerProxy. */
function parseUrl(
  rawUrl: string,
  variables: Record<string, string>
): { protocol: string; domain: string; port: string; path: string } {
  // Resolve {{var}} references using known collection variable VALUES first
  // (not JMeter ${var} syntax) — JMeter's domain/protocol fields need a
  // literal host, they can't be built from an interpolated variable.
  const resolved = rawUrl.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);

  try {
    const url = new URL(resolved);
    return {
      protocol: url.protocol.replace(':', '') || 'https',
      domain:   url.hostname,
      port:     url.port || '',
      path:     toJMeterVar(url.pathname + url.search) || '/',
    };
  } catch {
    // Resolution failed (e.g. base_url wasn't in variables) — fall back
    // to treating the whole thing as an unresolved path off a blank host,
    // which will fail loudly rather than silently corrupting the domain.
    const match = resolved.match(/^(\w+):\/\/([^/]+)(\/.*)?$/);
    return {
      protocol: match?.[1] || 'https',
      domain:   match?.[2]?.split(':')[0] || resolved,
      port:     '',
      path:     toJMeterVar(match?.[3] || '/'),
    };
  }
}

function buildHeaderManager(headers: PostmanHeader[] | undefined): string {
  if (!headers || headers.length === 0) return '';
  const headerElements = headers
    .map(h => `
          <elementProp name="" elementType="Header">
            <stringProp name="Header.name">${escapeXml(h.key)}</stringProp>
            <stringProp name="Header.value">${escapeXml(toJMeterVar(h.value))}</stringProp>
          </elementProp>`)
    .join('');

  return `
        <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="Headers" enabled="true">
          <collectionProp name="HeaderManager.headers">${headerElements}
          </collectionProp>
        </HeaderManager>
        <hashTree/>`;
}

function buildSampler(item: PostmanItem, variables: Record<string, string>): string {
  const { method, header, body, url } = item.request;
  const { protocol, domain, port, path } = parseUrl(url.raw, variables);

  const bodyProp = body?.raw
    ? `
          <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">false</boolProp>
                <stringProp name="Argument.value">${escapeXml(toJMeterVar(body.raw))}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>`
    : `
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>`;

  return `
      <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${escapeXml(item.name)}" enabled="true">
        <stringProp name="HTTPSampler.domain">${escapeXml(domain)}</stringProp>
        <stringProp name="HTTPSampler.port">${port}</stringProp>
        <stringProp name="HTTPSampler.protocol">${protocol}</stringProp>
        <stringProp name="HTTPSampler.path">${escapeXml(path)}</stringProp>
        <stringProp name="HTTPSampler.method">${method}</stringProp>
        <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
        <boolProp name="HTTPSampler.use_keepalive">true</boolProp>${bodyProp}
      </HTTPSamplerProxy>
      <hashTree>${buildHeaderManager(header)}
      </hashTree>`;
}

function buildUserDefinedVariables(variables: PostmanVariable[] | undefined): string {
  if (!variables || variables.length === 0) {
    return `
      <elementProp name="TestPlan.arguments" elementType="Arguments">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>`;
  }

  const argElements = variables
    .map(v => `
          <elementProp name="${escapeXml(v.key)}" elementType="Argument">
            <stringProp name="Argument.name">${escapeXml(v.key)}</stringProp>
            <stringProp name="Argument.value">${escapeXml(v.value || '')}</stringProp>
            <stringProp name="Argument.metadata">=</stringProp>
          </elementProp>`)
    .join('');

  return `
      <elementProp name="TestPlan.arguments" elementType="Arguments">
        <collectionProp name="Arguments.arguments">${argElements}
        </collectionProp>
      </elementProp>`;
}

/**
 * Builds a complete JMeter JMX XML string from a Postman collection and
 * the user-supplied load parameters (threads, ramp-up, and either a loop
 * count or a fixed duration).
 */
export function convertPostmanToJmx(
  collection: PostmanCollection,
  params: LoadTestParams
): string {
  const { threads, rampUpSeconds, loops, durationSeconds } = params;

  const useScheduler = !!durationSeconds;
  const loopCount    = useScheduler ? -1 : (loops || 1); // -1 loops forever, bounded by scheduler duration
  const varMap: Record<string, string> = {};
(collection.variable || []).forEach(v => { varMap[v.key] = v.value; });

  const samplers = collection.item.map(item => buildSampler(item, varMap)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="TestSage Load Test" enabled="true">
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>${buildUserDefinedVariables(collection.variable)}
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Thread Group" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController">
          <boolProp name="LoopController.continue_forever">${useScheduler}</boolProp>
          <stringProp name="LoopController.loops">${loopCount}</stringProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">${threads}</stringProp>
        <stringProp name="ThreadGroup.ramp_time">${rampUpSeconds}</stringProp>
        <boolProp name="ThreadGroup.scheduler">${useScheduler}</boolProp>
        <stringProp name="ThreadGroup.duration">${durationSeconds || ''}</stringProp>
        <stringProp name="ThreadGroup.delay"></stringProp>
      </ThreadGroup>
      <hashTree>${samplers}
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`;
}
