"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";

export default function TermsOfUsePage() {
  const { t, language } = useTranslation();
  const isUk = language === "uk";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <article className="rounded-3xl bg-white/80 shadow-sm border border-slate-100 px-4 py-8 sm:px-10 sm:py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("Terms of Use")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {t("Last Updated: November 2025")}
            </p>
          </header>

          <div className="space-y-8 text-[15px] leading-relaxed text-slate-800">
            {/* Прийняття умов */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Acceptance of Terms")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    Користуючись сервісами AI-психології TurbotaAI (далі —{" "}
                    «Сервіс»), ви підтверджуєте, що погоджуєтеся з цими Умовами
                    користування та всіма чинними законами і нормативними
                    актами. Якщо ви не згодні з будь-якою частиною цих Умов,
                    будь ласка, не використовуйте Сервіс.
                  </p>
                  <p>
                    Ці Умови є юридично зобов&apos;язувальною угодою між вами та
                    оператором сервісу TurbotaAI Psychology Services. Ваше
                    подальше користування Сервісом після публікації оновлень
                    означає, що ви приймаєте змінені Умови.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    By accessing or using TurbotaAI&apos;s AI psychology
                    services (the &quot;Service&quot;), you agree to be bound by
                    these Terms of Use and all applicable laws and regulations.
                    If you do not agree with any part of these Terms, you must
                    not use the Service.
                  </p>
                  <p>
                    These Terms constitute a legally binding agreement between
                    you and the operator of TurbotaAI Psychology Services. Your
                    continued use of the Service after we publish updates means
                    that you accept the revised Terms.
                  </p>
                </>
              )}
            </section>

            {/* Право користування сервісом / Eligibility */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Eligibility") ?? t("User Responsibilities")}
              </h2>
              {isUk ? (
                <>
                  <p>Щоб користуватися Сервісом, ви підтверджуєте, що:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>вам виповнилося щонайменше 18 років;</li>
                    <li>
                      ви маєте повну цивільну дієздатність для укладення
                      договорів;
                    </li>
                    <li>
                      ви не обмежені у праві користуватися онлайн-сервісами
                      згідно з чинним законодавством;
                    </li>
                    <li>
                      ви надаєте правдиву, точну та актуальну інформацію, коли
                      це потрібно для реєстрації чи ідентифікації;
                    </li>
                    <li>
                      ви самостійно відповідаєте за конфіденційність своїх
                      облікових даних (якщо акаунт буде створено) та за всі
                      дії, що відбуваються під вашим обліковим записом.
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <p>To use the Service, you confirm that you:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>are at least 18 years of age;</li>
                    <li>have the legal capacity to enter into a contract;</li>
                    <li>
                      are not prohibited from using online services under any
                      applicable laws;
                    </li>
                    <li>
                      provide accurate and up-to-date information when requested
                      for registration or identification;
                    </li>
                    <li>
                      are responsible for maintaining the confidentiality of
                      your account credentials (if an account is created) and
                      for all activity that occurs under your account.
                    </li>
                  </ul>
                </>
              )}
            </section>

            {/* Використання сервісу */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Use of Services")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    TurbotaAI надає інструменти психологічної підтримки на основі
                    штучного інтелекту. Сервіс не є медичним закладом і не
                    надає послуг, що прирівнюються до лікарського консультування
                    чи психіатричної допомоги.
                  </p>
                  <p>
                    Ви погоджуєтеся використовувати Сервіс виключно для
                    особистих, некомерційних цілей, якщо інше прямо не
                    погоджено з нами окремим письмовим договором. Ви не
                    можете:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>копіювати, змінювати або поширювати Сервіс;</li>
                    <li>
                      намагатися отримати несанкціонований доступ до наших
                      систем або даних інших користувачів;
                    </li>
                    <li>
                      використовувати Сервіс для розпалювання ворожнечі,
                      переслідування, завдання шкоди собі чи іншим;
                    </li>
                    <li>
                      використовувати Сервіс у спосіб, який може порушувати
                      закон або права третіх осіб.
                    </li>
                  </ul>
                  <p>
                    Сервіс може час від часу оновлюватися, змінювати
                    функціональність, інтерфейс або обсяг доступних можливостей
                    без попереднього повідомлення.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    TurbotaAI provides AI-based psychological support tools. The
                    Service is not a medical facility and does not provide
                    services that qualify as medical or psychiatric treatment.
                  </p>
                  <p>
                    You agree to use the Service only for personal,
                    non-commercial purposes, unless otherwise agreed with us in
                    a separate written agreement. You must not:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>copy, modify or distribute the Service;</li>
                    <li>
                      attempt to gain unauthorized access to our systems or
                      other users&apos; data;
                    </li>
                    <li>
                      use the Service to promote hate, harassment, self-harm or
                      harm to others;
                    </li>
                    <li>
                      use the Service in any way that may violate the law or
                      the rights of third parties.
                    </li>
                  </ul>
                  <p>
                    The Service may be updated from time to time, and we may
                    modify features, design or availability without prior
                    notice.
                  </p>
                </>
              )}
            </section>

            {/* Відповідальність користувача */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("User Responsibilities")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    Ви несете відповідальність за те, що саме і в якому обсязі
                    розповідаєте Сервісу. Не діліться інформацією, яку не
                    готові зберігати в цифровому вигляді, якщо інше не
                    передбачено політикою конфіденційності.
                  </p>
                  <p>
                    Ви погоджуєтеся не використовувати Сервіс для надсилання
                    образ, погроз, спаму, реклами або іншого небажаного чи
                    незаконного контенту.
                  </p>
                  <p>
                    Якщо ви порушуєте ці Умови або ми обґрунтовано вважаємо, що
                    ваша поведінка може зашкодити Сервісу або іншим
                    користувачам, ми можемо тимчасово обмежити чи припинити ваш
                    доступ до Сервісу.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    You are responsible for the information you choose to share
                    with the Service. Do not disclose data that you are not
                    comfortable storing in digital form, unless otherwise stated
                    in our Privacy Policy.
                  </p>
                  <p>
                    You agree not to use the Service to send insults, threats,
                    spam, advertising or any other unwanted or illegal content.
                  </p>
                  <p>
                    If you violate these Terms, or if we reasonably believe
                    that your behaviour may harm the Service or other users, we
                    may temporarily restrict or terminate your access to the
                    Service.
                  </p>
                </>
              )}
            </section>

            {/* Оплата та підписка */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Payment and Billing")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    На етапі тестування окремі функції TurbotaAI можуть
                    надаватися безкоштовно або з обмеженим доступом. Інформація
                    про тарифи, підписки та одноразові сесії буде окремо
                    опублікована в інтерфейсі Сервісу та/або на сайті.
                  </p>
                  <p>
                    Якщо ви оформлюєте платну підписку або купуєте разову
                    послугу, ви погоджуєтеся з відповідними умовами оплати,
                    вказаними на сторінці тарифу. Платежі можуть
                    оброблятися через сторонніх платіжних провайдерів.
                  </p>
                  <p>
                    Умови повернення коштів (якщо передбачені) будуть описані в
                    окремому розділі тарифу або в нашій політиці повернення.
                    Будь ласка, уважно ознайомтеся з ними перед оплатою.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    During the testing phase, some features of TurbotaAI may be
                    provided free of charge or with limited access. Information
                    about pricing, subscriptions and one-time sessions will be
                    published separately in the Service interface and/or on the
                    website.
                  </p>
                  <p>
                    If you purchase a paid subscription or a one-time service,
                    you agree to the applicable payment terms displayed on the
                    pricing page. Payments may be processed via third-party
                    payment providers.
                  </p>
                  <p>
                    Refund conditions (if available) will be described in a
                    separate section of the pricing page or in our refund
                    policy. Please review these terms carefully before making a
                    payment.
                  </p>
                </>
              )}
            </section>

            {/* Відмова від гарантій та обмеження відповідальності */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Limitation of Liability")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    Сервіс TurbotaAI надається «як є» без будь-яких явних або
                    неявних гарантій щодо його точності, повноти чи
                    відповідності вашим очікуванням. Ми прагнемо підтримувати
                    стабільну роботу Сервісу, але не гарантуємо, що він буде
                    доступний безперервно та без помилок.
                  </p>
                  <p>
                    TurbotaAI не є екстреною службою та не замінює консультацію
                    лікаря, психіатра або іншого фахівця в галузі охорони
                    здоров&apos;я. У випадку загрози вашому життю, здоров&apos;ю
                    чи безпеці інших осіб вам необхідно негайно звернутися до
                    екстрених служб або до живого спеціаліста.
                  </p>
                  <p>
                    У межах, дозволених законом, ми не несемо відповідальності
                    за будь-які прямі, непрямі, випадкові, штрафні або
                    побічні збитки, що виникли внаслідок або у зв&apos;язку з
                    користуванням Сервісом або неможливістю його використання.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    The TurbotaAI Service is provided &quot;as is&quot; without
                    any express or implied warranties regarding its accuracy,
                    completeness or fitness for your particular purposes. We aim
                    to keep the Service stable but do not guarantee that it will
                    be available without interruptions or errors.
                  </p>
                  <p>
                    TurbotaAI is not an emergency service and does not replace
                    consultations with a doctor, psychiatrist or other licensed
                    healthcare professional. If you are in danger or may harm
                    yourself or others, you must immediately contact emergency
                    services or a human specialist.
                  </p>
                  <p>
                    To the maximum extent permitted by law, we shall not be
                    liable for any direct, indirect, incidental, punitive or
                    consequential damages arising out of or in connection with
                    your use of, or inability to use, the Service.
                  </p>
                </>
              )}
            </section>

            {/* Зміни умов */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Changes to Terms")}
              </h2>
              {isUk ? (
                <>
                  <p>
                    Ми можемо час від часу оновлювати ці Умови. Дата останнього
                    оновлення зазначена у верхній частині сторінки. У разі
                    суттєвих змін ми можемо додатково повідомити вас через
                    Сервіс або електронною поштою (якщо вона в нас є).
                  </p>
                  <p>
                    Продовжуючи користуватися Сервісом після набуття чинності
                    новими Умовами, ви погоджуєтеся з ними. Якщо ви не згодні з
                    оновленими Умовами, ви повинні припинити використання
                    Сервісу.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    We may update these Terms from time to time. The date of the
                    latest update is indicated at the top of this page. In case
                    of material changes, we may additionally notify you through
                    the Service or by e-mail (if available).
                  </p>
                  <p>
                    By continuing to use the Service after the new Terms come
                    into effect, you agree to the updated Terms. If you do not
                    agree with the changes, you must stop using the Service.
                  </p>
                </>
              )}
            </section>

            {/* Контактна інформація */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {t("Contact Information")}
              </h2>
              {isUk ? (
                <p>
                  Якщо у вас є запитання щодо цих Умов користування, ви можете
                  зв&apos;язатися з нами через форму зворотного зв&apos;язку на
                  сайті або за адресою електронної пошти, вказаною в розділі
                  «Контакти».
                </p>
              ) : (
                <p>
                  If you have any questions about these Terms of Use, you can
                  contact us via the contact form on the website or by using the
                  e-mail address listed in the &quot;Contact&quot; section.
                </p>
              )}
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
