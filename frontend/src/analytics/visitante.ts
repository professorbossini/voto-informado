import UAParser from 'ua-parser-js';

/** Robôs que se anunciam no user agent (buscadores, pré-visualização de links, scripts). */
const BOT =
  /bot|crawl|spider|slurp|curl|wget|python-requests|python-urllib|httpx|axios|node-fetch|go-http-client|java\/|okhttp|headless|lighthouse|facebookexternalhit|preview|scrapy|feedfetcher/i;

/** O nome do robô: o primeiro pedaço do user agent que tem cara de robô ("Googlebot", "curl"). */
function botName(ua: string) {
  const token = ua
    .split(/[\s;()]+/)
    .map((t) => t.split('/')[0]!)
    .find((t) => BOT.test(t));
  return token ? `Robô ${token}` : 'Robô';
}

const major = (v?: string) => v?.split('.')[0];

/** Navegador e sistema, como "Chrome 142" e "Windows 10", a partir do user agent. Robôs viram "Robô" + nome. */
export function describeAgent(ua: string | null | undefined): { browser: string; os: string } {
  if (!ua) return { browser: '–', os: '–' };
  if (BOT.test(ua)) return { browser: botName(ua), os: '–' };
  const r = new UAParser(ua).getResult();
  const browser = [r.browser.name, major(r.browser.version)].filter(Boolean).join(' ') || '–';
  // macOS fica sem versão: o Safari e o Chrome congelaram a versão no user agent (sempre 10.15.7).
  const osVersion = r.os.name === 'Mac OS' ? undefined : r.os.version;
  const osName = r.os.name === 'Mac OS' ? 'macOS' : r.os.name;
  const os = [osName, osVersion].filter(Boolean).join(' ') || '–';
  return { browser, os };
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'region' });
  } catch {
    return null;
  }
})();

/** Nome do país em português ("BR" → "Brasil"). Código estranho (como "T1", rede Tor) fica como veio. */
export function countryName(code: string | null | undefined) {
  if (!code) return null;
  try {
    return regionNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "Cidade, Estado, País", sem as partes que faltam. */
export function placeName(v: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}) {
  return [v.city, v.region, countryName(v.country)].filter(Boolean).join(', ') || '–';
}
