"use client"

import { useLanguage } from "@/lib/i18n/language-context"

export default function TermsOfUsePage() {
  const { t } = useLanguage()

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
                By accessing or using TurbotaAI&apos;s AI psychology services
                (the &quot;Service&quot;), you agree to be bound by these Terms
                of Use and all applicable laws and regulations. If you do not
                agree with these terms, you must not use the Service.
              </p>
              <p>
                These Terms constitute a legally binding agreement between you
                and the operator of TurbotaAI Psychology Services. Your
                continued use of the Service after we publish updates means that
                you accept the revised Terms.
              </p>
            </div>
          </section>

          {/* Eligibility */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Eligibility")}
            </h2>
            <div className="space-y-4">
              <p>To use our Service, you confirm that you:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Are at least 18 years of age</li>
                <li>Have the legal capacity to enter into a contract</li>
                <li>
                  Are not prohibited from using online services under any
                  applicable laws
                </li>
                <li>Provide accurate and complete information when requested</li>
                <li>Will keep your account credentials secure</li>
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
                TurbotaAI provides AI-based psychological support, educational
                content, and self-help tools. You understand and agree that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  The Service is not a substitute for professional medical,
                  psychiatric, or psychotherapeutic care
                </li>
                <li>
                  The AI assistant cannot make medical diagnoses, prescribe
                  medication, or provide emergency help
                </li>
                <li>
                  In any crisis or emergency you must immediately contact local
                  emergency services or a crisis hotline
                </li>
                <li>
                  All information and suggestions are for informational and
                  supportive purposes only
                </li>
                <li>
                  You are solely responsible for any actions you take based on
                  interactions with the Service
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
              <p>When using the Service, you agree to:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  Provide accurate, current and complete information where
                  required
                </li>
                <li>
                  Maintain the confidentiality of your login details and any
                  one-time links
                </li>
                <li>
                  Notify us promptly of any unauthorized use of your account or
                  security breach you become aware of
                </li>
                <li>
                  Use the Service only for lawful purposes and in accordance
                  with these Terms
                </li>
                <li>
                  Not attempt to interfere with or disrupt the Service, its
                  infrastructure or security
                </li>
                <li>
                  Not use automated tools to access the Service unless expressly
                  permitted
                </li>
                <li>
                  Respect the intellectual property and privacy rights of
                  TurbotaAI and third parties
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
              <p>You expressly agree that you will not:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>
                  Attempt to gain unauthorized access to any part of the Service
                  or related systems
                </li>
                <li>
                  Reverse engineer, decompile, or otherwise attempt to extract
                  the source code of the Service
                </li>
                <li>
                  Collect or harvest personal data about other users without
                  their consent
                </li>
                <li>
                  Upload, transmit, or distribute viruses, malware, or other
                  harmful code
                </li>
                <li>
                  Impersonate any person or entity, or misrepresent your
                  affiliation with a person or entity
                </li>
                <li>
                  Interfere with or disrupt the Service, servers, or networks
                </li>
                <li>
                  Use the Service to harass, threaten, abuse, or otherwise harm
                  others
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
                All content and materials available through the Service,
                including text, graphics, logos, icons, images, audio, video and
                software, are owned or licensed by TurbotaAI Psychology Services
                and are protected by copyright, trademark and other intellectual
                property laws.
              </p>
              <p>
                We grant you a limited, non-exclusive, non-transferable license
                to access and use the Service for personal, non-commercial
                purposes. This license does not allow you to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Copy or reproduce content except for personal use</li>
                <li>Modify, adapt, or create derivative works</li>
                <li>
                  Distribute, sell, rent, lease, or publicly display any part of
                  the Service
                </li>
                <li>
                  Use our trademarks, branding, or name without prior written
                  consent
                </li>
              </ul>
            </div>
          </section>

          {/* Payment and Billing */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Payment and Billing")}
            </h2>
            <div className="space-y-4">
              <p>
                Information about current pricing, subscription options and test
                periods is displayed on the platform. By purchasing any paid
                access, you agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Pay all fees applicable to your chosen plan</li>
                <li>
                  Provide valid and up-to-date payment and billing information
                </li>
                <li>
                  Authorize us or our payment provider to charge your payment
                  method for recurring subscriptions where applicable
                </li>
                <li>Pay any taxes, duties, or government charges if applied</li>
              </ul>
              <p className="mt-4">
                We may change prices and billing models in the future. Any
                changes will be communicated in advance and will not affect an
                already paid billing period.
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
                You may cancel your subscription or stop using the Service at
                any time via your account settings or by contacting support.
                Unless otherwise stated, cancellations take effect at the end of
                the current billing period.
              </p>
              <p>
                Refunds may be granted at our sole discretion in specific
                situations, for example:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  Significant technical issues preventing reasonable use of the
                  Service
                </li>
                <li>Mistaken duplicate payments</li>
                <li>
                  Other exceptional cases evaluated individually by the support
                  team
                </li>
              </ul>
              <p className="mt-4">
                To request a refund, please contact us at the support email
                listed below within the timeframe indicated in our refund
                policy, if any.
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
                To the maximum extent permitted by law, TurbotaAI Psychology
                Services and its owners, employees, and partners shall not be
                liable for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  Any indirect, incidental, special, consequential, or punitive
                  damages
                </li>
                <li>
                  Loss of profits, revenue, data, goodwill, or business
                  opportunities
                </li>
                <li>
                  Any interruption of the Service, technical failures, or data
                  loss
                </li>
                <li>
                  Unauthorized access to or alteration of your transmissions or
                  data
                </li>
                <li>
                  Any actions or content of third parties using or linked to the
                  Service
                </li>
              </ul>
              <p className="mt-4">
                Where liability cannot be excluded, our total aggregate
                liability arising out of or relating to the Service will not
                exceed the amount you paid for the Service during the twelve
                months preceding the event giving rise to the claim.
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
                The Service is provided on an &quot;as is&quot; and &quot;as
                available&quot; basis. We make no representations or warranties
                of any kind, express or implied, including but not limited to
                warranties of merchantability, fitness for a particular purpose,
                non-infringement, or reliability of results.
              </p>
              <p>
                We do not warrant that the Service will be uninterrupted,
                error-free, secure, or that any defects will be corrected. Any
                use of the Service is at your sole risk.
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
                You agree to indemnify, defend, and hold harmless TurbotaAI
                Psychology Services, its affiliates, officers, employees, and
                agents from and against any claims, demands, losses, damages, or
                expenses (including reasonable attorneys&apos; fees) arising
                from:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Your use or misuse of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any rights of another person</li>
                <li>
                  Your violation of any applicable laws, rules, or regulations
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
                We may suspend or terminate your access to the Service at any
                time, with or without notice, if we reasonably believe that you:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Violated these Terms of Use</li>
                <li>Misused the Service or harmed other users</li>
                <li>Engaged in fraudulent, abusive, or illegal activity</li>
              </ul>
              <p className="mt-4">
                Upon termination, your right to use the Service will immediately
                cease. Sections relating to intellectual property, limitation of
                liability, disclaimer of warranties, and indemnification will
                survive termination.
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
                These Terms of Use are governed by the laws of the jurisdiction
                in which TurbotaAI Psychology Services operates, without regard
                to conflict-of-law principles.
              </p>
              <p>
                Wherever permitted by law, any dispute arising out of or related
                to these Terms or the Service shall be resolved through
                confidential, binding arbitration or another alternative dispute
                resolution mechanism selected by us, rather than in court, except
                where applicable law requires otherwise.
              </p>
            </div>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Changes to Terms")}
            </h2>
            <div className="space-y-4">
              <p>
                We may update these Terms of Use from time to time. When we make
                material changes, we will notify you by:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Updating the &quot;Last Updated&quot; date at the top</li>
                <li>
                  Posting a prominent notice on the website or inside the
                  application
                </li>
                <li>
                  Sending an email to the address associated with your account,
                  where applicable
                </li>
              </ul>
              <p className="mt-4">
                Your continued use of the Service after the effective date of
                updated Terms constitutes your acceptance of those changes.
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
                If any provision of these Terms of Use is held to be invalid,
                illegal, or unenforceable, that provision will be enforced to
                the maximum extent permissible and the remaining provisions will
                remain in full force and effect.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Contact Information")}
            </h2>
            <div className="space-y-4">
              <p>
                If you have any questions about these Terms of Use or the
                Service, you can contact us by e-mail:
              </p>
              <p>
                <a
                  href="mailto:support@turbotaai.com"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  support@turbotaai.com
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
