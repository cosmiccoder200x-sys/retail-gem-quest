// Editable site configuration — update these values for your business
// No hardcoded claims; values are marked editable where business info varies

export const siteConfig = {
  name: "GullyGadget",
  shortName: "GullyGadget",
  url: "https://gullygadget.com", // EDIT: set to production domain
  email: "support@gullygadget.com", // EDIT: support email
  phone: "+91-90000-00000", // EDIT: business phone (optional)
  address: "GullyGadget Tech Pvt Ltd, India", // EDIT: registered address
  description: "Trending home and lifestyle gadgets under ₹999 — quality tested, free shipping, Cash on Delivery.",
  locale: "en-IN",
  // Social (optional, leave empty if not configured)
  social: {
    twitter: "",
    instagram: "",
    facebook: "",
  },
} as const;
