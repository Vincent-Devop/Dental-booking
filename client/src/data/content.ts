import type { Article, ClinicConfig, Service } from "../../../shared/types";

export const clinic: ClinicConfig = {
  city: "Almonte",
  province: "Ontario",
  country: "Canada",
  currency: "CAD",
  timezone: "America/Toronto",
  hours: ["Mon–Fri · 8:00 AM–5:00 PM", "Sat · 8:00 AM–2:00 PM", "Sun · Closed"],
  contactStatus: "pending",
  bookingStatus: "pending",
};

const image = {
  hero: "/oralcare-home-dental-clinic.webp",
  interior: "/oralcare-home-clinic.webp",
  care: "/oralcare-home-dental-clinic.webp",
  journal: "/oralcare-home-clinic.webp",
};

export const services: Service[] = [
  {
    slug: "preventive-care",
    name: "Preventive care",
    category: "Foundations",
    description: "Thoughtful examinations, hygiene guidance, and care planning built around your everyday health.",
    longDescription: "Preventive visits create space to understand what is happening now and what will help you stay comfortable over time. A visit may include an examination, cleaning, oral hygiene guidance, and a conversation about next steps when appropriate.",
    duration: "Duration set by clinic",
    priceMode: "pending",
    priceLabel: "Price determined after examination",
    image: image.care,
  },
  {
    slug: "restorative-dentistry",
    name: "Restorative dentistry",
    category: "Repair",
    description: "Care for damaged or weakened teeth with a clear explanation of options and materials.",
    longDescription: "Restorative care is planned around the condition of the tooth, your preferences, and a clinically appropriate treatment plan. Final recommendations and costs follow an examination and discussion of available options.",
    duration: "Plan after examination",
    priceMode: "quote",
    priceLabel: "Contact the clinic for pricing",
    image: image.interior,
  },
  {
    slug: "smile-enhancement",
    name: "Smile enhancement",
    category: "Confidence",
    description: "A measured approach to whitening and cosmetic conversations, without one-size-fits-all promises.",
    longDescription: "Smile enhancement begins with a conversation about what you would like to change and what is clinically suitable. Options may include professional whitening or other cosmetic treatments when offered and approved by the clinic.",
    duration: "Consultation required",
    priceMode: "pending",
    priceLabel: "Price determined after examination",
    image: image.hero,
  },
  {
    slug: "urgent-dental-care",
    name: "Urgent dental care",
    category: "Support",
    description: "A clear first conversation when pain, discomfort, or a sudden dental concern needs attention.",
    longDescription: "If you are experiencing dental pain or a sudden concern, contact the clinic so the team can advise on the next appropriate step. Emergency availability and treatment scope remain configurable by the clinic.",
    duration: "Availability varies",
    priceMode: "quote",
    priceLabel: "Contact the clinic for pricing",
    image: image.care,
  },
  {
    slug: "orthodontic-consultation",
    name: "Orthodontic consultation",
    category: "Alignment",
    description: "A considered conversation about alignment goals, timelines, and treatment pathways.",
    longDescription: "An orthodontic consultation is an opportunity to understand your goals, review suitable pathways, and decide whether further assessment is needed. Specific modalities and treatment availability are clinic-configured.",
    duration: "Consultation required",
    priceMode: "pending",
    priceLabel: "Price determined after examination",
    image: image.interior,
  },
  {
    slug: "dental-implants",
    name: "Dental implant consultation",
    category: "Tooth replacement",
    description: "Careful planning for tooth replacement, with treatment options explained before decisions are made.",
    longDescription: "Implant care involves assessment, planning, and discussion of alternatives. The final treatment plan depends on clinical findings and may involve additional providers where appropriate.",
    duration: "Consultation required",
    priceMode: "quote",
    priceLabel: "Contact the clinic for pricing",
    image: image.hero,
  },
];

export const articles: Article[] = [
  {
    slug: "a-gentler-rhythm-for-daily-oral-care",
    title: "A gentler rhythm for daily oral care",
    excerpt: "Small, consistent habits create a more useful foundation than occasional over-correction.",
    category: "Preventive care",
    date: "October 10, 2026",
    readTime: "4 min read",
    author: "OralCare+ Journal",
    image: image.journal,
    body: ["A steady oral-care routine is easier to keep when it fits the rhythm of your day. Brushing twice daily and cleaning between teeth are simple foundations, but technique and consistency matter more than intensity.", "If your gums bleed, your teeth feel sensitive, or a routine has become uncomfortable, a dental professional can help you understand what may be contributing and what adjustments are appropriate.", "This article is educational content, not a diagnosis. If you have pain, swelling, trauma, or a concern that is changing, contact a dental clinic for an assessment."],
  },
  {
    slug: "what-to-expect-from-a-first-visit",
    title: "What to expect from a first dental visit",
    excerpt: "A first visit is a conversation as much as it is an examination: context, questions, and a clear next step.",
    category: "Treatment education",
    date: "September 22, 2026",
    readTime: "5 min read",
    author: "OralCare+ Journal",
    image: image.hero,
    body: ["A first visit usually starts with your questions, health history, and what you would like help with. The clinical team then determines what examination is appropriate.", "After the examination, the dentist can explain findings, options, and what may happen next. Treatment estimates are patient-specific and may change as care progresses.", "You can ask about alternatives, timing, maintenance, and costs. A clear care plan should leave you knowing what is being recommended and why."],
  },
  {
    slug: "understanding-tooth-sensitivity",
    title: "Understanding tooth sensitivity",
    excerpt: "Sensitivity has more than one possible cause. Notice the pattern, then bring useful detail to a professional assessment.",
    category: "Oral hygiene",
    date: "August 30, 2026",
    readTime: "4 min read",
    author: "OralCare+ Journal",
    image: image.care,
    body: ["Sensitivity can appear with cold drinks, sweet foods, brushing, or changes in pressure. The timing and location can help a dental professional understand what to assess.", "Use a gentle brush technique and avoid changing products repeatedly without guidance. If sensitivity is new, persistent, or paired with pain, arrange an assessment.", "The information here is general education. It does not replace a clinical examination or diagnosis."],
  },
];

export const faqs = [
  ["How do I choose an appointment time?", "Choose a service and a date to view live availability. The clinic's approved hours, holidays, staff availability, and service duration determine which times can be requested."],
  ["Will I see prices online?", "Only clinic-approved pricing is published. Where a fee depends on an examination or treatment plan, the site will say so rather than presenting an unverified number."],
  ["What happens after I request a booking?", "The booking flow shows the service, local time, deposit configuration, and applicable policy before payment. An appointment is confirmed only after the required payment is verified."],
  ["Where is OralCare+ located?", "OralCare+ is located at 95 Mill Street, Almonte, Ontario K0A 1A0. Public phone and email details remain launch inputs until supplied by the clinic."],
];

export { image };
