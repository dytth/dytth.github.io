import { CONFIG } from './config.js';

const ACTIVITY_TYPES = {
  0: 'Playing',
  1: 'Streaming',
  2: 'Listening to',
  3: 'Watching',
  5: 'Competing in'
};

/**
 * DiscordProfile - Real-time Discord Presence & Profile Integration via Lanyard
 */
export class DiscordProfile {
  constructor(id, botId) {
    this.id = id || CONFIG.DISCORD_ID;
    this.botId = botId || CONFIG.BOT_ID;
    this.startedAt = 0;
    this.socket = null;
    this.heartbeat = null;
    this.reconnect = null;
    this.elapsedTimer = null;
    this.stopped = false;

    // Cache frequent DOM elements
    this.dom = {
      name: document.getElementById('discordName'),
      handle: document.getElementById('discordHandle'),
      avatar: document.getElementById('discordAvatar'),
      banner: document.getElementById('discordMiniBanner'),
      presenceDot: document.getElementById('presenceDot'),
      activityText: document.getElementById('activityText'),
      playingTitle: document.getElementById('playingTitle'),
      botIcon: document.getElementById('botActivityIcon'),
      elapsed: document.getElementById('activityElapsed')
    };
  }

  start() {
    this.refresh();
    this.connect();
    this.elapsedTimer = setInterval(() => this.updateElapsed(), 1000);
  }

  stop() {
    this.stopped = true;
    clearInterval(this.heartbeat);
    clearInterval(this.elapsedTimer);
    clearTimeout(this.reconnect);
    this.socket?.close();
  }

  async getJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async refresh() {
    if (this.stopped) return;
    const stamp = Date.now();
    try {
      const [presence, profile, bot] = await Promise.allSettled([
        this.getJson(`${CONFIG.LANYARD_REST}/${this.id}?_=${stamp}`),
        this.getJson(`${CONFIG.DISCORD_CDN_PROFILE}/${this.id}?_=${stamp}`),
        this.getJson(`${CONFIG.DISCORD_CDN_PROFILE}/${this.botId}?_=${stamp}`)
      ]);

      if (presence.status === 'fulfilled' && presence.value?.success) {
        this.applyPresence(presence.value.data);
      }
      if (profile.status === 'fulfilled' && profile.value) {
        this.applyProfile(profile.value);
      }
      if (bot.status === 'fulfilled' && bot.value) {
        this.applyBotProfile(bot.value);
      }
    } catch (e) {
      console.warn('[dytth_young] Discord profile refresh warning:', e);
    }
  }

  applyProfile(data) {
    const user = data?.user;
    if (!user) return;
    this.setAvatar(user.avatar);

    if (this.dom.name) {
      this.dom.name.textContent = user.global_name || user.username || 'dytth';
    }
    if (this.dom.handle) {
      this.dom.handle.textContent = `${user.username || CONFIG.DISCORD_TAG} · ${data.user_profile?.pronouns || 'dycon'}`;
    }

    const banner = user.banner || data.user_profile?.banner;
    if (banner && this.dom.banner) {
      const ext = banner.startsWith('a_') ? 'gif' : 'png';
      this.dom.banner.style.backgroundImage = `url("https://cdn.discordapp.com/banners/${this.id}/${banner}.${ext}?size=1024")`;
      this.dom.banner.style.backgroundSize = 'cover';
      this.dom.banner.style.backgroundPosition = 'center';
    }
  }

  setAvatar(hash) {
    if (!hash || !this.dom.avatar) return;
    const ext = hash.startsWith('a_') ? 'gif' : 'png';
    this.dom.avatar.src = `https://cdn.discordapp.com/avatars/${this.id}/${hash}.${ext}?size=256`;
  }

  applyBotProfile(data) {
    const user = data?.user;
    if (!user?.avatar || !this.dom.botIcon || this.dom.botIcon.dataset.custom) return;
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    this.dom.botIcon.src = `https://cdn.discordapp.com/avatars/${this.botId}/${user.avatar}.${ext}?size=256`;
  }

  applyPresence(data) {
    if (!data) return;
    const status = data.discord_status || 'offline';
    if (this.dom.presenceDot) {
      this.dom.presenceDot.className = `presence-dot ${status}`;
      this.dom.presenceDot.title = status[0].toUpperCase() + status.slice(1);
    }
    this.setAvatar(data.discord_user?.avatar);
    const activity = (data.activities || []).find(item => item.type !== 4);
    this.applyActivity(activity);
  }

  applyActivity(activity) {
    if (!activity) {
      if (this.dom.activityText) this.dom.activityText.textContent = 'No current activity';
      if (this.dom.playingTitle) this.dom.playingTitle.textContent = 'Activity';
      this.startedAt = 0;
      this.updateElapsed();
      return;
    }

    if (this.dom.activityText) {
      this.dom.activityText.textContent = activity.details
        ? `${activity.name} · ${activity.details}`
        : activity.state
          ? `${activity.name} · ${activity.state}`
          : activity.name;
    }

    if (this.dom.playingTitle) {
      this.dom.playingTitle.textContent = `${ACTIVITY_TYPES[activity.type] || 'Playing'} · ${activity.assets?.large_text || activity.name}`;
    }

    if (this.dom.botIcon && activity.assets?.large_image) {
      const img = activity.assets.large_image;
      if (img.startsWith('mp:external/')) {
        this.dom.botIcon.src = `https://media.discordapp.net/external/${img.replace('mp:external/', '')}`;
        this.dom.botIcon.dataset.custom = '1';
      } else if (activity.application_id) {
        this.dom.botIcon.src = `https://cdn.discordapp.com/app-assets/${activity.application_id}/${img}.png`;
        this.dom.botIcon.dataset.custom = '1';
      }
    }

    this.startedAt = Number(activity.timestamps?.start) || 0;
    this.updateElapsed();
  }

  updateElapsed() {
    if (document.hidden || !this.dom.elapsed) return;
    if (!this.startedAt) {
      this.dom.elapsed.textContent = 'Live now';
      return;
    }
    const total = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    this.dom.elapsed.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  connect() {
    if (this.stopped || document.hidden) return;
    clearTimeout(this.reconnect);

    try {
      this.socket = new WebSocket(CONFIG.LANYARD_WS);
      this.socket.addEventListener('message', event => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.op === 1) {
            clearInterval(this.heartbeat);
            this.heartbeat = setInterval(() => {
              if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ op: 3 }));
              }
            }, msg.d.heartbeat_interval);
            this.socket.send(JSON.stringify({ op: 2, d: { subscribe_to_id: this.id } }));
          } else if (msg.op === 0 && (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE')) {
            this.applyPresence(msg.d);
          }
        } catch (err) {
          console.warn('[dytth_young] Discord packet error:', err);
        }
      });

      this.socket.addEventListener('close', () => {
        clearInterval(this.heartbeat);
        if (!this.stopped) {
          this.reconnect = setTimeout(() => this.connect(), 5000);
        }
      });

      this.socket.addEventListener('error', () => this.socket?.close());
    } catch (err) {
      console.warn('[dytth_young] WebSocket connection failed:', err);
    }
  }

  resume() {
    if (this.stopped) return;
    this.refresh();
    if (!this.socket || this.socket.readyState > 1) {
      this.connect();
    }
  }
}
