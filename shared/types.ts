export type PriceMode = "published" | "starting" | "range" | "quote" | "pending";

export type Service = {
  slug: string;
  name: string;
  category: string;
  description: string;
  longDescription: string;
  duration: string;
  priceMode: PriceMode;
  priceLabel: string;
  image: string;
};

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  author: string;
  image: string;
  body: string[];
};

export type ClinicConfig = {
  city: string;
  province: string;
  country: string;
  currency: string;
  timezone: string;
  hours: string[];
  contactStatus: "pending" | "configured";
  bookingStatus: "pending" | "configured";
};
