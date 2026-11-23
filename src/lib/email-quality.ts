/**
 * Nexx email quality adapter for the self-hosted Umut Erturk validator.
 * Quality checks DO NOT prove mailbox ownership. OAuth/email confirmation remains authoritative.
 * The endpoint is server-controlled; never send user email to a third-party demo by default.
 */
export type EmailQualityResult = {
  state: 'accept' | 'reject' | 'review' | 'unchecked';
  reason: 'valid' | 'invalid_format' | 'disposable' | 'domain_unconfirmed' |
    'unconfigured' | 'invalid_endpoint' | 'provider_unavailable' | 'unrecognized_response';
  suggestion?: string;
};

type ValidatorResponse = {
  email?: unknown;
  status?: unknown;
  typoSuggestion?: unknown;
  validations?: { syntax?: unknown; is_disposable?: unknown };
};

type Options = {
  endpoint?: string;
  token?: string;
  fetcher?: typeof fetch;
};

const unchecked = (reason: EmailQualityResult['reason']): EmailQualityResult =>
  ({ state: 'unchecked', reason });

export async function assessEmailQuality(email: string, options: Options = {}): Promise<EmailQualityResult> {
  const endpoint = options.endpoint ?? process.env.NEXX_EMAIL_VALIDATOR_URL;
  if (!endpoint) return unchecked('unconfigured');

  let url: URL;
  try {
    url = new URL(endpoint);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.pathname !== '/api/validate' || url.search || url.hash || url.username || url.password) {
      return unchecked('invalid_endpoint');
    }
  } catch {
    return unchecked('invalid_endpoint');
  }

  const token = options.token ?? process.env.NEXX_EMAIL_VALIDATOR_TOKEN;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let data: ValidatorResponse;
  try {
    const response = await (options.fetcher ?? fetch)(url.toString(), {
      method: 'POST', headers, body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(2500), cache: 'no-store', redirect: 'error',
    });
    if (!response.ok) return unchecked('provider_unavailable');
    data = await response.json() as ValidatorResponse;
  } catch {
    return unchecked('provider_unavailable');
  }

  if (!data || typeof data !== 'object' ||
      typeof data.email !== 'string' || data.email.toLowerCase() !== email.toLowerCase() ||
      typeof data.status !== 'string' || !data.validations ||
      typeof data.validations.syntax !== 'boolean' ||
      typeof data.validations.is_disposable !== 'boolean') {
    return unchecked('unrecognized_response');
  }

  const suggestion = typeof data.typoSuggestion === 'string' &&
    data.typoSuggestion.length <= 254 ? data.typoSuggestion : undefined;

  if (!data.validations.syntax || data.status === 'INVALID_FORMAT') {
    return { state: 'reject', reason: 'invalid_format', suggestion };
  }
  if (data.validations.is_disposable || data.status === 'DISPOSABLE') {
    return { state: 'reject', reason: 'disposable', suggestion };
  }
  // NXDOMAIN, null MX and remote DNS outages can be indistinguishable.
  // Review rather than deny access. Never interpret mailbox_exists as identity proof.
  if (['INVALID_DOMAIN', 'NO_MX_RECORDS', 'INVALID'].includes(data.status)) {
    return { state: 'review', reason: 'domain_unconfirmed', suggestion };
  }
  if (data.status === 'VALID' || data.status === 'PROBABLY_VALID') {
    return { state: 'accept', reason: 'valid', suggestion };
  }
  return unchecked('unrecognized_response');
}
