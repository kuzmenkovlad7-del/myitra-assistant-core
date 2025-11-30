// lib/i18n/translations/uk.ts
import { en } from "./en"

export const uk: Record<string, string> = {
  // Базово берём все ключи из en, чтобы ничего не ломалось
  ...en,

  // ─────────────────────
  // Навигация и меню
  // ─────────────────────
  Home: "Головна",
  About: "Про сервіс",
  Services: "Послуги",
  Pricing: "Тарифи",
  Contact: "Контакти",
  "Sign In": "Увійти",
  "Sign Up": "Створити акаунт",
  "Create an Account": "Створити акаунт",
  "Log In": "Увійти",

  "nav.home": "Головна",
  "nav.programs": "Програми",
  "nav.clientStories": "Історії клієнтів",
  "nav.contacts": "Контакти",
  "nav.privacyPolicy": "Політика конфіденційності",
  "nav.termsOfUse": "Умови користування",

  // ─────────────────────
  // Hero TurbotaAI (верх главной)
  // ─────────────────────
  "AI-psychologist nearby 24/7": "AI-психолог поруч 24/7",
  "Psychological support when it feels hard, powered by AI":
    "Психологічна підтримка, коли важко, з підсиленням ШІ",
  "TurbotaAI listens without judgement, asks clarifying questions and gently guides you through breathing, grounding and simple exercises based on psychological books. In chat, voice or video — when you feel anxious, exhausted or alone.":
    "TurbotaAI слухає без осуду, ставить мʼякі уточнювальні запитання та мʼяко проводить через дихальні вправи, ґраундинг і прості практики з психологічних книжок. У чаті, голосом чи по відео — коли тривожно, виснажено або самотньо.",
  "Start for free": "Почати безкоштовно",
  "How it works": "Як це працює",

  "When it feels bad right now": "Коли погано просто зараз",
  "Anxiety, stress & burnout": "Тривога, стрес та вигорання",
  "7–21 day support programs": "Підтримувальні програми на 7–21 день",

  "3 assistant modes · chat · voice · video":
    "3 режими асистента · чат · голос · відео",
  "Choose how it's more comfortable for you to talk.":
    "Обирайте формат, у якому вам комфортніше говорити.",

  // Старый блок Myitra — оставляем, но адаптированно
  "Myitra Platform · AI + Psychology": "Платформа Myitra · ШІ + психологія",
  "Live Psychological Support,": "Жива психологічна підтримка,",
  "AI-Enhanced": "посилена ШІ",
  "Licensed psychologists supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "Ліцензовані психологи, яких підсилюють AI-асистенти. Ми допомагаємо збирати історію, вести щоденники та нагадувати про сесії.",
  "Talk Now": "Поговорити зараз",
  "View Services": "Переглянути послуги",
  "AI Chat 24/7": "AI-чат 24/7",
  "Voice Calls": "Голосові дзвінки",
  "Video Sessions": "Відеосесії",
  "Myitra Psychology Session": "Психологічна сесія Myitra",
  "3 Assistant Modes": "3 режими асистента",
  "chat · voice · video": "чат · голос · відео",

  // ─────────────────────
  // Home: блок с тремя форматами общения
  // ─────────────────────
  "Choose how you want to talk": "Обирайте, як вам зручніше говорити",
  "How would you like to contact us?": "Як вам зручніше вийти на звʼязок?",
  "Start with a quick chat, a voice call or a video session with our AI-psychologist — choose the format that feels safest right now.":
    "Почніть із швидкого чату, голосового дзвінка або відеосесії з AI-психологом — оберіть формат, який зараз відчувається найбезпечнішим.",

  "Chat with AI-psychologist": "Чат із AI-психологом",
  "Write what is happening in your own words and get structured support in a few minutes.":
    "Опишіть, що з вами відбувається, своїми словами й отримайте структуровану підтримку за кілька хвилин.",
  "Best when you need privacy and want to stay silent around other people.":
    "Найкращий формат, коли потрібна приватність і не хочеться говорити вголос поруч з іншими.",
  "You can return to the conversation history and exercises at any time.":
    "У будь-який момент можна повернутися до історії діалогу та вправ.",
  "Start chat": "Почати чат",

  "Call AI-psychologist": "Подзвонити AI-психологу",
  "Voice format for more lively support when you want to hear a calm voice.":
    "Голосовий формат для живішої підтримки, коли хочеться почути спокійний голос.",
  "Helps reduce the feeling of loneliness in difficult moments.":
    "Допомагає зменшити відчуття самотності у складні моменти.",
  "Suitable when emotions are strong and you need to speak out quickly.":
    "Підходить, коли емоції дуже сильні й потрібно швидко виговоритися.",
  "Start voice call": "Почати голосовий дзвінок",

  "Video session with AI": "Відеосесія з AI",
  "Face-to-face session with a 3D-avatar when you want to feel presence and eye contact.":
    "Сесія «обличчям до обличчя» з 3D-аватаром, коли важливо відчути присутність та зоровий контакт.",
  "Gives a stronger feeling that someone is really next to you.":
    "Дарує сильніше відчуття, що поряд справді є хтось, хто підтримує.",
  "Best for deeper work, body reactions and long-term processes.":
    "Найкраще підходить для глибшої роботи, тілесних реакцій і довготривалих процесів.",
  "Start video call": "Почати відеодзвінок",

  "Not sure which format? Start with a safe chat":
    "Не впевнені, з чого почати? Спробуйте спершу безпечний чат",

  "Your browser may not fully support voice features. For the best experience, please use Chrome, Edge, or Safari.":
    "Ваш браузер може некоректно підтримувати голосові функції. Для найкращої роботи спробуйте Chrome, Edge або Safari.",
  "Your browser may not fully support video features. For the best experience, please use Chrome, Edge, or Safari.":
    "Ваш браузер може некоректно підтримувати відеофункції. Для найкращої роботи спробуйте Chrome, Edge або Safari.",

  "There was an issue with the voice call. Please try again.":
    "Сталася помилка під час голосового дзвінка. Будь ласка, спробуйте ще раз.",
  "There was an issue with the video call. Please try again.":
    "Сталася помилка під час відеодзвінка. Будь ласка, спробуйте ще раз.",

  // ─────────────────────
  // Блок преимуществ (ServiceFeatures)
  // ─────────────────────
  "Support in minutes when it feels really bad":
    "Підтримка за лічені хвилини, коли справді дуже погано",
  "Open chat, voice or video exactly when it feels bad right now — без очередей, анкет и ожидания записи.":
    "Відкрийте чат, голос або відео саме в той момент, коли погано прямо зараз — без черг, анкет і очікування запису.",
  "Feels like a calm, respectful human conversation":
    "Відчувається як спокійна, поважна розмова з людиною",
  "Ассистент сначала слушает и задаёт мягкие уточняющие вопросы, а уже потом предлагает короткие упражнения и шаги.":
    "Асистент спершу уважно слухає й ставить мʼякі уточнювальні запитання, а вже потім пропонує короткі вправи та наступні кроки.",
  "Works in 10+ languages": "Працює більш ніж 10 мовами",
  "Украинский, русский, английский и другие популярные языки. Язык можно менять прямо во время диалога.":
    "Українська, російська, англійська та інші популярні мови. Мову можна переключати прямо під час розмови.",
  "From quick help to 7–21 day programs":
    "Від швидкої допомоги до програм на 7–21 день",
  "Готовые сценарии: «когда плохо прямо сейчас», работа с тревогой и стрессом, а также мягкие программы на 7–21 день с регулярными чек-инами.":
    "Готові сценарії: «коли погано просто зараз», робота з тривогою та стресом, а також мʼякі програми на 7–21 день із регулярними чек-інами.",
  "Safe and confidential space": "Безпечний і конфіденційний простір",
  "Разговоры шифруются и не используются для рекламы. Вы сами решаете, что рассказывать и когда удалять историю.":
    "Розмови шифруються й не використовуються для реклами. Ви самі вирішуєте, що розповідати й коли видаляти історію.",
  "Simple pricing with a free start":
    "Просте ціноутворення з безкоштовним стартом",
  "На запуске: тестовый период и несколько бесплатных вопросов. Затем — прозрачные тарифы без скрытых платежей: разовый доступ и помесячная подписка.":
    "На старті — тестовий період і кілька безкоштовних запитань. Далі — прозорі тарифи без прихованих платежів: разові сесії та помісячна підписка.",

  "Why people choose TurbotaAI": "Чому люди обирають TurbotaAI",
  "TurbotaAI is built for moments when you have no strength to search for a therapist or wait for an appointment, but really need someone to talk to right now.":
    "TurbotaAI створена для моментів, коли немає сил шукати терапевта чи чекати запису, але дуже потрібно з кимось поговорити прямо зараз.",

  // ─────────────────────
  // Контактный блок / страница
  // ─────────────────────
  "Contact Us": "Звʼяжіться з нами",
  "Contact Page Description":
    "Напишіть нам, якщо потрібна підтримка, консультація або хочете обговорити співпрацю.",
  "Have questions or need assistance? Reach out to our support team and we'll get back to you as soon as possible.":
    "Є запитання чи потрібна допомога? Напишіть нашій команді підтримки — ми відповімо якнайшвидше.",

  "Average reply": "Середній час відповіді",
  "within 24 hours": "до 24 годин",
  "Privacy": "Приватність",
  "encrypted conversations": "зашифровані розмови",

  "Email us": "Напишіть нам на email",
  "All questions about the service, payments, access to the assistant or cooperation — please write to this address.":
    "Усі питання щодо сервісу, оплати, доступу до асистента чи співпраці — будь ласка, пишіть на цю адресу.",

  "Support, partnerships and press": "Підтримка, партнерства та преса",
  "Contact TurbotaAI team": "Звʼяжіться з командою TurbotaAI",
  "Have questions about how the AI-psychologist works, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.":
    "Є запитання про роботу AI-психолога, хочете обговорити партнерство чи потрібна допомога з акаунтом? Залиште заявку — ми відповімо якнайшвидше.",

  "For urgent situations, please contact local emergency services or a crisis line in your country. TurbotaAI is not a substitute for emergency medical help.":
    "В екстрених ситуаціях звертайтеся до місцевих служб порятунку або на кризову лінію вашої країни. TurbotaAI не є заміною невідкладної медичної допомоги.",

  "Send us a message": "Надішліть нам повідомлення",
  "Send Message": "Надіслати повідомлення",

  "Your Name": "Ваше імʼя",
  "Email Address": "Електронна пошта",
  Subject: "Тема",
  "Your Message": "Ваше повідомлення",
  "Message is required": "Потрібно ввести повідомлення",
  "Message must be at least 10 characters":
    "Повідомлення має містити щонайменше 10 символів",
  "Thank you for your message!": "Дякуємо за повідомлення!",
  "We've received your inquiry and will get back to you as soon as possible.":
    "Ми отримали ваше звернення й відповімо найближчим часом.",

  // ─────────────────────
  // Футер и дисклеймер
  // ─────────────────────
  "AI Psychological Support": "AI-психологічна підтримка",
  "Professional, scalable, and aesthetically pleasing online service that utilizes AI to deliver quality psychological care.":
    "Професійний, масштабований та естетичний онлайн-сервіс, який використовує ШІ для якісної психологічної допомоги.",
  "Psychological support based on AI for everyday emotional difficulties.":
    "Психологічна підтримка на основі ШІ для щоденних емоційних труднощів.",

  "Quick Links": "Швидкі посилання",
  Legal: "Юридична інформація",
  "Terms of Service": "Умови надання послуг",
  "Privacy Policy": "Політика конфіденційності",
  "Terms of Use": "Умови користування",

  "This is not an emergency service":
    "Це не сервіс екстреної допомоги",
  "TurbotaAI is not a replacement for a licensed psychologist or psychiatrist.":
    "TurbotaAI не замінює консультації ліцензованого психолога чи психіатра.",
  "If you are in immediate danger, contact emergency services or a crisis hotline in your country.":
    "Якщо ви в небезпеці — зверніться до екстрених служб або на кризову лінію у вашій країні.",

  "All rights reserved": "Усі права захищено",

  // ─────────────────────
  // Программы / истории (из старого файла — адаптировано)
  // ─────────────────────
  "Our Programs": "Наші програми",
  "Programs Page Description":
    "Обирайте програму, яка відповідає вашому запиту та формату підтримки.",
  "Single Session": "Разова сесія",
  "Monthly Subscription": "Місячна підписка",
  "Corporate Program": "Корпоративна програма",
  "Program Price - Single": "$49",
  "Program Price - Monthly": "$149/міс",
  "Program Price - Corporate": "За запитом",
  "Choose Program": "Обрати програму",

  "Stories Page Description":
    "Реальні відгуки людей, які отримали підтримку через Myitra.",
  "Story 1 Name": "Анна М.",
  "Story 1 Text":
    "Myitra допомогла мені пройти складний період. AI-психолог завжди був доступний, коли мені потрібна була підтримка.",
  "Story 2 Name": "Олена К.",
  "Story 2 Text":
    "Поєднання професійної психології та технологій ШІ вражає. Я відчуваю, що мене чують і розуміють.",
  "Story 3 Name": "Дмитро С.",
  "Story 3 Text":
    "Корпоративна програма змінила підхід нашої команди до ментального здоровʼя. Дуже рекомендую!",
}
