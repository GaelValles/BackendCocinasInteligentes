import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const ENTERPRISE_API_BASE = 'https://recaptchaenterprise.googleapis.com/v1';
const PROJECT_ID_KEYS = ['RECAPTCHA_ENTERPRISE_PROJECT_ID', 'RECAPTCHA_PROJECT_ID', 'GOOGLE_RECAPTCHA_PROJECT_ID'];
const API_KEY_KEYS = ['RECAPTCHA_API_KEY', 'RECAPTCHA_ENTERPRISE_API_KEY', 'GOOGLE_RECAPTCHA_API_KEY'];
const SITE_KEY_KEYS = ['RECAPTCHA_SITE_KEY', 'GOOGLE_RECAPTCHA_SITE_KEY'];
const TURNSTILE_SECRET_KEYS = ['TURNSTILE_SECRET_KEY', 'CLOUDFLARE_TURNSTILE_SECRET_KEY', 'CLOUDFLARE_TURNSTILE_SECRET'];
const TURNSTILE_SITE_KEYS = ['TURNSTILE_SITE_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'CLOUDFLARE_TURNSTILE_SITE_KEY'];
const PROVIDER_KEYS = ['CAPTCHA_PROVIDER', 'RECAPTCHA_PROVIDER'];

const getEnvValue = (keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const detectCaptchaProvider = () => {
  const provider = getEnvValue(PROVIDER_KEYS).toLowerCase();
  if (provider === 'turnstile') return 'turnstile';
  if (provider === 'recaptcha' || provider === 'google') return 'recaptcha';
  if (getEnvValue(TURNSTILE_SECRET_KEYS)) return 'turnstile';
  if (getEnvValue(PROJECT_ID_KEYS) && getEnvValue(API_KEY_KEYS)) return 'recaptcha';
  return 'turnstile';
};

export const isRecaptchaConfigured = () => {
  const projectId = getEnvValue(PROJECT_ID_KEYS);
  const apiKey = getEnvValue(API_KEY_KEYS);
  return Boolean(projectId && apiKey);
};

export const verifyRecaptchaToken = async (token, options = {}) => {
  if (!token || typeof token !== 'string') {
    throw new Error('El token del captcha es requerido');
  }

  const provider = options.provider || detectCaptchaProvider();

  if (provider === 'turnstile') {
    const secretKey = options.secretKey || getEnvValue(TURNSTILE_SECRET_KEYS);
    const skipInDev = process.env.NODE_ENV !== 'production' && process.env.TURNSTILE_SKIP_IN_DEV !== 'false';

    if (!secretKey) {
      if (skipInDev) {
        return {
          success: true,
          skipped: true,
          provider: 'turnstile',
          valid: true,
          message: 'Validación de Turnstile omitida en desarrollo porque no hay secret key configurada.'
        };
      }

      return {
        success: false,
        skipped: false,
        provider: 'turnstile',
        error: 'Cloudflare Turnstile no configurado en el backend. Agrega TURNSTILE_SECRET_KEY.'
      };
    }

    const form = new URLSearchParams();
    form.append('secret', secretKey);
    form.append('response', token);
    if (options.remoteIp) form.append('remoteip', options.remoteIp);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        skipped: false,
        provider: 'turnstile',
        error: data?.error || 'No se pudo validar el token de Turnstile'
      };
    }

    return {
      success: Boolean(data?.success),
      skipped: false,
      provider: 'turnstile',
      valid: Boolean(data?.success),
      reasons: Array.isArray(data['error-codes']) ? data['error-codes'] : []
    };
  }

  const projectId = getEnvValue(PROJECT_ID_KEYS);
  const apiKey = getEnvValue(API_KEY_KEYS);
  const siteKey = options.siteKey || getEnvValue(SITE_KEY_KEYS);
  const expectedAction = options.expectedAction || options.action || 'submit';

  if (!projectId || !apiKey) {
    return {
      success: false,
      skipped: false,
      provider: 'recaptcha',
      error: 'reCAPTCHA no configurado en el backend. Agrega RECAPTCHA_ENTERPRISE_PROJECT_ID y RECAPTCHA_API_KEY.'
    };
  }

  const endpoint = `${ENTERPRISE_API_BASE}/projects/${encodeURIComponent(projectId)}:assess?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    event: {
      token,
      expectedAction,
      ...(siteKey ? { siteKey } : {})
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      success: false,
      skipped: false,
      provider: 'recaptcha',
      error: data?.error?.message || 'No se pudo validar el token de reCAPTCHA'
    };
  }

  const tokenProperties = data?.tokenProperties || {};
  const riskAnalysis = data?.riskAnalysis || {};
  const score = typeof riskAnalysis.score === 'number' ? riskAnalysis.score : null;
  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
  const actionMatches = !expectedAction || tokenProperties.action === expectedAction;
  const scoreOk = score === null || Number.isNaN(score) || score >= minScore;

  return {
    success: Boolean(tokenProperties.valid) && actionMatches && scoreOk,
    skipped: false,
    provider: 'recaptcha',
    valid: Boolean(tokenProperties.valid),
    action: tokenProperties.action || null,
    score,
    reasons: Array.isArray(riskAnalysis.reasons) ? riskAnalysis.reasons : []
  };
};
