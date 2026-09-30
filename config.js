/**
 * RefHub - Configuration Settings
 * 
 * You can set DEFAULT_GIST_ID here before deploying to free hosting (Vercel, Netlify, Cloudflare, GitHub Pages)
 * so all visitors automatically load your live referral list without any setup.
 * You can also change the Gist ID anytime via the Admin Settings modal in your browser!
 */

export const CONFIG = {
  // Public GitHub Gist ID holding your links.json.
  // Leave empty ("") to start with sample data, or paste your Gist ID here.
  DEFAULT_GIST_ID: "fb001da04d2cdc464fee07bfecb06f8e",

  // Site branding
  SITE_NAME: "RefKey // AI Directory",
  SITE_SUBTITLE: "Real-time curated directory of AI API referral links, free credits, and routers.",

  // Default category tags (custom categories can also be added dynamically)
  DEFAULT_CATEGORIES: [
    { key: "Top Sites", label: "Top Sites" },
    { key: "AI Routers", label: "AI Routers" },
    { key: "Free Tools", label: "Free Tools" },
    { key: "Cheap Pricing", label: "Cheap Pricing" },
    { key: "Regional Routers", label: "Regional" },
    { key: "Dead / Inactive", label: "Dead / Inactive" }
  ],

  // Status definitions with display labels and visual indicator classes
  STATUS_MAP: {
    active: {
      label: "Active",
      badgeCls: "status-active",
      dotCls: "dot-active",
      description: "Working & currently giving bonus/credits"
    },
    down: {
      label: "Down",
      badgeCls: "status-down",
      dotCls: "dot-down",
      description: "Temporary API or website outage"
    },
    unconfirmed: {
      label: "Unconfirmed",
      badgeCls: "status-unconfirmed",
      dotCls: "dot-unconfirmed",
      description: "Pending verification or new offer"
    },
    dead: {
      label: "Dead",
      badgeCls: "status-dead",
      dotCls: "dot-dead",
      description: "Offer expired, bonus ended, or domain expired"
    },
    fake: {
      label: "Fake",
      badgeCls: "status-fake",
      dotCls: "dot-fake",
      description: "Misleading claims or unfulfilled rewards"
    }
  },

  // Storage keys for browser localStorage
  STORAGE_KEYS: {
    THEME: "refkey_theme",
    ADMIN_TOKEN: "refkey_gh_token",
    GIST_ID: "refkey_gist_id",
    LOCAL_LINKS: "refkey_local_links",
    USE_LOCAL_CACHE: "refkey_use_local_cache"
  },

  // File names stored inside the GitHub Gist
  GIST_DATA_FILE: "links.json",
  GIST_META_FILE: "metadata.json"
};
