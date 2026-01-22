import fs from "fs"
import path from "path"

const root = process.cwd()

function patchValueOnly(fileRel, key, newValue) {
  const file = path.join(root, fileRel)
  let t = fs.readFileSync(file, "utf8")
  const re = new RegExp(`(^\\s*"${escapeRegExp(key)}"\\s*:\\s*")(.*?)(",\\s*$)`, "m")
  const m = t.match(re)
  if (!m) return false
  t = t.replace(re, `$1${newValue.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}$3`)
  fs.writeFileSync(file, t, "utf8")
  return true
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const uk = "lib/i18n/translations/uk.ts"
const ru = "lib/i18n/translations/ru.ts"

const UK = {
  "AI assistant is temporarily unavailable. Please try again a bit later.": "AI асистент тимчасово недоступний. Спробуйте, будь ласка, трохи пізніше.",
  "AI specialist Video Call": "Відеодзвінок з AI співрозмовником",
  "Already have an account?": "Вже маєте акаунт?",
  "Choose an AI specialist and press “Start video call” to begin.": "Оберіть AI співрозмовника та натисніть «Почати відеодзвінок», щоб розпочати.",
  "Choose Your AI specialist": "Обирайте свого AI співрозмовника",
  "Connecting": "Підключення",
  "Connecting...": "Підключення...",
  "Connection error. Please try again.": "Помилка з’єднання. Спробуйте ще раз.",
  "Create account": "Створити акаунт",
  "Creating account...": "Створюємо акаунт...",
  "Enter your credentials": "Введіть дані для входу",
  "Failed to start the call. Please check your microphone and camera permissions.": "Не вдалося розпочати дзвінок. Перевірте доступ до мікрофона та камери.",
  "Full name (optional)": "Ім’я та прізвище (необов’язково)",
  "Loading...": "Завантаження...",
  "Microphone is not available.": "Мікрофон недоступний.",
  "Password": "Пароль",
  "Passwords do not match": "Паролі не збігаються",
  "Profile": "Профіль",
  "Register to save your sessions and preferences.": "Зареєструйтеся, щоб зберігати сесії та налаштування.",
  "Repeat password": "Повторіть пароль",
  "Select Language": "Обрати мову",
  "Sending": "Надсилаємо",
  "Sign in to continue": "Увійдіть, щоб продовжити",
  "Sign Out": "Вийти",
  "Signing in...": "Вхід...",
  "Welcome Back": "З поверненням",
  "Your browser does not support voice recording. Please use Chrome or another modern browser.": "Ваш браузер не підтримує запис голосу. Будь ласка, використайте Chrome або інший сучасний браузер."
}

const RU = {
  "AI assistant is temporarily unavailable. Please try again a bit later.": "AI ассистент временно недоступен. Попробуйте чуть позже.",
  "AI specialist Video Call": "Видеозвонок с AI-собеседником",
  "Already have an account?": "Уже есть аккаунт?",
  "Choose an AI specialist and press “Start video call” to begin.": "Выберите AI-собеседника и нажмите «Начать видеозвонок», чтобы начать.",
  "Choose Your AI specialist": "Выберите своего AI-собеседника",
  "Connecting": "Подключение",
  "Connecting...": "Подключение...",
  "Connection error. Please try again.": "Ошибка соединения. Попробуйте ещё раз.",
  "Create account": "Создать аккаунт",
  "Creating account...": "Создаём аккаунт...",
  "Enter your credentials": "Введите данные для входа",
  "Failed to start the call. Please check your microphone and camera permissions.": "Не удалось начать звонок. Проверьте доступ к микрофону и камере.",
  "Full name (optional)": "Полное имя (необязательно)",
  "Loading...": "Загрузка...",
  "Microphone is not available.": "Микрофон недоступен.",
  "Password": "Пароль",
  "Passwords do not match": "Пароли не совпадают",
  "Profile": "Профиль",
  "Register to save your sessions and preferences.": "Зарегистрируйтесь, чтобы сохранять сессии и настройки.",
  "Repeat password": "Повторите пароль",
  "Select Language": "Выбрать язык",
  "Sending": "Отправляем",
  "Sign in to continue": "Войдите, чтобы продолжить",
  "Sign Out": "Выйти",
  "Signing in...": "Вход...",
  "Welcome Back": "С возвращением",
  "Your browser does not support voice recording. Please use Chrome or another modern browser.": "Ваш браузер не поддерживает запись голоса. Используйте Chrome или другой современный браузер."
}

let okUK = 0, okRU = 0

for (const [k, v] of Object.entries(UK)) {
  if (patchValueOnly(uk, k, v)) okUK++
}
for (const [k, v] of Object.entries(RU)) {
  if (patchValueOnly(ru, k, v)) okRU++
}

console.log("OK: patched UK =", okUK, "keys")
console.log("OK: patched RU =", okRU, "keys")
