"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";

export default function PrivacyPolicyPage() {
  const { t, language } = useTranslation();
  const isUk = language === "uk";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <article className="rounded-3xl bg-white/80 shadow-sm border border-slate-100 px-4 py-8 sm:px-10 sm:py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("Privacy Policy")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {t("Last Updated: November 2025")}
            </p>
          </header>

          <div className="space-y-8 text-[15px] leading-relaxed text-slate-800">
            {/* Вступ */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Information We Collect")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    Ця Політика конфіденційності пояснює, яку інформацію збирає
                    TurbotaAI, як ми її використовуємо та захищаємо. Ми
                    розробляємо Сервіс так, щоб дати вам відчуття безпеки й
                    поваги до особистих кордонів.
                  </p>
                  <p>
                    Використовуючи Сервіс, ви погоджуєтеся з умовами цієї
                    Політики. Якщо ви не згодні з нею, будь ласка, не
                    використовуйте Сервіс.
                  </p>
                  <h3 className="font-semibold">
                    1. Персональна та контактна інформація
                  </h3>
                  <p>Ми можемо збирати таку інформацію:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>ім&apos;я або псевдонім, який ви вводите;</li>
                    <li>
                      адресу електронної пошти, якщо ви залишаєте її для
                      зворотного зв&apos;язку або реєстрації;
                    </li>
                    <li>
                      іншу інформацію, яку ви добровільно надаєте в формах
                      (наприклад, у формі контакту або реєстрації).
                    </li>
                  </ul>

                  <h3 className="font-semibold">
                    2. Зміст сесій та повідомлень
                  </h3>
                  <p>
                    Під час роботи з чат-, голосовим або відео-асистентом ми
                    обробляємо зміст ваших повідомлень, голосу або тексту, щоб
                    надавати відповіді та рекомендації. Залежно від налаштувань,
                    частина цих даних може тимчасово зберігатися для:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>формування історії діалогу;</li>
                    <li>покращення якості відповідей асистента;</li>
                    <li>
                      аналізу типових запитів (в анонімізованому або
                      агрегованому вигляді).
                    </li>
                  </ul>

                  <h3 className="font-semibold">3. Технічна інформація</h3>
                  <p>Ми також можемо отримувати технічні дані, зокрема:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>IP-адресу та приблизне місцезнаходження;</li>
                    <li>
                      інформацію про пристрій, браузер, операційну систему;
                    </li>
                    <li>
                      файли cookie та схожі технології, необхідні для роботи
                      Сервісу та аналітики.
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <p>
                    This Privacy Policy explains what information TurbotaAI
                    collects, how we use it and how we protect it. We design the
                    Service to respect your privacy and personal boundaries.
                  </p>
                  <p>
                    By using the Service, you agree to the terms of this Policy.
                    If you do not agree, please do not use the Service.
                  </p>
                  <h3 className="font-semibold">
                    1. Personal and contact information
                  </h3>
                  <p>We may collect the following information:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>your name or nickname that you provide;</li>
                    <li>
                      e-mail address if you submit it for contact or
                      registration;
                    </li>
                    <li>
                      any other information you voluntarily provide in forms
                      (for example, in the contact or sign-up form).
                    </li>
                  </ul>

                  <h3 className="font-semibold">
                    2. Session content and messages
                  </h3>
                  <p>
                    When you use chat, voice or video assistant, we process the
                    content of your messages, spoken input or text in order to
                    generate responses and guidance. Depending on settings, some
                    of this data may be temporarily stored to:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>maintain a conversation history;</li>
                    <li>improve the quality of the assistant&apos;s replies;</li>
                    <li>
                      analyse common patterns in anonymised or aggregated form.
                    </li>
                  </ul>

                  <h3 className="font-semibold">3. Technical information</h3>
                  <p>We may also collect technical data, such as:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>IP address and approximate location;</li>
                    <li>
                      information about your device, browser and operating
                      system;
                    </li>
                    <li>
                      cookies and similar technologies required for the Service
                      to work and for analytics.
                    </li>
                  </ul>
                </>
              )}
            </section>

            {/* Як ми використовуємо інформацію */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("How We Use Your Information")}
              </h2>
              {isUk ? (
                <>
                  <p>Ми використовуємо зібрані дані для таких цілей:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>надання вам доступу до чат-, голосових та відеосесій;</li>
                    <li>
                      адаптації відповідей асистента до вашого запиту та мови;
                    </li>
                    <li>
                      підтримки роботи Сервісу, діагностики збоїв та
                      безпеки;
                    </li>
                    <li>
                      аналізу використання Сервісу для покращення сценаріїв і
                      якості підтримки;
                    </li>
                    <li>
                      комунікації з вами (наприклад, відповіді на запити,
                      службові сповіщення).
                    </li>
                  </ul>
                  <p>
                    Ми не продаємо ваші персональні дані третім особам і не
                    використовуємо зміст ваших сесій для таргетованої реклами.
                  </p>
                </>
              ) : (
                <>
                  <p>We use the collected data for the following purposes:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      to provide you with access to chat, voice and video
                      sessions;
                    </li>
                    <li>
                      to adapt the assistant&apos;s responses to your request
                      and language;
                    </li>
                    <li>
                      to maintain the Service, diagnose errors and ensure
                      security;
                    </li>
                    <li>
                      to analyse how the Service is used and improve our
                      support scenarios;
                    </li>
                    <li>
                      to communicate with you (for example, responses to
                      requests, important notifications).
                    </li>
                  </ul>
                  <p>
                    We do not sell your personal data to third parties and do
                    not use the content of your sessions for targeted
                    advertising.
                  </p>
                </>
              )}
            </section>

            {/* Правові підстави / Legal basis */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Data Security")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    Ми застосовуємо технічні та організаційні заходи безпеки,
                    щоб захистити дані від несанкціонованого доступу, втрати чи
                    зловживання. Сюди можуть входити шифрування, обмеження
                    доступу, аудит логів та інші практики кібербезпеки.
                  </p>
                  <p>
                    Водночас жодна онлайн-система не може гарантувати
                    абсолютну безпеку. Ви також відіграєте роль у захисті своїх
                    даних — наприклад, не передавайте облікові дані третім
                    особам і використовуйте надійні паролі (якщо акаунти будуть
                    запроваджені).
                  </p>
                </>
              ) : (
                <>
                  <p>
                    We apply technical and organisational security measures to
                    protect data from unauthorised access, loss or misuse. These
                    may include encryption, access controls, log audits and
                    other cybersecurity practices.
                  </p>
                  <p>
                    However, no online system can guarantee absolute security.
                    You also play a role in keeping your data safe — for
                    example, by not sharing your credentials with others and by
                    using strong passwords (if user accounts are introduced).
                  </p>
                </>
              )}
            </section>

            {/* Зберігання даних */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Data Retention")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    Ми зберігаємо дані лише стільки, скільки це потрібно для
                    досягнення цілей, описаних у цій Політиці, або доки цього
                    вимагає закон.
                  </p>
                  <p>
                    Історія діалогів і технічні логи можуть видалятися або
                    анонімізуватися через певний період часу. У майбутньому
                    інтерфейс може містити окремі налаштування для видалення
                    історії користувачем.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    We retain data only for as long as necessary to fulfil the
                    purposes described in this Policy or as required by law.
                  </p>
                  <p>
                    Conversation history and technical logs may be deleted or
                    anonymised after a certain period of time. In the future the
                    interface may include settings that allow you to delete your
                    history yourself.
                  </p>
                </>
              )}
            </section>

            {/* Треті сторони та передача даних */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Third-Party Services")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    Для роботи Сервісу ми можемо використовувати сторонні
                    сервіси — наприклад, хостинг-провайдерів, платіжні системи,
                    платформи для відеозв&apos;язку або постачальників моделей
                    штучного інтелекту.
                  </p>
                  <p>
                    Такі постачальники можуть обробляти ваші дані від нашого
                    імені та згідно з нашими інструкціями. Ми прагнемо
                    співпрацювати лише з тими компаніями, які дотримуються
                    належних стандартів захисту даних.
                  </p>
                  <p>
                    Оскільки інфраструктура може розміщуватися в різних країнах,
                    ваші дані іноді можуть передаватися за межі країни, в якій
                    ви проживаєте. Ми вживаємо заходів, щоб така передача
                    відповідала вимогам застосовного законодавства.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    To operate the Service we may use third-party providers such
                    as hosting companies, payment processors, video platforms or
                    AI model providers.
                  </p>
                  <p>
                    These providers may process your data on our behalf and in
                    accordance with our instructions. We aim to work only with
                    entities that follow appropriate data protection standards.
                  </p>
                  <p>
                    Because infrastructure may be located in different
                    countries, your data may sometimes be transferred outside
                    the country where you live. We take steps to ensure that
                    such transfers comply with applicable data protection laws.
                  </p>
                </>
              )}
            </section>

            {/* Діти */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Children's Privacy")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    TurbotaAI не призначена для самостійного використання
                    дітьми молодше 13 років. Якщо ви молодші 18 років, вам може
                    знадобитися згода батьків або опікунів відповідно до
                    законодавства вашої країни.
                  </p>
                  <p>
                    Якщо ми дізнаємося, що зібрали персональні дані дитини без
                    належної згоди, ми зробимо кроки для їх видалення.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    TurbotaAI is not intended for independent use by children
                    under the age of 13. If you are under 18, parental or
                    guardian consent may be required under the laws of your
                    country.
                  </p>
                  <p>
                    If we become aware that we have collected personal data from
                    a child without appropriate consent, we will take steps to
                    delete such information.
                  </p>
                </>
              )}
            </section>

            {/* Ваші права */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t("Your Rights")}</h2>
              {isUk ? (
                <>
                  <p>
                    Залежно від законодавства вашої країни ви можете мати право:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>отримувати інформацію про те, які дані ми зберігаємо;</li>
                    <li>вимагати виправлення неточної інформації;</li>
                    <li>
                      просити видалити частину даних (якщо ми не зобов&apos;язані
                      зберігати їх за законом);
                    </li>
                    <li>
                      заперечувати проти певних способів обробки або обмежувати
                      їх;
                    </li>
                    <li>подати скаргу до наглядового органу із захисту даних.</li>
                  </ul>
                  <p>
                    Щоб скористатися своїми правами, ви можете написати нам через
                    форму зворотного зв&apos;язку або на email, вказаний у
                    розділі «Контакти».
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Depending on the laws of your country, you may have the
                    right to:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>request information about the data we hold about you;</li>
                    <li>ask us to correct inaccurate information;</li>
                    <li>
                      request deletion of certain data (where we are not
                      required to keep it by law);
                    </li>
                    <li>
                      object to or restrict certain types of processing; and
                    </li>
                    <li>
                      lodge a complaint with a data protection supervisory
                      authority.
                    </li>
                  </ul>
                  <p>
                    To exercise your rights, you can contact us via the feedback
                    form or the e-mail address listed in the &quot;Contact&quot;
                    section.
                  </p>
                </>
              )}
            </section>

            {/* Зміни політики */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Changes to This Policy")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    Ми можемо час від часу оновлювати цю Політику
                    конфіденційності. Дата останнього оновлення вказана у
                    верхній частині сторінки.
                  </p>
                  <p>
                    Якщо ми внесемо суттєві зміни, ми можемо додатково повідомити
                    вас через Сервіс або електронною поштою (якщо вона
                    доступна). Продовжуючи користуватися Сервісом після змін, ви
                    погоджуєтеся з оновленою Політикою.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    We may update this Privacy Policy from time to time. The
                    date of the latest update is shown at the top of this page.
                  </p>
                  <p>
                    If we make material changes, we may additionally notify you
                    through the Service or by e-mail (if available). By
                    continuing to use the Service after the changes take effect,
                    you agree to the updated Policy.
                  </p>
                </>
              )}
            </section>

            {/* Контакти */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Contact Information")}
              </h2>
              {isUk ? (
                <p>
                  Якщо у вас є запитання щодо цієї Політики конфіденційності
                  або способів обробки ваших даних, зв&apos;яжіться з нами через
                  сторінку «Контакти» або за електронною адресою, вказаною там.
                </p>
              ) : (
                <p>
                  If you have any questions about this Privacy Policy or how we
                  process your data, please contact us via the &quot;Contact&quot;
                  page or the e-mail address provided there.
                </p>
              )}
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
