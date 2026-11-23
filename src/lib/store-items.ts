// The VA Document Store (/dashboard/store) - done-for-you VA application
// materials, open to anyone with a free account, enrolled or not (see
// README "VA Document Store"). Each key is referenced by
// api/payment/create-order-checkout and stored verbatim on the storeOrders
// row (itemKey/itemLabel), so changing a `key` here orphans any existing
// orders placed under the old key - add a new item instead of renaming one
// that's already been ordered.
//
// NOTE: amountCentavos below are placeholder prices (this file had to be
// reconstructed from scratch - the originals were lost). Please check these
// against what you actually charge and adjust in Railway/this file if
// they're off before this goes live again.
export interface StoreItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  amountCentavos: number;
  turnaround: string;
}

export const STORE_ITEMS: StoreItem[] = [
  {
    key: "cv-resume",
    label: "VA Resume / CV",
    description:
      "A done-for-you, ATS-friendly resume written around your own background, tailored to land VA roles on Upwork, OnlineJobs.ph, and direct-client applications.",
    icon: "📄",
    amountCentavos: 29900, // ₱299.00
    turnaround: "2-3 business days",
  },
  {
    key: "portfolio",
    label: "VA Portfolio",
    description:
      "A clean, professional portfolio page showcasing your skills and sample work - the single link you drop into every application and proposal.",
    icon: "🗂️",
    amountCentavos: 39900, // ₱399.00
    turnaround: "3-4 business days",
  },
  {
    key: "cover-letter",
    label: "Cover Letter",
    description:
      "A personalized cover letter / proposal template that actually gets opened, written around your strengths and the kind of clients you want to work with.",
    icon: "✉️",
    amountCentavos: 19900, // ₱199.00
    turnaround: "1-2 business days",
  },
  {
    key: "invoice-format",
    label: "Invoice Format",
    description:
      "A professional, ready-to-use invoice template for billing your clients - just fill in the details every time you get paid.",
    icon: "🧾",
    amountCentavos: 14900, // ₱149.00
    turnaround: "1-2 business days",
  },
  {
    key: "intro-presentation",
    label: "Intro Presentation",
    description:
      "A short \"About Me\" slide deck you can send to prospective clients or use on a discovery call to introduce your services professionally.",
    icon: "📊",
    amountCentavos: 29900, // ₱299.00
    turnaround: "2-3 business days",
  },
];

export function getStoreItem(key: string): StoreItem | undefined {
  return STORE_ITEMS.find((item) => item.key === key);
}
