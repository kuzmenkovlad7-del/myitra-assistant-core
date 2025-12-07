import React from "react"

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <article className="rounded-3xl bg-white/80 shadow-sm border border-slate-100 px-4 py-8 sm:px-10 sm:py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Last Updated: November 2025
            </p>
          </header>

          <div className="space-y-8 text-[15px] leading-relaxed text-slate-800">
            {/* Information We Collect */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Information We Collect</h2>

              <p>
                This Privacy Policy explains what information TurbotaAI collects,
                how we use it and how we protect it. We design the Service to
                respect your privacy and personal boundaries.
              </p>
              <p>
                By using the Service, you agree to the terms of this Policy. If
                you do not agree, please do not use the Service.
              </p>

              <h3 className="font-semibold">
                1. Personal and contact information
              </h3>
              <p>We may collect the following information:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>your name or nickname that you provide;</li>
                <li>e-mail address if you submit it for contact or registration;</li>
                <li>
                  any other information you voluntarily provide in forms (for
                  example, in the contact or sign-up form).
                </li>
              </ul>

              <h3 className="font-semibold">2. Session content and messages</h3>
              <p>
                When you use chat, voice or video assistant, we process the
                content of your messages, spoken input or text in order to
                generate responses and guidance. Depending on settings, some of
                this data may be temporarily stored to:
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
                  information about your device, browser and operating system;
                </li>
                <li>
                  cookies and similar technologies required for the Service to
                  work and for analytics.
                </li>
              </ul>
            </section>

            {/* How We Use Your Information */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                How We Use Your Information
              </h2>
              <p>We use the collected data for the following purposes:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>to provide you with access to chat, voice and video sessions;</li>
                <li>
                  to adapt the assistant&apos;s responses to your request and
                  language;
                </li>
                <li>
                  to maintain the Service, diagnose errors and ensure security;
                </li>
                <li>
                  to analyse how the Service is used and improve our support
                  scenarios;
                </li>
                <li>
                  to communicate with you (for example, responses to requests,
                  important notifications).
                </li>
              </ul>
              <p>
                We do not sell your personal data to third parties and do not
                use the content of your sessions for targeted advertising.
              </p>
            </section>

            {/* Data Security */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Data Security</h2>
              <p>
                We apply technical and organisational security measures to
                protect data from unauthorised access, loss or misuse. These may
                include encryption, access controls, log audits and other
                cybersecurity practices.
              </p>
              <p>
                However, no online system can guarantee absolute security. You
                also play a role in keeping your data safe — for example, by not
                sharing your credentials with others and by using strong
                passwords (if user accounts are introduced).
              </p>
            </section>

            {/* Data Retention */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Data Retention</h2>
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
            </section>

            {/* Third-Party Services */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Third-Party Services</h2>
              <p>
                To operate the Service we may use third-party providers such as
                hosting companies, payment processors, video platforms or AI
                model providers.
              </p>
              <p>
                These providers may process your data on our behalf and in
                accordance with our instructions. We aim to work only with
                entities that follow appropriate data protection standards.
              </p>
              <p>
                Because infrastructure may be located in different countries,
                your data may sometimes be transferred outside the country where
                you live. We take steps to ensure that such transfers comply
                with applicable data protection laws.
              </p>
            </section>

            {/* Children's Privacy */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Children&apos;s Privacy</h2>
              <p>
                TurbotaAI is not intended for independent use by children under
                the age of 13. If you are under 18, parental or guardian consent
                may be required under the laws of your country.
              </p>
              <p>
                If we become aware that we have collected personal data from a
                child without appropriate consent, we will take steps to delete
                such information.
              </p>
            </section>

            {/* Your Rights */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Your Rights</h2>
              <p>Depending on the laws of your country, you may have the right to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>request information about the data we hold about you;</li>
                <li>ask us to correct inaccurate information;</li>
                <li>
                  request deletion of certain data (where we are not required to
                  keep it by law);
                </li>
                <li>object to or restrict certain types of processing; and</li>
                <li>
                  lodge a complaint with a data protection supervisory authority.
                </li>
              </ul>
              <p>
                To exercise your rights, you can contact us via the feedback form
                or the e-mail address listed in the Contact section.
              </p>
            </section>

            {/* Changes to This Policy */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. The date of
                the latest update is shown at the top of this page.
              </p>
              <p>
                If we make material changes, we may additionally notify you
                through the Service or by e-mail (if available). By continuing
                to use the Service after the changes take effect, you agree to
                the updated Policy.
              </p>
            </section>

            {/* Contact Information */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Contact Information</h2>
              <p>
                If you have any questions about this Privacy Policy or how we
                process your data, please contact us via the Contact page or the
                e-mail address provided there.
              </p>
            </section>
          </div>
        </article>
      </div>
    </main>
  )
}
