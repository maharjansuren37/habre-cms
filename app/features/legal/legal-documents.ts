export type LegalDocumentKey = "terms" | "privacy";

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  list?: string[];
};

export type LegalDocument = {
  title: string;
  updated: string;
  intro: string[];
  sections: LegalSection[];
};

// The terms of service and the privacy policy (F-428), as plain strings: the
// page escapes them like any text, so editing the wording never touches markup
// (D28-D30). Section ids are page anchors (/legal/privacy#ai) - keep them once
// published. Every fact here is something the code does; "[OWNER: ...]" marks
// what only the owner can say, and the deploy waits until none is left.
export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
  terms: {
    title: "Terms of service",
    updated: "2026-10-13",
    intro: [
      'These terms are the agreement between you and [OWNER: legal name or trading name, ABN if any], Australia ("Habre", "we"), for using Habre to create, edit and publish a website.',
      "By creating an account you agree to these terms and to our Privacy policy. If you do not agree, do not create an account.",
    ],
    sections: [
      {
        id: "who-can-use",
        heading: "Who can use Habre",
        paragraphs: [
          "You must be at least [OWNER: minimum age, e.g. 18] to create an account. If you use Habre for a business or another organisation, you agree to these terms on its behalf.",
        ],
      },
      {
        id: "your-account",
        heading: "Your account",
        paragraphs: [
          "Give a real email address and keep your password to yourself. You are responsible for what happens under your account. If you think someone else has used it, change your password and tell us.",
          "If you invite other people to your site, you decide what they can do there, and you are responsible for what they publish.",
        ],
      },
      {
        id: "your-content",
        heading: "Your content",
        paragraphs: [
          "What you put on your site - words, images, your logo - stays yours. You give us permission to store it, copy it as needed to run the service (for example in backups and resized images), and show it to the people who visit your site. That permission ends when you delete it or your account, apart from copies in backups until they age out (see the Privacy policy).",
          "You must have the right to publish everything you put on your site.",
        ],
      },
      {
        id: "acceptable-use",
        heading: "What you must not do",
        paragraphs: ["You must not use Habre to publish or send:"],
        list: [
          "anything illegal in Australia or where you are",
          "malware, or anything meant to harm a visitor's device",
          "phishing, or pages pretending to be someone else",
          "spam",
          "material that infringes someone else's copyright, trade mark or other rights",
          "harassment, threats or abuse of other people",
        ],
      },
      {
        id: "suspension",
        heading: "If a site breaks these terms",
        paragraphs: [
          "We may take a site's public pages offline, or remove content, if it breaks these terms or the law, or puts other people or the service at risk. Where we can, we will tell you why. While a site is offline you can still sign in and change it.",
        ],
      },
      {
        id: "contact-forms",
        heading: "Contact forms on your site",
        paragraphs: [
          "If you add a contact form, the messages your visitors send are stored for your site and emailed to you. You are responsible to your visitors for how you use what they send, including telling them in your own privacy notice. We handle those messages only to deliver them to you.",
        ],
      },
      {
        id: "ai-drafts",
        heading: "AI drafts",
        paragraphs: [
          "Habre can draft a website from your description using an AI model. A draft can be wrong, out of date or unsuitable. Nothing it writes is published until you choose to publish it, so read it first - what you publish is yours.",
        ],
      },
      {
        id: "plans-and-limits",
        heading: "Plans and limits",
        paragraphs: [
          "Each plan has limits, such as storage for images and a monthly allowance of AI credits, shown on your Plan page. When you reach a limit, the action that would go past it is refused - your published site stays up.",
          "Paid plans, when offered, are billed in advance through Stripe. A paid plan may start with a free trial, shown when you choose it; unless you cancel before the trial ends, the first payment is taken when it ends. You can cancel at any time from Manage billing; your site keeps the paid plan until the end of the period you have paid for, then moves to Free. [OWNER: confirm the Stripe Customer Portal cancels at the end of the period.] [OWNER: refund policy, as Australian Consumer Law requires.]",
        ],
      },
      {
        id: "beta",
        heading: "A service in beta",
        paragraphs: [
          "Habre is new and in beta. It is provided as it is, and we may change, add or remove features. We will try to give notice of changes that affect your site.",
        ],
      },
      {
        id: "ending",
        heading: "Ending",
        paragraphs: [
          "You can delete your account at any time from Your account. If you are your site's last admin, that deletes the site too.",
          "We may close an account that seriously or repeatedly breaks these terms. Where we can, we will tell you first and give you a chance to fix it.",
        ],
      },
      {
        id: "liability",
        heading: "Liability",
        paragraphs: [
          "[OWNER: limitation of liability, as far as the Australian Consumer Law allows. Nothing in these terms excludes rights you have under that law.]",
        ],
      },
      {
        id: "law",
        heading: "Governing law",
        paragraphs: ["These terms are governed by the law of [OWNER: state], Australia."],
      },
      {
        id: "changes",
        heading: "Changes to these terms",
        paragraphs: [
          "If we change these terms we will update the date at the top and email account holders before a change that matters takes effect. [OWNER: nothing sends this email for you - keep the promise only if you will send it.] Using Habre after that means you accept the new terms.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        paragraphs: ["Questions about these terms: [OWNER: contact email]."],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    updated: "2026-10-13",
    intro: [
      "This policy explains what personal information Habre collects, why, who else handles it, and what you can do about it. Habre is run by [OWNER: legal name or trading name, ABN if any], Australia. Contact: [OWNER: contact email].",
    ],
    sections: [
      {
        id: "account",
        heading: "Your account and your site",
        paragraphs: [
          "When you sign up we keep your name, your email address and your password - stored only as a slow, one-way hash (scrypt), never as the password itself. We also keep your site's address and settings, and the pages, posts and images you add. We use these to run your account and your site.",
          "Images you upload are stored at a public web address, so anyone who has that address can open them, even before the page they are on is published.",
        ],
      },
      {
        id: "ai",
        heading: "AI drafting",
        paragraphs: [
          "When you ask Habre to draft your site, we send the kind of site you chose and the description you typed to OpenRouter, which passes it to the AI model provider it routes the request to.",
          "We keep the description, the draft that comes back, which provider and model made it, the number of tokens used and the cost, so we can show you the draft and count your AI credits. The draft is only a suggestion: nothing is published until you choose to. Habre does not use your content to train AI models.",
        ],
      },
      {
        id: "contact-forms",
        heading: "Visitors who use a contact form",
        paragraphs: [
          "If a site has a contact form and you send it a message, we store your name, email address and message for that site and email them to the site's owner, with your address set as the one to reply to. We handle these on the site owner's behalf; their own privacy notice covers how they use them. Your IP address is also used to limit how many messages can be sent.",
        ],
      },
      {
        id: "billing",
        heading: "Payments",
        paragraphs: [
          "Paid plans, when offered, are handled by Stripe. Your card details go to Stripe and never reach Habre. To set up the subscription we give Stripe your email address and your site's identifier; Stripe keeps its customer record under its own privacy policy, also after your site is deleted. We keep the Stripe customer and subscription identifiers, the plan and its status, and the date it is paid until.",
        ],
      },
      {
        id: "logs",
        heading: "Logs",
        paragraphs: [
          "Our web server records each request: the IP address, the time, the full address requested, the page it came from, and the other details the browser sends with it, apart from its cookies. These logs are kept in files of up to 10 MB: the current file and the three before it are kept and older ones deleted, so how long an entry lasts depends on how busy the site is.",
          "Habre's own log records sign-ins, failed sign-ins and other security events, with an account's identifier and the IP address - never a password or an email address - so we can spot someone guessing passwords. [OWNER: how long the server's system log keeps these entries.]",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        paragraphs: [
          "Habre sets only the cookies it needs to work: a session cookie when you sign in (it lasts 7 days and cannot be read by scripts), and, while an email address is waiting to be confirmed - after signing up, or trying to log in before confirming - one holding that address (24 hours). There are no analytics, advertising or tracking cookies, and the public sites Habre serves set none.",
        ],
      },
      {
        id: "processors",
        heading: "Who else handles your information",
        paragraphs: [
          "We use these services to run Habre. Each handles personal information only to provide its service to us:",
        ],
        list: [
          "Oracle Cloud - the server Habre runs on and its database, in [OWNER: region]",
          "Cloudflare - stores uploaded images and the nightly database backups (R2), and runs DNS for site addresses",
          "Resend - sends Habre's email: signup confirmation, password reset and contact-form messages",
          "OpenRouter, and the AI model provider it routes a request to - AI drafting",
          "Stripe - payments, when paid plans are offered",
        ],
      },
      {
        id: "where",
        heading: "Where your information is",
        paragraphs: [
          "Some of these services store or process information outside Australia, including in the United States. [OWNER: confirm each provider's locations and the cross-border disclosure wording under APP 8.]",
        ],
      },
      {
        id: "retention",
        heading: "How long we keep it, and deleting it",
        paragraphs: [
          "We keep your information while your account exists. You can delete your account at any time from Your account, and it is deleted straight away. Posts and images you added, and the descriptions you typed for AI drafting, stay with the site, without your name, unless the site is deleted too.",
          "If you are your site's last admin, deleting your account deletes the whole site: its pages, posts, images, contact messages, AI drafts and the accounts of its other members, who are told by email. Its images are deleted from storage straight after; if that fails, an image can stay at its web address until we remove it.",
          "Deleted information can remain in our backups until they age out: up to 9 days on the server and [OWNER: R2 backup retention] in Cloudflare R2.",
        ],
      },
      {
        id: "rights",
        heading: "Your rights",
        paragraphs: [
          "You can see and correct your name and email address in Your account, and delete your account there. To ask for a copy of your information, or anything else about your privacy, email [OWNER: contact email]. If you are not happy with our answer, you can complain to the Office of the Australian Information Commissioner (OAIC).",
          "We do not sell personal information.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        paragraphs: [
          "If we change this policy we will update the date at the top, and email account holders about a change that matters. [OWNER: nothing sends this email for you - keep the promise only if you will send it.]",
        ],
      },
    ],
  },
};
