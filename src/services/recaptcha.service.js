import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const ENTERPRISE_API_BASE = 'https://recaptchaenterprise.googleapis.com/v1';
const PROJECT_ID_KEYS = ['RECAPTCHA_ENTERPRISE_PROJECT_ID', 'RECAPTCHA_PROJECT_ID', 'GOOGLE_RECAPTCHA_PROJECT_ID'];
const API_KEY_KEYS = ['RECAPTCHA_API_KEY', 'RECAPTCHA_ENTERPRISE_API_KEY', 'GOOGLE_RECAPTCHA_API_KEY'];
const SITE_KEY_KEYS = ['RECAPTCHA_SITE_KEY', 'GOOGLE_RECAPTCHA_SITE_KEY'];

const getEnvValue = (keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const isRecaptchaConfigured = () => {
  const projectId = getEnvValue(PROJECT_ID_KEYS);
  const apiKey = getEnvValue(API_KEY_KEYS);
  return Boolean(projectId && apiKey);
};

export const verifyRecaptchaToken = async (token, options = {}) => {
  if (!token || typeof token !== 'string') {
    throw new Error('El token de reCAPTCHA es requerido');
  }

  const projectId = getEnvValue(PROJECT_ID_KEYS);
  const apiKey = getEnvValue(API_KEY_KEYS);
  const siteKey = options.siteKey || getEnvValue(SITE_KEY_KEYS);
  const expectedAction = options.expectedAction || options.action || 'submit';

  if (!projectId || !apiKey) {
    return {
      success: false,
      skipped: false,
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
    valid: Boolean(tokenProperties.valid),
    action: tokenProperties.action || null,
    score,
    reasons: Array.isArray(riskAnalysis.reasons) ? riskAnalysis.reasons : []
  };
};
