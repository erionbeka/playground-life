import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const EASE = [0.22, 1, 0.36, 1] as const;

const TERMS_TITLE = "Terms & Conditions";
const EFFECTIVE = "Effective date: October 2026";

const SECTIONS = [
  {
    h: "1. Introduction",
    ps: [
      "Welcome to Playground Life. These Terms & Conditions (these “Terms”) are a legal agreement between you and Erion Beka (“we,” “us,” or “Playground Life”) that govern your access to and use of the Playground Life platform, including the website, the mobile and tablet views, the API, and any related software or services (collectively, the “Platform”).",
      "The Platform is a clinic-ready tool for assigning, playing, and reviewing structured learning activities. It is designed to support therapists, families, and clinic administrators working with children — including autistic, neurodivergent, and late-developing children — by turning play activity into measurable signals that help care teams adjust support over time.",
      "By accessing, browsing, registering for, or otherwise using the Platform, you agree to be bound by these Terms. If you do not agree, you may not use the Platform. If you are using the Platform on behalf of a clinic, school, or organization, you represent that you have the authority to bind that organization to these Terms.",
    ],
  },
  {
    h: "2. Acceptance of These Terms",
    ps: [
      "You accept these Terms by (a) creating an account, (b) signing in, or (c) using the Platform after being presented with these Terms. Your acceptance is also given when you click “I accept” or a similar confirmation presented in the app or on the website.",
      "These Terms form a binding contract. If you are under the age of majority in your jurisdiction, you may use the Platform only with the involvement of a parent or legal guardian, and that guardian agrees to these Terms on your behalf.",
    ],
  },
  {
    h: "3. Eligibility",
    ps: [
      "You must be at least 13 years old — or the minimum age required by the laws of your country — to create an account. Children should use the Platform under the supervision of a therapist, parent, or guardian.",
      "We do not knowingly collect personal data from children below the applicable age threshold without appropriate consent. If you believe a child has provided us with personal data without consent, please contact us at info@playground-life.com and we will take steps to delete it.",
    ],
  },
  {
    h: "4. Accounts and Security",
    ps: [
      "To use certain features of the Platform you will need to create an account. You are responsible for keeping your login credentials confidential and for all activity that occurs under your account. Choose a strong password, do not share it, and notify us promptly if you suspect unauthorized access.",
      "We protect accounts with industry-standard measures, including Argon2id password hashing, JWT sessions, and role-based authorization. Audit logs record actor, action, entity, timestamp, IP address, user agent, and structured details for security and accountability.",
      "You must not impersonate another person, create multiple accounts to evade restrictions, or attempt to gain unauthorized access to any part of the Platform. We may suspend or terminate accounts that violate these rules.",
    ],
  },
  {
    h: "5. Privacy and Personal Data",
    ps: [
      "We process personal data — such as clinic details, user names, contact information, child profiles, therapy goals, assignments, game results, and audit logs — in order to operate and improve the Platform. Our processing is limited to the purposes for which the data was collected, consistent with data minimization and purpose limitation principles.",
      "We do not sell your personal data. We may share data only as necessary to operate the Platform (for example, with hosting or infrastructure providers), to comply with the law, or to protect safety.",
      "You have rights over your personal data, including the right to access, correct, delete, or export it. To exercise these rights, contact us at info@playground-life.com. For more detail, please review our privacy notice.",
    ],
  },
  {
    h: "6. Acceptable Use",
    ps: [
      "You may use the Platform only for lawful, therapeutic, and educational purposes connected with child development support. You agree not to:",
      "(a) submit false, misleading, or harmful content;",
      "(b) reverse-engineer, decompile, scrape, or otherwise attempt to extract the source code or underlying structure of the Platform;",
      "(c) impersonate another user or professional, or misrepresent your qualifications or affiliation;",
      "(d) use the Platform to harm, harass, endanger, or discriminate against any child or person;",
      "(e) introduce viruses, malware, or any code designed to disrupt the service; or",
      "(f) use the Platform in a way that exceeds reasonable request volumes or interferes with other users.",
    ],
  },
  {
    h: "7. User Content",
    ps: [
      "As between you and Playground Life, you retain ownership of the clinical data, notes, goals, and results you enter into the Platform (“User Content”). By submitting User Content, you grant Playground Life a non-exclusive, worldwide license to use, host, store, reproduce, and display that User Content solely to operate and improve the Platform for you.",
      "You are responsible for the accuracy and appropriateness of your User Content. You represent that you have the right to enter it and that it does not violate any third-party rights or applicable law.",
      "We do not claim ownership of your clinical records, and we will not share your User Content with third parties except as described in these Terms or as required by law.",
    ],
  },
  {
    h: "8. Our Intellectual Property",
    ps: [
      "Playground Life — including the software, user interface, graphics, text, audio, logos, documentation, and the underlying code — is owned by Erion Beka or its licensors and is protected by copyright and other intellectual property laws.",
      "You may view and use the Platform as permitted by these Terms. You may not copy, modify, distribute, create derivative works from, or publicly display any part of the Platform without our express written permission. Nothing in these Terms transfers ownership of the Platform to you.",
    ],
  },
  {
    h: "9. Not Medical Advice — Important Disclaimer",
    ps: [
      "Playground Life supports therapy workflows but is not a substitute for professional clinical judgment, diagnosis, or treatment by a qualified healthcare provider, therapist, or educator. The Platform does not provide medical diagnoses, treatment plans, or therapeutic advice.",
      "Therapists, families, and clinics remain fully responsible for all clinical decisions. We make no representation that activity data or signals generated by the Platform are diagnostic, predictive, or clinically validated for any specific condition. Always consult a qualified professional before making decisions about a child’s care or development.",
    ],
  },
  {
    h: "10. Disclaimer of Warranties",
    ps: [
      "The Platform is provided “as is” and “as available,” without warranties of any kind, express or implied, to the fullest extent permitted by law. We do not warrant that the Platform will be uninterrupted, error-free, secure, or free of viruses or other harmful components, or that it will meet your requirements or produce particular outcomes.",
      "We specifically disclaim implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement.",
    ],
  },
  {
    h: "11. Limitation of Liability",
    ps: [
      "To the fullest extent permitted by law, neither Playground Life nor its founder shall be liable for any indirect, incidental, consequential, special, exemplary, or punitive damages, or for any loss of profits, revenue, data, or use, arising out of or relating to your use of or inability to use the Platform, even if we have been advised of the possibility of such damages.",
      "Our aggregate liability for any claim arising out of or relating to these Terms or your use of the Platform, whether in contract, tort, or otherwise, shall not exceed the greater of (a) the amount you paid us, if any, in the twelve (12) months preceding the claim, or (b) one hundred euros (€100).",
    ],
  },
  {
    h: "12. Indemnification",
    ps: [
      "You agree to defend, indemnify, and hold harmless Playground Life, its founder, and their respective affiliates, contractors, and service providers from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys’ fees) arising out of or relating to: (a) your use of the Platform; (b) your violation of these Terms; (c) your violation of any law or the rights of a third party; or (d) any User Content you submit.",
    ],
  },
  {
    h: "13. Termination and Suspension",
    ps: [
      "We may suspend or terminate your account and your access to the Platform at any time, with or without cause, and with or without notice, immediately upon any violation of these Terms. Upon termination, your right to use the Platform ceases immediately.",
      "Termination does not affect rights or obligations that accrued before the termination date, nor does it limit any remedy we may have.",
    ],
  },
  {
    h: "14. Governing Law and Jurisdiction",
    ps: [
      "These Terms are governed by the laws of the Republic of Kosovo, without regard to conflict-of-law principles. The parties agree that any dispute, controversy, or claim arising out of or relating to these Terms shall be resolved first through good-faith negotiation between the parties.",
      "If the dispute is not resolved within thirty (30) days after a party raises it in writing, either party may bring the matter before the competent courts in Prishtina, Republic of Kosovo, which shall have exclusive jurisdiction over such disputes.",
    ],
  },
  {
    h: "15. Changes to These Terms",
    ps: [
      "We may revise these Terms from time to time to reflect changes in the Platform, the law, or our practices. When we make material changes, we will notify you through the Platform or by email, and we will update the “Effective date” at the top of this page.",
      "Your continued use of the Platform after revised Terms take effect means you accept the revised Terms. If you do not agree to the revised Terms, you must stop using the Platform.",
    ],
  },
  {
    h: "16. General Provisions",
    ps: [
      "Force majeure. Neither party shall be liable for failure or delay in performance caused by circumstances beyond its reasonable control, including natural disasters, war, terrorism, labor disputes, internet or infrastructure failures, or government action.",
      "Entire agreement. These Terms, together with any documents expressly incorporated by reference, constitute the entire agreement between you and Playground Life regarding your use of the Platform and supersede all prior understandings.",
      "Severability. If any provision of these Terms is found to be unlawful, void, or unenforceable, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will continue in full force and effect.",
      "Waiver. Our failure to exercise or enforce any right under these Terms is not a waiver of that right.",
      "Assignment. You may not assign or transfer these Terms without our written consent. We may assign these Terms without restriction.",
      "Notices. Notices to you may be sent by email or posted on the Platform. Notices to us should be sent to info@playground-life.com.",
    ],
  },
  {
    h: "17. Contact Us",
    ps: [
      "If you have questions about these Terms, would like to request a demo of the product, or need to exercise a data right, please contact us at:",
      "Email: info@playground-life.com",
      "Playground Life — Prishtina, Kosovo",
    ],
  },
];

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mb-10 text-center"
      >
        <a
          onClick={() => navigate("/")}
          className="inline-block mb-4 touch-target text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to homepage
        </a>
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">{TERMS_TITLE}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{EFFECTIVE}</p>
      </motion.header>

      <article className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm">
        {SECTIONS.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 * i, ease: EASE }}
            className="mb-8 last:mb-0"
          >
            <h3 className="font-display text-lg font-bold text-foreground mb-3">{section.h}</h3>
            {section.ps.map((p, j) => (
              <p key={j} className="text-sm leading-relaxed text-foreground/90 mb-3 last:mb-0 dangerouslySetInnerHTML={{ __html: p }}"></p>
            ))}
          </motion.div>
        ))}
      </article>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mt-12 flex flex-col items-center gap-4 text-center"
      >
        <p className="text-sm text-muted-foreground">
          By using Playground Life you agree to these Terms. Read them carefully before continuing.
        </p>
        <button
          onClick={() => navigate("/")}
          className="touch-target rounded-2xl bg-primary px-8 py-3 text-base font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Go to homepage
        </button>
      </motion.div>
    </div>
  );
}
