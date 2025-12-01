"use client"

import { useLanguage } from "@/lib/i18n/language-context"

export default function TermsOfUsePage() {
  const { t, language } = useLanguage()
  const isUk = language === "uk"

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto bg-card rounded-3xl shadow-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8 text-foreground">
          {t("Terms of Use")}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {t("Last Updated: November 2025")}
        </p>

        <div className="space-y-8 text-muted-foreground">
          {/* Acceptance of Terms */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Acceptance of Terms")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Користуючись сервісом TurbotaAI (далі — «Сервіс»), ви погоджуєтеся з цими Умовами користування та всіма застосовними законами й нормативами. Якщо ви не погоджуєтеся з якоюсь частиною умов, ви не можете користуватися Сервісом."
                  : "By accessing or using TurbotaAI's AI psychology services (the \"Service\"), you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any part of these terms, you may not use the Service."}
              </p>
              <p>
                {isUk
                  ? "Ці Умови є юридично обов’язковою угодою між вами та оператором TurbotaAI Psychology Services. Продовжуючи користуватися Сервісом після оновлення умов, ви підтверджуєте, що приймаєте нову редакцію."
                  : "These Terms constitute a legally binding agreement between you and the operator of TurbotaAI Psychology Services. Your continued use of the Service after we publish updates means that you accept the revised Terms."}
              </p>
            </div>
          </section>

          {/* Eligibility */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Eligibility")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Щоб користуватися Сервісом, ви підтверджуєте, що:"
                  : "To use our Service, you confirm that you:"}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  {isUk
                    ? "маєте щонайменше 18 років;"
                    : "Are at least 18 years of age;"}
                </li>
                <li>
                  {isUk
                    ? "маєте повну цивільну дієздатність для укладення договорів;"
                    : "Have the legal capacity to enter into a contract;"}
                </li>
                <li>
                  {isUk
                    ? "не обмежені у праві користуватися онлайн-сервісами згідно із законодавством, що до вас застосовується;"
                    : "Are not prohibited from using online services under any applicable laws;"}
                </li>
                <li>
                  {isUk
                    ? "надаєте точну та повну інформацію, коли ми запитуємо її для реєстрації чи ідентифікації;"
                    : "Provide accurate and complete information when requested for registration or identification;"}
                </li>
                <li>
                  {isUk
                    ? "забезпечуєте конфіденційність своїх облікових даних і несете відповідальність за всі дії, що відбуваються під вашим акаунтом."
                    : "Maintain the confidentiality of your account credentials and are responsible for all activity that occurs under your account."}
                </li>
              </ul>
            </div>
          </section>

          {/* Use of Services */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Use of Services")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Сервіс TurbotaAI надає розмовну психологічну підтримку за допомогою моделей штучного інтелекту. Ви розумієте та погоджуєтеся, що:"
                  : "TurbotaAI provides conversational psychological support powered by AI models. You understand and agree that:"}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  {isUk
                    ? "Сервіс не є заміною консультації лікаря, психіатра або ліцензованого психотерапевта."
                    : "The Service is not a substitute for consultation with a doctor, psychiatrist, or licensed psychotherapist."}
                </li>
                <li>
                  {isUk
                    ? "Ми не ставимо медичних чи психіатричних діагнозів і не призначаємо лікування."
                    : "We do not provide medical or psychiatric diagnoses and do not prescribe treatment."}
                </li>
                <li>
                  {isUk
                    ? "У разі загрози життю, самогубних думок або іншої невідкладної ситуації ви повинні негайно звернутися до служб екстреної допомоги чи на кризову лінію."
                    : "In case of danger to life, suicidal thoughts, or any other emergency, you must immediately contact local emergency services or a crisis hotline."}
                </li>
                <li>
                  {isUk
                    ? "Відповіді асистента мають інформаційний і підтримувальний характер і не є прямими інструкціями до дії."
                    : "The assistant’s responses are for informational and supportive purposes only and do not constitute direct instructions or orders to act."}
                </li>
                <li>
                  {isUk
                    ? "Будь-які дії, які ви здійснюєте на основі взаємодії з асистентом, ви робите на власний розсуд і ризик."
                    : "Any actions you take based on interactions with the assistant are taken at your own discretion and risk."}
                </li>
              </ul>
            </div>
          </section>

          {/* User Responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("User Responsibilities")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Використовуючи TurbotaAI, ви зобов’язуєтеся:"
                  : "When using TurbotaAI, you agree to:"}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  {isUk
                    ? "не надавати хибну інформацію про себе та своє становище;"
                    : "Not provide false information about yourself or your situation;"}
                </li>
                <li>
                  {isUk
                    ? "не передавати доступ до акаунта третім особам і не продавати його;"
                    : "Not share, sell, or otherwise transfer your account to any third party;"}
                </li>
                <li>
                  {isUk
                    ? "повідомляти нас, якщо ви підозрюєте несанкціонований доступ до свого акаунта;"
                    : "Notify us if you suspect any unauthorized access to your account;"}
                </li>
                <li>
                  {isUk
                    ? "використовувати Сервіс лише в законних цілях і не намагатися завдати шкоди іншим користувачам або платформі;"
                    : "Use the Service only for lawful purposes and not attempt to harm other users or the platform;"}
                </li>
                <li>
                  {isUk
                    ? "поважати конфіденційність інших людей та не розкривати чужі персональні дані без дозволу."
                    : "Respect the privacy of others and not disclose personal information of third parties without their consent."}
                </li>
              </ul>
            </div>
          </section>

          {/* Prohibited Activities */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Prohibited Activities")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Ви прямо погоджуєтеся, що не будете:"
                  : "You expressly agree that you will not:"}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  {isUk
                    ? "використовувати Сервіс для будь-яких незаконних або шахрайських дій;"
                    : "Use the Service for any illegal or fraudulent purpose;"}
                </li>
                <li>
                  {isUk
                    ? "намагатися отримати несанкціонований доступ до серверів, баз даних або облікових записів інших користувачів;"
                    : "Attempt to gain unauthorized access to servers, databases, or other users’ accounts;"}
                </li>
                <li>
                  {isUk
                    ? "модифікувати, декомпілювати, реверс-інженерити або іншим чином намагатися отримати вихідний код Сервісу;"
                    : "Modify, decompile, reverse engineer, or otherwise attempt to obtain the source code of the Service;"}
                </li>
                <li>
                  {isUk
                    ? "завантажувати або передавати віруси, шкідливе програмне забезпечення чи інший код, що може зашкодити системам;"
                    : "Upload or transmit viruses, malicious software, or other code that may damage systems;"}
                </li>
                <li>
                  {isUk
                    ? "видавати себе за іншу особу чи організацію або неправдиво вказувати свою роль чи стосунок до TurbotaAI;"
                    : "Impersonate any person or organization or misrepresent your affiliation with TurbotaAI;"}
                </li>
                <li>
                  {isUk
                    ? "використовувати Сервіс для переслідування, залякування чи образ інших людей."
                    : "Use the Service to harass, intimidate, or abuse others."}
                </li>
              </ul>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Intellectual Property")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Увесь контент Сервісу, включно з текстами, графікою, логотипами, іконками, зображеннями, аудіо та програмним забезпеченням, належить TurbotaAI Psychology Services або використовується на підставі ліцензії й захищений законами про авторське право та інші права інтелектуальної власності."
                  : "All content of the Service, including text, graphics, logos, icons, images, audio, and software, is owned by TurbotaAI Psychology Services or used under license and is protected by copyright and other intellectual property laws."}
              </p>
              <p>
                {isUk
                  ? "Ви отримуєте обмежену, невиключну, таку, що не передається, ліцензію на особисте некомерційне використання Сервісу. Ви не можете відтворювати, змінювати, поширювати чи використовувати контент у комерційних цілях без нашого письмового дозволу."
                  : "You are granted a limited, non-exclusive, non-transferable license to use the Service for personal, non-commercial purposes. You may not reproduce, modify, distribute, or use any content for commercial purposes without our prior written consent."}
              </p>
            </div>
          </section>

          {/* Payment and Billing */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Payment and Billing")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Ціни на платні функції TurbotaAI вказані на відповідних сторінках Сервісу. Оформляючи покупку або підписку, ви погоджуєтеся:"
                  : "Pricing for paid features of TurbotaAI is listed on the relevant pages of the Service. By purchasing access or a subscription, you agree to:"}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  {isUk
                    ? "сплачувати всі застосовні збори та податки згідно з умовами, відображеними під час оплати;"
                    : "Pay all applicable fees and taxes as displayed at the time of purchase;"}
                </li>
                <li>
                  {isUk
                    ? "надавати коректну платіжну інформацію та своєчасно оновлювати її у разі змін;"
                    : "Provide accurate payment information and update it when it changes;"}
                </li>
                <li>
                  {isUk
                    ? "дозволяти нам та нашому платіжному провайдеру списувати кошти з обраного способу оплати відповідно до обраного тарифу."
                    : "Authorize us and our payment provider to charge your selected payment method according to the chosen plan."}
                </li>
              </ul>
              <p>
                {isUk
                  ? "Ми можемо змінювати вартість сервісу в майбутньому. Про зміни тарифів ми повідомлятимемо завчасно; нові ціни застосовуються з наступного періоду оплати."
                  : "We may update our pricing in the future. We will notify you in advance, and new prices will apply from the next billing period."}
              </p>
            </div>
          </section>

          {/* Cancellation and Refunds */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Cancellation and Refunds")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Ви можете скасувати підписку в налаштуваннях акаунта. Доступ до платних функцій зберігатиметься до кінця вже оплачуваного періоду."
                  : "You may cancel your subscription in your account settings. Your access to paid features will continue until the end of the current billing period."}
              </p>
              <p>
                {isUk
                  ? "Питання повернення коштів розглядається індивідуально. Зазвичай повернення можливе у випадку технічних збоїв, які тривалий час не дозволяють користуватися сервісом, або помилкового списання."
                  : "Refund requests are handled on a case-by-case basis. In general, refunds may be granted when technical issues prevent you from using the Service for a prolonged period or when you have been charged in error."}
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Limitation of Liability")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "У межах, максимально дозволених законом, TurbotaAI Psychology Services не несе відповідальності за будь-які непрямі, випадкові, особливі, штрафні чи побічні збитки, зокрема за втрату прибутку, даних або переривання бізнес-процесів, що виникають унаслідок користування Сервісом або неможливості ним користуватися."
                  : "To the fullest extent permitted by law, TurbotaAI Psychology Services shall not be liable for any indirect, incidental, special, punitive, or consequential damages, including loss of profits, data, or business interruption, arising out of or in connection with your use of, or inability to use, the Service."}
              </p>
              <p>
                {isUk
                  ? "Сукупна відповідальність TurbotaAI за будь-які претензії, пов’язані з користуванням Сервісом, не перевищує суму, фактично сплачену вами за користування платними функціями за останні 12 місяців."
                  : "The total liability of TurbotaAI for any claims related to your use of the Service shall not exceed the total amount you have paid for paid features during the twelve months preceding the event giving rise to the claim."}
              </p>
            </div>
          </section>

          {/* Disclaimer of Warranties */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Disclaimer of Warranties")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Сервіс надається за принципом «як є» та «в міру доступності». Ми не гарантуємо, що TurbotaAI працюватиме безперервно, без помилок, відповідатиме всім вашим очікуванням або повністю вирішить ваші психологічні запити."
                  : "The Service is provided on an \"as is\" and \"as available\" basis. We do not guarantee that TurbotaAI will operate without interruptions or errors, that it will meet all your expectations, or that it will fully resolve your psychological concerns."}
              </p>
              <p>
                {isUk
                  ? "У тій мірі, у якій це дозволено законом, ми відмовляємося від будь-яких прямих або непрямих гарантій, включно з гарантіями придатності для певної мети, товарної якості та ненарушення прав третіх осіб."
                  : "To the extent permitted by law, we disclaim all express or implied warranties, including warranties of fitness for a particular purpose, merchantability, and non-infringement."}
              </p>
            </div>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Indemnification")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Ви погоджуєтеся відшкодувати збитки, захищати та звільнити від відповідальності TurbotaAI Psychology Services, її співробітників та партнерів від будь-яких претензій, збитків, зобов’язань чи витрат, що виникають унаслідок:"
                  : "You agree to indemnify, defend, and hold harmless TurbotaAI Psychology Services and its employees and partners from any claims, damages, liabilities, or expenses arising out of:"}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  {isUk
                    ? "вашого фактичного чи передбачуваного порушення цих Умов;"
                    : "Your actual or alleged violation of these Terms;"}
                </li>
                <li>
                  {isUk
                    ? "вашого неправомірного використання Сервісу;"
                    : "Your misuse of the Service;"}
                </li>
                <li>
                  {isUk
                    ? "порушення вами прав третіх осіб, включно з правами інтелектуальної власності чи права на приватність."
                    : "Your infringement of any third-party rights, including intellectual property or privacy rights."}
                </li>
              </ul>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Termination")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Ми можемо тимчасово призупинити або повністю припинити доступ до вашого акаунта на власний розсуд, якщо вважаємо, що ви порушуєте ці Умови, завдаєте шкоди Сервісу або іншим користувачам чи створюєте для нас юридичні ризики."
                  : "We may suspend or terminate your access to the Service at our sole discretion if we believe that you are violating these Terms, harming the Service or other users, or creating legal risk for us."}
              </p>
              <p>
                {isUk
                  ? "У разі припинення доступу ваше право користуватися Сервісом негайно припиняється. Положення щодо інтелектуальної власності, обмеження відповідальності, відмови від гарантій та відшкодування збитків залишаються чинними й після припинення дії Умов."
                  : "Upon termination, your right to use the Service ceases immediately. The provisions regarding intellectual property, limitation of liability, disclaimer of warranties, and indemnification will remain in effect even after termination."}
              </p>
            </div>
          </section>

          {/* Governing Law and Dispute Resolution */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Governing Law and Dispute Resolution")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Ці Умови регулюються законодавством юрисдикції, у якій офіційно зареєстровано TurbotaAI Psychology Services, без урахування колізій норм права."
                  : "These Terms are governed by the laws of the jurisdiction in which TurbotaAI Psychology Services is officially registered, without regard to conflict-of-law principles."}
              </p>
              <p>
                {isUk
                  ? "Сторони прагнутимуть розв’язувати спори шляхом переговорів. Якщо це неможливо, спір може бути переданий на розгляд компетентного суду або, за домовленістю сторін, у арбітраж відповідно до застосовних правил."
                  : "The parties will first attempt to resolve any dispute through negotiations. If this is not possible, the dispute may be submitted to the competent courts or, by mutual agreement, to arbitration in accordance with applicable rules."}
              </p>
            </div>
          </section>

          {/* Severability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Severability")}
            </h2>
            <div className="space-y-4">
              <p>
                {isUk
                  ? "Якщо будь-яке положення цих Умов буде визнано недійсним або таким, що не може бути виконано, воно вважається зміненим настільки, наскільки це потрібно для приведення його у відповідність до закону, або виключеним з тексту. Решта положень залишаються чинними."
                  : "If any provision of these Terms is found to be invalid or unenforceable, it will be modified to the minimum extent necessary to comply with the law, or deemed severed from the Terms. The remaining provisions will continue in full force and effect."}
              </p>
              <p>
                {isUk
                  ? "Невикористання нами будь-якого права чи положення цих Умов не означає відмову від такого права або положення."
                  : "Our failure to enforce any right or provision of these Terms shall not be deemed a waiver of such right or provision."}
              </p>
              <p>
                {isUk
                  ? "Ці Умови користування є повною угодою між вами та TurbotaAI Psychology Services щодо користування Сервісом і замінюють собою всі попередні домовленості або усні/письмові угоди з цього приводу."
                  : "These Terms of Use constitute the entire agreement between you and TurbotaAI Psychology Services regarding your use of the Service and supersede any prior agreements or understandings relating to it."}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
