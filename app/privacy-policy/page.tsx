"use client"

import { useLanguage } from "@/lib/i18n/language-context"

export default function PrivacyPolicyPage() {
  const { t, language } = useLanguage()
  const isUk = language === "uk"

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto bg-card rounded-3xl shadow-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8 text-foreground">
          {t("Privacy Policy")}
        </h1>

        <p className="text-sm text-muted-foreground mb-8">
          {t("Last Updated: November 2025")}
        </p>

        <div className="space-y-8 text-muted-foreground">
          {/* 1. Information we collect */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Information We Collect")}
            </h2>

            <div className="space-y-6">
              {/* Personal info */}
              <div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  {t("Personal Information")}
                </h3>
                <p>
                  {isUk
                    ? "Коли ви створюєте обліковий запис, ми збираємо ваше ім’я, електронну адресу та облікові дані для входу. Ця інформація потрібна, щоб надавати послуги TurbotaAI та підтримувати безпеку вашого акаунта."
                    : "When you create an account, we collect your name, email address, and authentication credentials. This information is necessary to provide our services and maintain your account security."}
                </p>
              </div>

              {/* Session data */}
              <div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  {t("Session Data")}
                </h3>
                <p>
                  {isUk
                    ? "Під час взаємодії з нашим AI-психологом ми можемо збирати текстові діалоги, голосові записи (якщо ви використовуєте голосові або відеофункції) та технічні метадані сесій — тривалість, час початку та завершення, базову інформацію про формат сесії. Це допомагає підтримувати якість сервісу, аналізувати навантаження та покращувати сценарії підтримки."
                    : "During your interactions with our AI psychologist, we may collect text conversations, voice recordings (when you use voice or video features), and basic session metadata such as duration, start and end time, and the format of the session. This helps us maintain service quality, analyze load, and improve our support scenarios."}
                </p>
              </div>

              {/* Technical info */}
              <div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  {t("Technical Information")}
                </h3>
                <p>
                  {isUk
                    ? "Ми автоматично збираємо технічні дані: тип пристрою та браузера, IP-адресу, мову інтерфейсу, приблизне місцезнаходження (на рівні міста чи країни), файли cookies та інші ідентифікатори сеансу. Ці дані потрібні, щоб захищати платформу від зловживань і забезпечувати коректну роботу сервісу."
                    : "We automatically collect technical data such as device type and browser, IP address, interface language, approximate location (on a city or country level), cookies and other session identifiers. This information is necessary to protect the platform from abuse and ensure that the service works correctly."}
                </p>
              </div>
            </div>
          </section>

          {/* 2. How we use your information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("How We Use Your Information")}
            </h2>
            <p className="mb-4">
              {isUk
                ? "Ми використовуємо зібрану інформацію тільки для роботи сервісу та його розвитку. Зокрема:"
                : "We use the information we collect solely to operate and improve the Service. In particular, we use it for:"}
            </p>

            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                {isUk
                  ? "надання персоналізованої психологічної підтримки за допомогою ШІ відповідно до вашого запиту;"
                  : "Providing personalized AI-based psychological support tailored to your needs;"}
              </li>
              <li>
                {isUk
                  ? "збереження історії діалогів та вправ (якщо це дозволено налаштуваннями), щоб підтримувати безперервність між сесіями;"
                  : "Maintaining conversation history and exercises (where enabled) so that you can continue your work between sessions;"}
              </li>
              <li>
                {isUk
                  ? "аналізу в агрегованому та знеособленому вигляді для покращення якості моделей, сценаріїв та інтерфейсу;"
                  : "Analyzing data in aggregated and de-identified form to improve our models, scenarios, and product experience;"}
              </li>
              <li>
                {isUk
                  ? "надсилання сервісних повідомлень: оновлення, попередження про безпеку, важливі зміни умов та політик;"
                  : "Sending service-related messages such as updates, security alerts, and important changes to our terms and policies;"}
              </li>
              <li>
                {isUk
                  ? "забезпечення безпеки платформи, виявлення шахрайських дій та технічних збоїв."
                  : "Ensuring platform security, detecting fraudulent activity, and investigating technical incidents."}
              </li>
            </ul>
          </section>

          {/* 3. Data security */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Data Security")}
            </h2>
            <p>
              {isUk
                ? "Ми застосовуємо технічні, адміністративні та організаційні заходи безпеки, щоб захистити ваші дані від несанкціонованого доступу, втрати, зловживання чи розголошення. Доступ до персональної інформації мають лише обмежені члени команди та підрядники, яким це потрібно для роботи сервісу."
                : "We use technical, administrative, and organizational safeguards to protect your data from unauthorized access, loss, misuse, or disclosure. Only a limited number of team members and trusted contractors have access to personal information, and only where it is necessary to operate the Service."}
            </p>
            <p className="mt-4">
              {isUk
                ? "Жодна онлайн-платформа не може гарантувати абсолютну безпеку. Ми оперативно реагуємо на інциденти, повідомляємо користувачів у разі серйозних витоків даних і співпрацюємо з відповідними органами, якщо це потрібно."
                : "No online service can guarantee absolute security. However, we respond promptly to incidents, notify affected users in case of a serious data breach, and cooperate with relevant authorities where required by law."}
            </p>
          </section>

          {/* 4. Your rights */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Your Rights")}
            </h2>
            <p className="mb-4">
              {isUk
                ? "Залежно від законодавства вашої країни, ви можете мати такі права щодо своїх персональних даних:"
                : "Depending on the laws of your country, you may have the following rights regarding your personal data:"}
            </p>

            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                {isUk
                  ? "право отримати копію своїх персональних даних, які ми обробляємо;"
                  : "The right to request a copy of the personal data we process about you;"}
              </li>
              <li>
                {isUk
                  ? "право вимагати виправлення неточної або неповної інформації;"
                  : "The right to request correction of inaccurate or incomplete information;"}
              </li>
              <li>
                {isUk
                  ? "право вимагати обмеження обробки або видалення даних у визначених законом випадках;"
                  : "The right to request restriction of processing or deletion of your data in cases provided by law;"}
              </li>
              <li>
                {isUk
                  ? "право відкликати згоду на обробку даних, якщо ми спираємося на вашу згоду як на правову підставу;"
                  : "The right to withdraw your consent where we rely on consent as the legal basis for processing;"}
              </li>
              <li>
                {isUk
                  ? "право подати скаргу до наглядового органу з питань захисту даних."
                  : "The right to lodge a complaint with a data protection authority."}
              </li>
            </ul>

            <p className="mt-4">
              {isUk
                ? "Щоб реалізувати свої права, ви можете написати нам на адресу підтримки, указанну на сторінці контактів. Ми можемо попросити вас підтвердити особу, щоб захистити ваш акаунт."
                : "To exercise your rights, you can contact us via the support email listed on the Contacts page. We may ask you to verify your identity to protect your account."}
            </p>
          </section>

          {/* 5. Data retention */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Data Retention")}
            </h2>
            <p>
              {isUk
                ? "Ми зберігаємо ваші дані стільки, скільки це потрібно для надання сервісу, виконання юридичних зобов’язань та вирішення спорів. Частина даних (наприклад, журнали доступу та технічні лог-файли) може зберігатися в агрегованому та знеособленому вигляді для аналітики."
                : "We retain your data for as long as necessary to provide the Service, comply with legal obligations, and resolve disputes. Some data, such as access logs and technical logs, may be stored in aggregated and de-identified form for analytics."}
            </p>
            <p className="mt-4">
              {isUk
                ? "Якщо ви просите видалити акаунт, ми видаляємо або анонімізуємо персональні дані, за винятком випадків, коли закон зобов’язує нас зберігати їх довше (наприклад, бухгалтерські документи)."
                : "If you request deletion of your account, we will delete or anonymize your personal data, except where we are legally required to keep certain information (for example, for accounting or reporting purposes)."}
            </p>
          </section>

          {/* 6. Third-party services */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Third-Party Services")}
            </h2>
            <p>
              {isUk
                ? "Для роботи TurbotaAI ми можемо використовувати сторонні сервіси: хостинг-провайдерів, платіжні системи, сервіси аналітики та платформи для обробки голосу чи відео. Вони обробляють дані тільки від нашого імені та за нашими інструкціями."
                : "To operate TurbotaAI, we may rely on third-party service providers such as hosting providers, payment processors, analytics tools, and voice or video platforms. These providers process data only on our behalf and according to our instructions."}
            </p>
            <p className="mt-4">
              {isUk
                ? "Ми уважно відбираємо партнерів і укладаємо з ними договори про обробку даних там, де це необхідно. Ми не продаємо персональні дані користувачів рекламним мережам."
                : "We carefully select our partners and, where required, sign data processing agreements with them. We do not sell users’ personal data to advertising networks."}
            </p>
          </section>

          {/* 7. International transfers */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("International Data Transfers")}
            </h2>
            <p>
              {isUk
                ? "Сервери та постачальники послуг, з якими ми працюємо, можуть розташовуватися в різних країнах. Це означає, що ваші дані можуть передаватися за межі вашої держави проживання."
                : "The servers and service providers we use may be located in different countries. This means that your data may be transferred outside of your country of residence."}
            </p>
            <p className="mt-4">
              {isUk
                ? "Ми забезпечуємо належний рівень захисту таких передавань, спираючись на договори, стандартні договірні положення або інші механізми, передбачені законодавством про захист даних."
                : "We ensure an appropriate level of protection for such transfers by relying on contracts, standard contractual clauses, or other mechanisms permitted under applicable data protection laws."}
            </p>
          </section>

          {/* 8. Children's privacy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Children's Privacy")}
            </h2>
            <p>
              {isUk
                ? "Сервіс TurbotaAI не призначений для дітей молодше 13 років (або іншого віку, визначеного законодавством вашої країни). Ми свідомо не збираємо персональні дані дітей без згоди батьків чи опікунів."
                : "TurbotaAI is not intended for children under the age of 13 (or other age defined by your local law). We do not knowingly collect personal data from children without consent from a parent or legal guardian."}
            </p>
            <p className="mt-4">
              {isUk
                ? "Якщо ви вважаєте, що дитина надала нам свої дані без дозволу дорослих, будь ласка, зв’яжіться з нами — ми видалимо таку інформацію."
                : "If you believe that a child has provided us with personal information without appropriate consent, please contact us and we will delete such data."}
            </p>
          </section>

          {/* 9. Changes to this policy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Changes to This Policy")}
            </h2>
            <p>
              {isUk
                ? "Ми можемо час від часу оновлювати цю Політику конфіденційності, щоб відобразити зміни в сервісі або вимогах законодавства."
                : "We may update this Privacy Policy from time to time to reflect changes in the Service or in applicable law."}
            </p>
            <p className="mt-4">
              {isUk
                ? "Про важливі зміни ми будемо повідомляти через електронну пошту, помітне повідомлення в інтерфейсі або іншим зрозумілим способом. Продовжуючи користуватися сервісом після оновлення політики, ви погоджуєтеся з її новою редакцією."
                : "We will notify you of material changes via email, a prominent notice in the interface, or other reasonable means. By continuing to use the Service after an update, you agree to the revised Policy."}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
