#!/usr/bin/env node
import fs from "fs"
import path from "path"

const ROOT = process.cwd()

const enPath = path.join(ROOT, "lib/i18n/translations/en.ts")
const ruPath = path.join(ROOT, "lib/i18n/translations/ru.ts")
const ukPath = path.join(ROOT, "lib/i18n/translations/uk.ts")

function mustExist(p) {
  if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`)
}
function read(p) {
  return fs.readFileSync(p, "utf-8")
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf-8")
}

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function escapeForTsString(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function getProp(text, key) {
  const k = escapeForRegex(key)
  const re = new RegExp(
    `^\\s*"${k}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"\\s*,?\\s*(?:\\/\\/.*)?$`,
    "m",
  )
  const m = text.match(re)
  if (!m) return null
  return m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\")
}

function setProp(text, key, value) {
  const keyEsc = escapeForTsString(key)
  const valEsc = escapeForTsString(value)

  const re = new RegExp(
    `^(\\s*)"${escapeForRegex(key)}"(\\s*:\\s*)"((?:\\\\.|[^"\\\\])*)"(\\s*,?)`,
    "m",
  )

  // update existing
  if (re.test(text)) {
    return text.replace(re, (_all, indent, colonPart, _old, comma) => {
      return `${indent}"${keyEsc}"${colonPart}"${valEsc}"${comma}`
    })
  }

  // insert before final "}" of exported object
  const endMatch = text.match(/}\s*$/)
  if (!endMatch || endMatch.index == null) {
    throw new Error("Could not find end of translations object (missing trailing '}')")
  }
  const insertPos = endMatch.index

  let before = text.slice(0, insertPos)
  const after = text.slice(insertPos)

  const beforeTrim = before.replace(/\s*$/, "")
  const lastChar = beforeTrim[beforeTrim.length - 1]
  if (lastChar && lastChar !== "," && lastChar !== "{") {
    before = beforeTrim + ",\n"
  } else {
    before = beforeTrim + "\n"
  }

  const indentMatch = before.match(/\n(\s*)"/g)
  const indent = indentMatch
    ? indentMatch[indentMatch.length - 1].replace(/\n/g, "").replace(/"/g, "")
    : "  "

  const line = `${indent}"${keyEsc}": "${valEsc}",\n`
  return before + line + after
}

// Ровно те строки, что в rotatingTestimonials (18 карточек × text/name/role) + badge
const MANUAL = [
  // 1
  { key: "“After a week with TurbotaAI I finally slept through the night without panic thoughts.”",
    ru: "«После недели с TurbotaAI я наконец-то спала всю ночь без панических мыслей.»",
    uk: "«Після тижня з TurbotaAI я нарешті спала всю ніч без панічних думок.»" },
  { key: "Anna, 27 — product designer",
    ru: "Анна, 27 — продакт-дизайнер",
    uk: "Анна, 27 — продакт-дизайнерка" },
  { key: "Burnout after relocation & anxiety before sleep",
    ru: "Выгорание после переезда и тревога перед сном",
    uk: "Вигорання після переїзду та тривога перед сном" },

  // 2
  { key: "“Talking to a calm voice for ten minutes before stand-up is easier than pretending that everything is fine.”",
    ru: "«Поговорить десять минут со спокойным голосом перед стендапом легче, чем делать вид, что всё хорошо.»",
    uk: "«Поговорити десять хвилин зі спокійним голосом перед стендапом легше, ніж робити вигляд, що все добре.»" },
  { key: "Max, 35 — team lead in IT",
    ru: "Макс, 35 — тимлид в IT",
    uk: "Макс, 35 — тімлід в IT" },
  { key: "Panic before meetings & fear of mistakes",
    ru: "Паника перед встречами и страх ошибок",
    uk: "Паніка перед зустрічами та страх помилок" },

  // 3
  { key: "“It’s easier to write to the AI first and only then to friends — when I understand what I really feel.”",
    ru: "«Мне легче сначала написать ИИ, а уже потом друзьям — когда я понимаю, что на самом деле чувствую.»",
    uk: "«Мені легше спочатку написати ШІ, а вже потім друзям — коли я розумію, що насправді відчуваю.»" },
  { key: "Sofia, 19 — first-year student",
    ru: "София, 19 — студентка первого курса",
    uk: "Софія, 19 — студентка першого курсу" },
  { key: "Loneliness, adaptation to university & dorm life",
    ru: "Одиночество, адаптация к университету и жизни в общежитии",
    uk: "Самотність, адаптація до університету та життя в гуртожитку" },

  // 4
  { key: "“I stopped rewriting messages ten times. Now I send them — and breathe.”",
    ru: "«Я перестал переписывать сообщения десять раз. Теперь я их отправляю — и дышу.»",
    uk: "«Я перестав переписувати повідомлення десять разів. Тепер я їх надсилаю — і дихаю.»" },
  { key: "Dmytro, 28 — marketing specialist",
    ru: "Дмитрий, 28 — маркетолог",
    uk: "Дмитро, 28 — маркетолог" },
  { key: "Social anxiety & perfectionism",
    ru: "Социальная тревожность и перфекционизм",
    uk: "Соціальна тривожність та перфекціонізм" },

  // 5
  { key: "“When the panic starts, I have a 3-minute grounding routine that actually works.”",
    ru: "«Когда начинается паника, у меня есть 3-минутная техника заземления, которая реально работает.»",
    uk: "«Коли починається паніка, у мене є 3-хвилинна техніка заземлення, яка реально працює.»" },
  { key: "Iryna, 32 — entrepreneur",
    ru: "Ирина, 32 — предприниматель",
    uk: "Ірина, 32 — підприємиця" },
  { key: "Panic episodes & body sensations",
    ru: "Панические эпизоды и телесные ощущения",
    uk: "Панічні епізоди та тілесні відчуття" },

  // 6
  { key: "“I learned to name the feeling first — and only then decide what to do.”",
    ru: "«Я научилась сначала называть чувство — и только потом решать, что делать.»",
    uk: "«Я навчилася спершу називати почуття — і лише потім вирішувати, що робити.»" },
  { key: "Kateryna, 29 — teacher",
    ru: "Екатерина, 29 — преподаватель",
    uk: "Катерина, 29 — викладачка" },
  { key: "Overwhelm & emotional regulation",
    ru: "Перегруз и эмоциональная регуляция",
    uk: "Перевантаження та емоційна регуляція" },

  // 7
  { key: "“A short evening check-in helped me stop scrolling and go to sleep earlier.”",
    ru: "«Короткая вечерняя проверка помогла мне перестать листать ленту и ложиться спать раньше.»",
    uk: "«Коротка вечірня перевірка допомогла мені перестати скролити й лягати спати раніше.»" },
  { key: "Andrii, 41 — operations manager",
    ru: "Андрей, 41 — менеджер по операциям",
    uk: "Андрій, 41 — менеджер з операцій" },
  { key: "Stress, insomnia & constant tension",
    ru: "Стресс, бессонница и постоянное напряжение",
    uk: "Стрес, безсоння та постійна напруга" },

  // 8
  { key: "“I didn’t need a perfect plan. I needed one small next step — and I got it.”",
    ru: "«Мне не нужен был идеальный план. Мне нужен был один маленький следующий шаг — и я его получила.»",
    uk: "«Мені не потрібен був ідеальний план. Мені потрібен був один маленький наступний крок — і я його отримала.»" },
  { key: "Oksana, 24 — junior designer",
    ru: "Оксана, 24 — младший дизайнер",
    uk: "Оксана, 24 — молодша дизайнерка" },
  { key: "Self-doubt & job search",
    ru: "Неуверенность в себе и поиск работы",
    uk: "Невпевненість у собі та пошук роботи" },

  // 9
  { key: "“Instead of catastrophizing, I wrote down facts. The fear got smaller.”",
    ru: "«Вместо катастрофизации я записал факты. Страх стал меньше.»",
    uk: "«Замість катастрофізації я записав факти. Страх став меншим.»" },
  { key: "Artem, 22 — student",
    ru: "Артём, 22 — студент",
    uk: "Артем, 22 — студент" },
  { key: "Overthinking & exam anxiety",
    ru: "Навязчивые мысли и тревога перед экзаменами",
    uk: "Надмірні думки та тривога перед іспитами" },

  // 10
  { key: "“I can finally say ‘I need time to think’ without freezing.”",
    ru: "«Я наконец-то могу сказать: “Мне нужно время подумать” — и не замирать.»",
    uk: "«Я нарешті можу сказати: “Мені потрібен час подумати” — і не завмирати.»" },
  { key: "Yulia, 30 — QA engineer",
    ru: "Юлия, 30 — QA-инженер",
    uk: "Юлія, 30 — QA-інженерка" },
  { key: "Fear of mistakes & pressure at work",
    ru: "Страх ошибок и давление на работе",
    uk: "Страх помилок та тиск на роботі" },

  // 11
  { key: "“Before talking to family, I talk here — and it becomes easier.”",
    ru: "«Перед разговором с семьёй я сначала говорю здесь — и становится легче.»",
    uk: "«Перед розмовою з родиною я спершу говорю тут — і стає легше.»" },
  { key: "Natalia, 37 — HR",
    ru: "Наталья, 37 — HR",
    uk: "Наталія, 37 — HR" },
  { key: "Relationship stress & boundaries",
    ru: "Стресс в отношениях и личные границы",
    uk: "Стрес у стосунках та межі" },

  // 12
  { key: "“I stopped avoiding tough conversations. I started preparing calmly.”",
    ru: "«Я перестал избегать сложных разговоров. Я начал готовиться спокойно.»",
    uk: "«Я перестав уникати складних розмов. Я почав готуватися спокійно.»" },
  { key: "Bohdan, 26 — founder",
    ru: "Богдан, 26 — основатель",
    uk: "Богдан, 26 — засновник" },
  { key: "Decision fatigue & burnout risk",
    ru: "Усталость от решений и риск выгорания",
    uk: "Втома від рішень та ризик вигорання" },

  // 13
  { key: "“The breathing + grounding combo saved me on days when everything felt ‘too much’.”",
    ru: "«Дыхание + заземление спасли меня в дни, когда всё казалось “слишком”.»",
    uk: "«Комбо “дихання + заземлення” рятувало мене в дні, коли все здавалося “надто”.»" },
  { key: "Viktoriia, 31 — project manager",
    ru: "Виктория, 31 — проект-менеджер",
    uk: "Вікторія, 31 — проджект-менеджерка" },
  { key: "Anxiety spikes & overload",
    ru: "Всплески тревоги и перегруз",
    uk: "Сплески тривоги та перевантаження" },

  // 14
  { key: "“I don’t chase motivation anymore. I follow a simple routine — and it helps.”",
    ru: "«Я больше не гонюсь за мотивацией. Я следую простой рутине — и это помогает.»",
    uk: "«Я більше не женуся за мотивацією. Я тримаюся простої рутини — і це допомагає.»" },
  { key: "Svitlana, 33 — analyst",
    ru: "Светлана, 33 — аналитик",
    uk: "Світлана, 33 — аналітикиня" },
  { key: "Low energy & procrastination",
    ru: "Низкая энергия и прокрастинация",
    uk: "Низька енергія та прокрастинація" },

  // 15
  { key: "“I stopped blaming myself for stress. I started supporting myself.”",
    ru: "«Я перестала винить себя за стресс. Я начала поддерживать себя.»",
    uk: "«Я перестала звинувачувати себе за стрес. Я почала підтримувати себе.»" },
  { key: "Olena, 27 — customer support",
    ru: "Елена, 27 — специалист поддержки",
    uk: "Олена, 27 — фахівчиня підтримки" },
  { key: "Burnout & self-criticism",
    ru: "Выгорание и самокритика",
    uk: "Вигорання та самокритика" },

  // 16
  { key: "“Ten minutes of voice support before bed — and my sleep got deeper.”",
    ru: "«Десять минут голосовой поддержки перед сном — и сон стал глубже.»",
    uk: "«Десять хвилин голосової підтримки перед сном — і сон став глибшим.»" },
  { key: "Roman, 39 — engineer",
    ru: "Роман, 39 — инженер",
    uk: "Роман, 39 — інженер" },
  { key: "Sleep issues & rumination",
    ru: "Проблемы со сном и навязчивые размышления",
    uk: "Проблеми зі сном та нав’язливі роздуми" },

  // 17
  { key: "“I learned to separate thoughts from facts. That alone changed a lot.”",
    ru: "«Я научился отделять мысли от фактов. Уже одно это многое изменило.»",
    uk: "«Я навчився відокремлювати думки від фактів. Уже саме це багато що змінило.»" },
  { key: "Ihor, 34 — product lead",
    ru: "Игорь, 34 — руководитель продукта",
    uk: "Ігор, 34 — керівник продукту" },
  { key: "Work stress & perfectionism",
    ru: "Стресс на работе и перфекционизм",
    uk: "Стрес на роботі та перфекціонізм" },

  // 18
  { key: "“The hardest part was starting. The assistant made it feel safe.”",
    ru: "«Самым сложным было начать. С ассистентом это ощущалось безопасно.»",
    uk: "«Найважче було почати. З асистентом це відчувалося безпечно.»" },
  { key: "Marta, 25 — trainee",
    ru: "Марта, 25 — стажёр",
    uk: "Марта, 25 — стажер" },
  { key: "First steps in therapy & anxiety",
    ru: "Первые шаги в терапии и тревога",
    uk: "Перші кроки в терапії та тривога" },

  // badge
  { key: "Real experiences from beta users",
    ru: "Реальный опыт пользователей",
    uk: "Реальний досвід користувачів" },
]

function main() {
  mustExist(enPath); mustExist(ruPath); mustExist(ukPath)

  let enText = read(enPath)
  let ruText = read(ruPath)
  let ukText = read(ukPath)

  let enAdded = 0
  let ruSet = 0
  let ukSet = 0

  for (const item of MANUAL) {
    if (getProp(enText, item.key) == null) {
      enText = setProp(enText, item.key, item.key)
      enAdded++
    }
    ruText = setProp(ruText, item.key, item.ru); ruSet++
    ukText = setProp(ukText, item.key, item.uk); ukSet++
  }

  // стабилизируем текст бейджа в EN (как ты хотел)
  enText = setProp(enText, "Real experiences from beta users", "Real experiences from users")

  write(enPath, enText)
  write(ruPath, ruText)
  write(ukPath, ukText)

  console.log(`[done] i18n patched (manual): EN add=${enAdded}, RU set=${ruSet}, UK set=${ukSet}`)
}

main()
