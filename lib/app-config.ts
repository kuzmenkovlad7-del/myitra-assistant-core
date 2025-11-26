// myitra-assistant-core/lib/app-config.ts

export const SITE_NAME = 'TurbotaAI'

// основной e-mail проекта
export const SUPPORT_EMAIL = 'support@turbotaai.com'

// язык по умолчанию
export const DEFAULT_LOCALE = 'uk' as const

export const CONTACT_EMAIL_TO =
  process.env.MAIL_TO || SUPPORT_EMAIL

export const CONTACT_EMAIL_FROM =
  process.env.MAIL_FROM || `TurbotaAI <${SUPPORT_EMAIL}>`

// сюда можно будет добавлять настройки тарифов, ссылок и т.п.
export const APP_LINKS = {
  privacy: '/privacy-policy',
  terms: '/terms-of-use',
  contacts: '/contacts',
}
