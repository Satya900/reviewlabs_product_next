// Shapes and defaults for the automation form. Kept out of the client
// component so server pages can use the default values too.

export type MediaOption = { id: string; thumb?: string; caption?: string };
export type AutomationDraft = {
  id?: string;
  name: string;
  active: boolean;
  postScope: "all" | "selected";
  media: MediaOption[];
  matchMode: "keywords" | "any";
  keywords: string;
  dmMessage: string;
  linkKind: "none" | "page" | "url";
  pageId: string;
  linkUrl: string;
  publicReplyEnabled: boolean;
  publicReplies: string[];
};

export const emptyDraft: AutomationDraft = {
  name: "",
  active: true,
  postScope: "selected",
  media: [],
  matchMode: "keywords",
  keywords: "",
  dmMessage: "Hey! Thanks for your comment. Here's the link you asked for 👇",
  linkKind: "page",
  pageId: "",
  linkUrl: "",
  publicReplyEnabled: true,
  publicReplies: ["Sent you a DM 📩", "Check your DMs!", "Done, check your inbox ✅"],
};
