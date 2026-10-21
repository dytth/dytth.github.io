/**
 * dytth_young - Global Configuration & Constants
 * Standardized configuration for easy customization and maintenance.
 */

export const CONFIG = {
  // Remote Database (Gateway API Proxy)
  APPS_SCRIPT_URL: 'https://gateway.dytth.xyz/v1/projects',
  TRACKING_URL: 'https://gateway.dytth.xyz/v1/ping',
  REQUEST_TIMEOUT_MS: 12000,

  // Discord Integration (Lanyard API & Bot)
  DISCORD_ID: '786538506851319818',
  BOT_ID: '1549640197220597780',
  LANYARD_WS: 'wss://api.lanyard.rest/socket',
  LANYARD_REST: 'https://api.lanyard.rest/v1/users',
  DISCORD_CDN_PROFILE: 'https://dcdn.dstn.to/profile',

  // External Links & Identities
  DISCORD_TAG: 'dytth_young',
  PLAYGROUND_URL: 'https://dytth.xyz',
  EMAIL: 'vtbeu02@gmail.com',

  // Animation & Rendering Performance
  TYPEWRITER_SPEED_MS: 32,
  TYPEWRITER_INITIAL_DELAY_MS: 220,
  BIO_TEXT: "Independent developer ready to ship anything: webapps, software, and mobile apps.",
  
  // Starfield Settings
  STARFIELD: {
    MAX_DPR: 1.5,
    DESKTOP_STAR_COUNT: 160,
    MOBILE_STAR_COUNT: 85,
    INTERACTION_RADIUS: 160,
  }
};
