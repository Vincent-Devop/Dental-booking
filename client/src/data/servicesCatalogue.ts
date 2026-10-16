export type CatalogueService = {
  name: string;
  price: string;
  description: string;
  estimate?: boolean;
  note?: string;
  image: string;
  imageAlt: string;
};

export const servicesCatalogue = {
  consultation: [
    { name: "Dental Consultation", price: "CAD $10–$35", description: "A first conversation and assessment to understand your needs and possible next steps.", image: "/oralcare-home-dental-clinic.webp", imageAlt: "Dentist and assistant consulting with a patient in a modern dental clinic" },
    { name: "Dental X-ray", price: "CAD $15–$45", description: "Diagnostic imaging when clinically appropriate to support an assessment.", image: "/oralcare-home-clinic.webp", imageAlt: "Dental team preparing a patient for treatment" },
  ],
  preventive: [
    { name: "Dental Cleaning (Scaling and Polishing)", price: "CAD $50–$80", description: "Professional cleaning and polishing with practical preventive-care guidance.", image: "/oralcare-home-clinic.webp", imageAlt: "Dental team providing preventive care to a patient" },
  ],
  fillings: [
    { name: "White Composite Filling", price: "CAD $45–$95", description: "Tooth-coloured restorative care when a composite filling is clinically suitable.", image: "/oralcare-home-clinic.webp", imageAlt: "Dental professionals providing restorative treatment" },
    { name: "Silver Amalgam Filling", price: "CAD $45–$90", description: "Amalgam restorative care where the material is clinically appropriate and agreed.", image: "/oralcare-home-clinic.webp", imageAlt: "Dental professionals providing restorative treatment" },
    { name: "Three Fillings", price: "CAD $135–$270 composite · CAD $135–$200 amalgam", description: "Planning ranges for three fillings; material selection follows assessment and discussion.", image: "/oralcare-home-clinic.webp", imageAlt: "Dental professionals providing restorative treatment" },
  ],
  extractions: [
    { name: "Simple Tooth Extraction", price: "CAD $20–$50", description: "Assessment and simple extraction care where clinically indicated.", image: "/oralcare-home-clinic.webp", imageAlt: "Dental team treating a patient in a clinic" },
    { name: "Wisdom Tooth Removal", price: "CAD $60–$120", description: "Assessment and planning for wisdom-tooth removal; complexity varies by case.", image: "/oralcare-home-clinic.webp", imageAlt: "Dental team treating a patient in a clinic" },
  ],
  crownsBridges: [
    { name: "Dental Crown", price: "CAD $200–$350", description: "A consultation and treatment plan for restoring a damaged or weakened tooth.", estimate: true, image: "/oralcare-home-clinic.webp", imageAlt: "Dentist and assistant preparing a patient for restorative care" },
    { name: "Dental Bridge", price: "CAD $250–$450", description: "A consultation and treatment plan for replacing a missing tooth or teeth.", estimate: true, image: "/oralcare-home-clinic.webp", imageAlt: "Dentist and assistant preparing a patient for restorative care" },
  ],
  dentures: [
    { name: "Partial Dentures", price: "CAD $400–$500", description: "A removable tooth-replacement option planned around your oral health and needs.", estimate: true, image: "/oralcare-home-clinic.webp", imageAlt: "Dental team discussing care with a patient" },
    { name: "Full Dentures", price: "CAD $550–$900", description: "A full-arch tooth-replacement option planned after a clinical assessment.", estimate: true, image: "/oralcare-home-clinic.webp", imageAlt: "Dental team discussing care with a patient" },
    { name: "Temporary Tooth Replacement", price: "CAD $100–$190", description: "A temporary replacement option while a longer-term plan is considered.", estimate: true, image: "/oralcare-home-clinic.webp", imageAlt: "Dental team discussing care with a patient" },
  ],
  implants: [
    { name: "Single-Tooth Dental Implant", price: "CAD $1,000–$2,000", description: "Implant consultation and treatment planning for a single missing tooth.", estimate: true, note: "Eligibility, components, imaging, and the final plan affect the total cost.", image: "/oralcare-home-dental-clinic.webp", imageAlt: "Dental professionals providing implant treatment planning" },
    { name: "Four Front Teeth Implants", price: "CAD $4,000–$8,000", description: "A planning range for four front-tooth implant care.", estimate: true, note: "The number of implants and the clinical treatment plan determine final costs.", image: "/oralcare-home-dental-clinic.webp", imageAlt: "Dental professionals providing implant treatment planning" },
    { name: "Full-Mouth Dental Implants", price: "CAD $6,000–$15,000+", description: "A planning range for full-mouth implant rehabilitation.", estimate: true, note: "Full-mouth implant costs depend on the treatment plan and number of implants.", image: "/oralcare-home-dental-clinic.webp", imageAlt: "Dental professionals providing implant treatment planning" },
  ],
} satisfies Record<string, CatalogueService[]>;

export const servicesNavigation = [
  ["overview", "Overview"],
  ["consultation", "Consultation"],
  ["preventive-care", "Preventive Care"],
  ["fillings", "Fillings"],
  ["extractions", "Extractions"],
  ["crowns-bridges", "Crowns & Bridges"],
  ["dentures", "Dentures"],
  ["implants", "Implants"],
  ["pricing-faq", "Pricing FAQs"],
] as const;
