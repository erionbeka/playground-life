import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const EASE = [0.22, 1, 0.36, 1] as const;

const TERMS_TITLE = "Terms & Conditions";
const EFFECTIVE = "Effective date: October 2026";

const SECTIONS = [
  {
    h: "1. Introduction",
    ps: [
      "Welcome to Playground Life. These Terms & Conditions (these “Terms”) are a legal agreement between you and Erion Beka, an individual founder operating Playground Life (“we,” “us,” or “Playground Life”), and they govern your access to and use of the Playground Life platform. The Platform includes the public marketing website, the web application, the mobile and tablet views, the application programming interface (API), any progressive web app or installable app experience, and any related software, content, or services that we make available, whether now or in the future (collectively, the “Platform”).",
      "Playground Life is a clinic-ready tool for assigning, playing, and reviewing structured learning activities for children, including autistic, neurodivergent, and late-developing children. The Platform is designed around three roles. Therapists author and assign play-based activities, set difficulty and support levels, and review the resulting signals. Families view assigned activities and play them with their child at home. Clinic administrators manage caseloads, staff accounts, child profiles, and oversight. The Platform turns play activity into measurable signals — such as independence, response speed, accuracy, and regulation — that help care teams understand what is working and adjust support over time.",
      "These Terms apply to everyone who accesses the Platform in any capacity, including therapists, clinicians, clinic administrators, family members, caregivers, and any visitor who merely browses the public website. Because the Platform is used in contexts involving children and sensitive clinical information, we take these Terms seriously and we ask you to read them carefully.",
      "By accessing, browsing, registering for, signing in to, installing, or otherwise using the Platform, you confirm that you have read, understood, and agreed to be bound by these Terms. If you do not agree to these Terms, you must not use the Platform in any form. If you are using the Platform on behalf of a clinic, school, hospital, therapy practice, or other organization, you represent and warrant that you have the authority to bind that organization to these Terms, and “you” refers to both you individually and that organization.",
      "These Terms should be read together with any additional terms, notices, or policies that we publish or present to you inside the Platform from time to time, all of which are incorporated into these Terms by reference. Where there is a conflict between these Terms and a document we expressly present to you as an overriding agreement (for example, a signed clinic contract), the overriding agreement controls to the extent of the conflict.",
      "You acknowledge that the Platform is a support and documentation tool. It is not a medical device, it does not diagnose or treat any condition, and it does not replace the professional judgment of a licensed clinician. See Section 9 for the full medical disclaimer.",
    ],
  },
  {
    h: "2. Acceptance of These Terms",
    ps: [
      "You accept these Terms by taking any of the following actions: (a) creating an account; (b) signing in to an existing account; (c) checking the acceptance box and pressing the confirmation button presented to you in the app or on the website; (d) installing the app on a device; or (e) continuing to use the Platform after you have been presented with these Terms. Each of these actions is a separate and sufficient act of acceptance.",
      "When you accept these Terms, they form a binding legal contract between you and Playground Life. This contract applies from the moment you first accept it and continues for as long as you use the Platform or maintain an account, and it survives the closure of your account to the extent needed to give effect to provisions that by their nature should survive, such as Sections 7, 8, 9, 10, 11, 12, 14, and 16.",
      "If you are below the age of legal majority in your jurisdiction, you may use the Platform only with the involvement and consent of a parent or legal guardian. By allowing a minor to use the Platform, that parent or guardian agrees to be bound by these Terms on the minor’s behalf and accepts responsibility for the minor’s use of the Platform.",
      "You may withdraw your acceptance at any time by ceasing to use the Platform and, if you hold an account, asking us to close it as described in Section 13. Withdrawing acceptance ends the contract prospectively but does not undo obligations that arose while the contract was in force.",
    ],
  },
  {
    h: "3. Eligibility",
    ps: [
      "You must be at least 13 years old, or the minimum age required by the laws of your country if that is higher, to create a staff, therapist, or clinic administrator account. If you do not meet the applicable minimum age, you may not create an account or sign in.",
      "Children are the focus of the Platform but are not the account holders. Children should use the Platform only under the active supervision of a therapist, parent, guardian, or other responsible adult. Where a child participates in a session, the responsible adult who sets up and supervises that session is responsible for the child’s use of the Platform. Where required by applicable law, we rely on the parent, guardian, or authorized clinic to obtain any necessary consent for a child’s participation.",
      "You must have the legal capacity to enter into these Terms. If you are accessing the Platform on behalf of a clinic or organization, you must be authorized to accept these Terms for that organization.",
      "We do not knowingly collect personal data from children below the applicable age threshold without appropriate authorization or consent from a parent, guardian, or authorized clinician. If you believe that a child has provided us with personal data without proper consent, please contact us at bekaerion@gmail.com and we will take prompt steps to investigate and delete the data where appropriate.",
      "We may decline to offer the Platform, or any part of it, to any person or in any jurisdiction, and we may change eligibility requirements at any time. Any use of the Platform must additionally comply with all laws applicable to you, including any local rules about the clinical, educational, or in-home use of digital tools with children.",
    ],
  },
  {
    h: "4. Accounts and Security",
    ps: [
      "Certain features of the Platform require an account. Accounts are created by the clinic or administrator that oversees your use, or by you where self-registration is offered. Accounts are role-based: a single account is bound to one role (administrator, therapist, or parent/family member), and each role sees only the data and features that its role permits. You may not use one account to gain access to another role.",
      "You are responsible for keeping your login credentials confidential and for everything that happens under your account. Choose a strong, unique password; do not share it; do not reuse it on other services; and do not write it down where others can find it. If you suspect that your credentials have been lost, stolen, or used without authorization, change your password immediately and notify us promptly at bekaerion@gmail.com.",
      "We protect accounts and data with measures that are appropriate to the sensitivity of the information involved. These include password hashing with Argon2id (so that raw passwords are never stored), session tokens (such as JSON Web Tokens) with defined expiry, role-based authorization checks enforced on the server, transport encryption in line with current industry practice, and operational safeguards around our infrastructure.",
      "For security, accountability, and compliance, the Platform maintains audit logs. When significant actions occur — for example, staff changes, child profile changes, assignment creation or approval, family credential resets, and game completion — the Platform records structured entries that may include the actor, the action, the affected entity, a timestamp, the source IP address, a user agent, and additional structured details. These logs are used to maintain the integrity of the record and to investigate issues, and they may be retained for as long as necessary for those purposes.",
      "You must not impersonate another person or professional, create multiple or duplicate accounts to evade a restriction, share credentials to circumvent role limitations, probe, scan, or test the vulnerability of the Platform without our written permission, or attempt to gain unauthorized access to any account, system, or data. Any attempt to do so may result in immediate suspension of your access and may expose you to legal liability.",
      "You agree to keep the information associated with your account accurate and current, and to promptly update it if it changes. Where you administer other users’ accounts, you are responsible for provisioning them correctly, for revoking access that is no longer needed, and for ensuring that everyone you provision accepts and complies with these Terms.",
    ],
  },
  {
    h: "5. Privacy and Personal Data",
    ps: [
      "We process personal data in order to operate, secure, and improve the Platform, and to provide the features you request. The categories of personal data we may process include clinic and organization details; user account information such as name, email address, telephone number, and role; authentication data such as hashed passwords and session tokens; child profile data such as first name, display name, avatar, birth date, general developmental information, personalization and support profiles, therapy goals, and clinical notes; assignment and session data; game interaction signals and results; reward and progression data; family member and caregiver details; and audit logs and technical data such as IP address and user agent.",
      "We process personal data on the basis of the contract between you and us (these Terms), on the basis of your consent where we ask for it, to comply with legal obligations, and to pursue legitimate interests such as keeping the Platform secure and preventing misuse. We apply the principles of data minimization and purpose limitation: we aim to collect only what is needed for the stated purpose and to use it only for that purpose. Where we process sensitive information, we apply additional care and we expect you to enter such information only when it is necessary and appropriate for the support you are providing.",
      "We do not sell your personal data, and we do not share it with advertisers or data brokers. We may share personal data only: (a) with infrastructure, hosting, email, and other service providers that help us run the Platform, under obligations of confidentiality and only as needed to provide their services; (b) with your clinic or organization, where your use is managed by that clinic or organization; (c) where required by law, regulation, court order, or a competent authority; or (d) where necessary to protect the rights, property, or safety of a child, a user, or the public. Where data is transferred internationally, we take steps to ensure an appropriate level of protection.",
      "We retain personal data for as long as needed to provide the Platform and to meet legal, security, and accountability requirements; retention periods vary by the type of data and the purpose. When data is no longer needed, we take steps to delete it or to render it anonymous. Data held in backups may persist for a defined period before it is cycled out.",
      "Depending on your jurisdiction, you may have rights over your personal data, including the right to be informed, to access, to correct or update, to delete, to restrict or object to processing, to data portability, and to withdraw consent where processing is based on consent. To exercise any of these rights, contact us at bekaerion@gmail.com. We will respond within the time required by applicable law and may need to verify your identity before acting. Where your data is managed by a clinic or organization, we may need to direct your request to that organization, and we will help you do so.",
      "The Platform is not directed at the general public of children and is not intended to be used to collect personal data directly from children. Where a child participates in a session, the responsible adult and, where applicable, the clinic are responsible for ensuring that any necessary consent or authorization for that participation has been obtained.",
      "We use transactional and essential technologies to operate the Platform, such as session handling and local storage for preferences and acceptance state. If we introduce non-essential cookies or similar technologies, we will provide notice and, where required, request consent. Please review any separate privacy notice we publish for further detail; where that notice and this section differ, the more specific notice controls for the matters it covers.",
    ],
  },
  {
    h: "6. Acceptable Use",
    ps: [
      "You may use the Platform only for lawful, therapeutic, educational, and documentation purposes connected with supporting child development, and only in the manner for which it is intended. Access to the Platform is a privilege conditioned on responsible use, and you are responsible for the conduct of anyone who uses the Platform through your account or under your supervision.",
      "You agree that you will not, and will not permit anyone else to:",
      "(a) submit content that is false, misleading, harmful, abusive, threatening, defamatory, obscene, or otherwise objectionable, or that is unrelated to the Platform’s purpose;",
      "(b) reverse-engineer, decompile, disassemble, scrape, harvest, frame, mirror, or otherwise attempt to extract, copy, or reconstruct the source code, structure, data model, or underlying technology of the Platform, except to the extent such restriction is prohibited by applicable law;",
      "(c) impersonate any person or professional, or misrepresent your identity, qualifications, licensure, or affiliation;",
      "(d) use the Platform to harm, bully, harass, exploit, endanger, or discriminate against any child or any other person;",
      "(e) introduce viruses, malware, ransomware, spyware, or any other code or material designed to disrupt, damage, disable, or impair the Platform or any related system or network;",
      "(f) access, attempt to access, or use the Platform in a way that exceeds your authorized role or that exposes another clinic’s, another user’s, or another child’s data without authorization;",
      "(g) use automated means, bots, scrapers, or scripts to access the Platform, or place an unreasonable load on our servers or infrastructure, or otherwise interfere with the normal operation of the Platform or with other users’ enjoyment of it;",
      "(h) attempt to circumvent, disable, or defeat any security, authentication, rate-limiting, or access-control feature of the Platform; or",
      "(i) use the Platform to build, train, or improve a competing or similar product, or to conduct competitive analysis, without our written permission.",
      "We reserve the right to investigate suspected violations of this section and to take any action we consider appropriate, including removing content, limiting functionality, suspending or terminating access, and reporting to law enforcement where appropriate. Nothing in this section obliges us to monitor the Platform, and we do not undertake a general obligation to pre-screen content.",
    ],
  },
  {
    h: "7. User Content",
    ps: [
      "“User Content” means the information, records, notes, goals, profiles, comments, assignments, results, and other materials that you or your organization enter into, upload to, or generate through the Platform, including clinical notes, therapy goals, child profiles, personalization and support settings, and game results. As between you and Playground Life, you (or your clinic or organization, as applicable) retain ownership of your User Content.",
      "To operate the Platform, we need a limited license to handle your User Content. By submitting User Content, you grant Playground Life a non-exclusive, worldwide, royalty-free license to host, store, reproduce, transmit, display, and otherwise process your User Content solely to the extent necessary to operate, maintain, secure, and provide the Platform to you and your organization, to generate the outputs you request, and to comply with law. This license does not allow us to sell your User Content or to use it for advertising, and it ends when your User Content is deleted from the Platform, except for copies retained in backups for a limited period or as required by law.",
      "We do not claim ownership of your clinical records or your User Content. We will not disclose your User Content to third parties except as described in these Terms, as directed by you or your organization, or as required by law. Our personnel access User Content only where necessary to operate, support, or secure the Platform, and under obligations of confidentiality.",
      "You are responsible for the accuracy, quality, legality, and appropriateness of your User Content. You represent and warrant that: (a) you have all rights necessary to submit the User Content and to grant the license above; (b) the User Content does not infringe or violate any third party’s rights, including privacy and intellectual property rights; (c) where the User Content includes another person’s or a child’s personal data, you have the authority and, where required, the consent to submit it; and (d) the User Content complies with applicable law and with any professional standards that apply to you.",
      "You are responsible for keeping your own copies of any User Content that is important to you and for exporting it where the Platform offers export features before your account or access ends. We are not responsible for User Content that is lost because your account is closed, access is terminated, or you fail to export it.",
      "We may remove or restrict User Content that we reasonably believe violates these Terms or applicable law, or that presents a risk to a child or to the Platform, but we are not obligated to do so.",
    ],
  },
  {
    h: "8. Our Intellectual Property",
    ps: [
      "The Platform — including the software, source code, user interface, design system, visual style, graphics, blob characters and mascots, illustrations, icons, templates, text, audio, video, logos, product names, documentation, and the selection and arrangement of the content — is owned by Erion Beka or its licensors and is protected by copyright, trademark, trade dress, database, and other intellectual property and related laws, both in the Republic of Kosovo and internationally.",
      "We grant you a limited, revocable, non-exclusive, non-transferable, non-sublicensable license to access and use the Platform in accordance with these Terms and solely for your permitted purposes. This license is a right to use the Platform; it is not a sale and it does not transfer any ownership interest in the Platform to you.",
      "You may not copy, reproduce, modify, adapt, translate, distribute, publish, publicly display or perform, transmit, sell, resell, rent, lease, sublicense, create derivative works from, or otherwise exploit any part of the Platform, in whole or in part, except as expressly permitted by these Terms or by our prior written consent. You may not remove, obscure, or alter any copyright, trademark, or other proprietary notices from the Platform.",
      "All trademarks, service marks, logos, and trade names used in connection with the Platform are our property or the property of their respective owners. You may not use them without the applicable owner’s prior written permission. Nothing in these Terms grants you any right to use any name, logo, or mark of Playground Life or any third party.",
      "If you provide us with suggestions, ideas, or feedback about the Platform, you grant us a perpetual, irrevocable, worldwide, royalty-free license to use and incorporate that feedback into the Platform without any obligation, attribution, or compensation to you.",
    ],
  },
  {
    h: "9. Not Medical Advice — Important Disclaimer",
    ps: [
      "Playground Life supports therapy, learning, and documentation workflows, but it is not a medical device and it is not a substitute for professional clinical judgment, diagnosis, or treatment by a qualified healthcare provider, therapist, educator, or other licensed professional. The Platform does not provide medical advice, medical diagnoses, treatment plans, or therapeutic recommendations.",
      "Therapists, families, and clinics remain fully and solely responsible for all clinical and educational decisions, including any decision about a child’s care, support, development, or education. Any signals, scores, trends, summaries, or reports generated by the Platform are informational aids only. They are derived from user-entered data and from interaction with activities, and they may be incomplete, approximate, or affected by factors outside the Platform’s control.",
      "We make no representation or warranty that any data or signal produced by the Platform is diagnostic, predictive, clinically validated, or suitable for any specific condition, decision, or individual. You must not rely on the Platform as the sole basis for any clinical, educational, or care decision, and you should always consult a qualified professional before making decisions about a child’s care or development.",
      "In an emergency, or if you are concerned about the immediate safety or wellbeing of a child or any person, do not rely on the Platform. Contact your local emergency services or a qualified professional immediately.",
    ],
  },
  {
    h: "10. Disclaimer of Warranties",
    ps: [
      "The Platform is provided on an “as is” and “as available” basis, with all faults and without warranties of any kind, whether express, implied, statutory, or otherwise, to the maximum extent permitted by applicable law. Your use of the Platform is at your sole risk.",
      "We do not warrant that the Platform will be uninterrupted, timely, secure, or error-free; that it will be free of viruses, malware, or other harmful components; that defects will be corrected; that it will meet your requirements or expectations; that it will be compatible with your device, network, or any third-party service; or that it will produce any particular outcome, result, or clinical benefit.",
      "To the maximum extent permitted by law, we specifically disclaim all implied warranties, including the implied warranties of merchantability, fitness for a particular purpose, title, quiet enjoyment, accuracy, and non-infringement. We also disclaim any warranty arising from course of dealing, course of performance, or usage of trade. No advice or information, whether oral or written, obtained from us or through the Platform creates any warranty not expressly stated in these Terms.",
      "Because some jurisdictions do not allow the exclusion of certain warranties, some of the exclusions above may not apply to you. In that case, the exclusions apply to the greatest extent permitted by law, and our warranties are limited in duration and scope to the minimum permitted by law.",
    ],
  },
  {
    h: "11. Limitation of Liability",
    ps: [
      "To the maximum extent permitted by applicable law, neither Playground Life nor its founder, affiliates, contractors, or service providers shall be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, goodwill, anticipated savings, business, opportunity, data, or use, arising out of, relating to, or in connection with your access to or use of, or inability to access or use, the Platform, whether based in contract, tort (including negligence), strict liability, or any other theory, and whether or not we have been advised of the possibility of such damages.",
      "To the maximum extent permitted by law, our total aggregate liability for all claims arising out of or relating to these Terms or your use of the Platform, whether in contract, tort, or otherwise, shall not exceed the greater of: (a) the total amount you (or your organization) paid us for the Platform, if any, in the twelve (12) months immediately preceding the event giving rise to the claim; or (b) one hundred euros (€100).",
      "Nothing in these Terms excludes or limits any liability that cannot lawfully be excluded or limited, including, where applicable, liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for any other liability that applicable law does not permit to be excluded. If a jurisdiction does not allow some of the limitations above, they apply to the greatest extent permitted by law.",
      "You acknowledge and agree that the limitations in this section are a fundamental basis on which we offer the Platform, and that the Platform would not be offered on the same terms without them.",
    ],
  },
  {
    h: "12. Indemnification",
    ps: [
      "To the maximum extent permitted by applicable law, you agree to defend, indemnify, and hold harmless Playground Life, its founder, and their respective affiliates, directors, employees, contractors, and service providers (the “Indemnified Parties”) from and against any and all claims, actions, demands, liabilities, damages, losses, judgments, settlements, fines, costs, and expenses (including reasonable attorneys’ fees and costs) arising out of, relating to, or in connection with:",
      "(a) your access to, use of, or inability to use the Platform, or any activity under your account;",
      "(b) your breach or alleged breach of these Terms;",
      "(c) your violation of any applicable law, regulation, or professional obligation;",
      "(d) your violation of any third party’s rights, including intellectual property, privacy, or confidentiality rights;",
      "(e) any User Content you submit, including any claim that your User Content is inaccurate, unlawful, or infringing;",
      "(f) any consent, authorization, or approval that you represent you have obtained for the use of a child’s or another person’s data, where in fact it was not obtained; or",
      "(g) any clinical, educational, or care decision you make in reliance on or in connection with the Platform.",
      "We reserve the right, at our own expense, to assume the exclusive defense and control of any matter otherwise subject to indemnification by you, in which case you agree to cooperate with our defense of that matter. You may not settle any such matter in a way that imposes any obligation on us without our prior written consent.",
    ],
  },
  {
    h: "13. Termination and Suspension",
    ps: [
      "We may suspend, restrict, or terminate your account and your access to the Platform, in whole or in part, at any time, with or without cause, and with or without notice. We will ordinarily act on a violation of these Terms, on a security or legal risk, on a request from your clinic or organization, or on non-payment where payment applies, but we are not limited to these grounds. Where practicable, we will give notice and an opportunity to raise the matter, but we may act immediately where a child’s safety, the security of the Platform, or the law is concerned.",
      "You may stop using the Platform at any time. If you hold an account, you may request its closure by contacting the clinic or administrator that manages it, or by contacting us at bekaerion@gmail.com. Where your account is managed by a clinic or organization, that organization may also request the closure of your account.",
      "Upon termination or closure, your right to use the Platform ceases immediately. We may, but are not obliged to, delete your User Content and account data in accordance with our retention practices and Section 5. Section 4 (Accounts and Security), Section 7 (User Content), Section 8 (Our Intellectual Property), Section 9 (Not Medical Advice), Section 10 (Disclaimer of Warranties), Section 11 (Limitation of Liability), Section 12 (Indemnification), Section 14 (Governing Law and Jurisdiction), and Section 16 (General Provisions) survive termination, along with any other provisions that by their nature should survive.",
      "Termination does not release you from any obligation or liability that accrued before the termination took effect, and it does not limit any remedy available to us. We are not liable to you or any third party for any suspension or termination carried out in accordance with these Terms.",
    ],
  },
  {
    h: "14. Governing Law and Jurisdiction",
    ps: [
      "These Terms and any dispute or claim arising out of or in connection with them, their subject matter, or their formation (including non-contractual disputes or claims) are governed by and construed in accordance with the laws of the Republic of Kosovo, without regard to its conflict-of-law principles. This choice of law does not deprive you of the protection afforded by the mandatory consumer-protection rules of the country in which you habitually reside, where those rules apply.",
      "The parties agree to attempt to resolve any dispute, controversy, or claim arising out of or relating to these Terms first through good-faith negotiation. A party raising a dispute should do so in writing, describing the issue and the outcome sought. The parties will use reasonable efforts to resolve the matter within thirty (30) days of the written notice, or such longer period as they agree in writing.",
      "If the dispute is not resolved through negotiation within that period, either party may bring the matter before the competent courts in Prishtina, Republic of Kosovo, which shall have exclusive jurisdiction over such disputes, unless mandatory law in your country of residence grants you the right to bring proceedings, or to be sued, in another forum.",
      "Nothing in this section prevents either party from seeking urgent interim or injunctive relief from any court of competent jurisdiction to protect its rights or property, or from protecting a child or other person from harm.",
    ],
  },
  {
    h: "15. Changes to These Terms",
    ps: [
      "We may revise, update, or replace these Terms from time to time to reflect changes in the Platform, in the law, in the way we operate, or in the way we protect our users. When we make changes, we will update the “Effective date” at the top of this page and, where the change is material, we will take reasonable steps to notify you, for example through the Platform, by email, or by a prominent notice the next time you sign in.",
      "A change may be material if, among other things, it alters your rights or obligations, our liability, the way we process personal data, or the price of paid features. We may also make non-material changes without individual notice, such as clarifications and corrections that do not lessen your rights.",
      "Your continued use of the Platform after revised Terms take effect constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the Platform before they take effect. If you continue to use the Platform after the effective date of the revised Terms, you will be bound by them. If you object to a material change, you may close your account as described in Section 13.",
    ],
  },
  {
    h: "16. General Provisions",
    ps: [
      "Force majeure. Neither party shall be liable for any failure or delay in performance caused by circumstances beyond its reasonable control, including acts of God, natural disasters, epidemics or pandemics, war, terrorism, civil unrest, labor disputes, cyberattacks, failures of the internet or of third-party infrastructure, power outages, or government action. The affected party will use reasonable efforts to resume performance and will notify the other party where practicable.",
      "Entire agreement. These Terms, together with any documents expressly incorporated by reference and any additional terms we present to you, constitute the entire agreement between you and Playground Life regarding the Platform, and supersede all prior and contemporaneous understandings, agreements, representations, and warranties, whether written or oral, relating to their subject matter.",
      "Severability. If any provision of these Terms is found by a court or other competent authority to be unlawful, void, or unenforceable, that provision will be modified to the minimum extent necessary to make it enforceable, or if that is not possible, it will be severed, and the remaining provisions will continue in full force and effect. The invalidity of one provision does not affect the validity of the others.",
      "Waiver. No failure or delay by us in exercising or enforcing any right, power, or remedy under these Terms shall operate as a waiver of that or any other right, power, or remedy, and no single or partial exercise of any right, power, or remedy shall preclude any further exercise of it. A waiver is only effective if given in writing and signed by us.",
      "Assignment. You may not assign, transfer, delegate, or sublicense these Terms or any of your rights or obligations under them, whether by operation of law or otherwise, without our prior written consent, and any attempt to do so without consent is void. We may assign, transfer, or delegate these Terms, in whole or in part, without restriction, including to an affiliate or in connection with a merger, acquisition, reorganization, or sale of assets.",
      "No third-party beneficiaries. Except for our founder and the other Indemnified Parties with respect to Section 12, these Terms do not create and should not confer any right or benefit on any third party, and no third party may enforce any provision of these Terms.",
      "Notices. We may give you notices under these Terms by email to the address associated with your account, by posting a notice within the Platform, or by any other reasonable means. You agree that such electronic notices satisfy any legal requirement that a notice be in writing. Notices to us under these Terms should be sent to bekaerion@gmail.com.",
      "Independent parties. Nothing in these Terms creates any partnership, joint venture, agency, employment, or fiduciary relationship between you and us. You and we remain independent parties.",
      "Headings and interpretation. Section headings are for convenience only and do not affect interpretation. Words such as “including” and “for example” are illustrative and not limiting. The singular includes the plural and vice versa where the context requires.",
      "Language. These Terms are drafted in English. Any translation is provided for convenience only, and where there is any conflict or ambiguity, the English version controls.",
    ],
  },
  {
    h: "17. Contact Us",
    ps: [
      "If you have questions about these Terms, would like to request a demo of the product, would like to report a problem or a security concern, or need to exercise a data right, please contact us using the details below. We welcome feedback and aim to respond to reasonable inquiries within a reasonable time.",
      "Email: bekaerion@gmail.com",
      "Playground Life — Prishtina, Republic of Kosovo",
      "Please include enough detail for us to understand and act on your request, and, where your request concerns personal data, enough information for us to verify your identity and your authority to make the request.",
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
              <p key={j} className="mb-3 text-sm leading-relaxed text-foreground/90 last:mb-0">
                {p}
              </p>
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
