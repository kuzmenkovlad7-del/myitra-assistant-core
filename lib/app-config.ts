// lib/app-config.ts

export const APP_NAME = "MyITRA"
export const APP_DOMAIN = "turbotaai.com"

export const APP_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || `support@${APP_DOMAIN}`

export const CONTACT_EMAIL = APP_SUPPORT_EMAIL
