/**
 * Custom-order storefront: VA job-application materials students can order,
 * made-to-order by Coach Reymar, paid via the same PayMongo checkout used
 * for enrollment and coaching. See api/payment/create-order-checkout and
 * app/dashboard/store.
 */
export interface StoreItem {
  key: string;
  label: string;
  description: string;
  amountCentavos: number;
  icon: string;
  turnaround: string;
}

export const STORE_ITEMS: StoreItem[] = [
  {
    key: "cv",
    label: "Curriculum Vitae",
    description:
      "A clean, client-ready CV built around your background and target VA niche - formatted the way clients on Upwork and OnlineJobs.ph actually expect.",
    amountCentavos: 25000,
    icon: "📄",
    turnaround: "2-3 business days",
  },
  {
    key: "portfolio",
    label: "Portfolio",
    description:
      "A complete online portfolio showcasing your mock projects and skills, built to convert profile views into interviews - your strongest first impression.",
    amountCentavos: 150000,
    icon: "🗂️",
    turnaround: "5-7 business days",
  },
  {
    key: "cover-letter",
    label: "Cover Letter",
    description:
      "A persuasive, personalized cover letter template you can adapt for every job application, written to get you noticed in a crowded inbox.",
    amountCentavos: 15000,
    icon: "✉️",
    turnaround: "1-2 business days",
  },
  {
    key: "invoice-format",
    label: "VA Invoice Format",
    description:
      "A professional invoice template for billing your clients - clean, accurate, and ready to send from your very first payout.",
    amountCentavos: 25000,
    icon: "🧾",
    turnaround: "1-2 business days",
  },
  {
    key: "intro-presentation",
    label: "Intro Presentation",
    description:
      "A short, polished self-introduction deck you can attach to proposals or use on discovery calls to instantly look more credible.",
    amountCentavos: 50000,
    icon: "🎬",
    turnaround: "3-4 business days",
  },
];

export function getStoreItem(key: string): StoreItem | undefined {
  return STORE_ITEMS.find((i) => i.key === key);
}
