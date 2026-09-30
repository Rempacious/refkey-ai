/**
 * Gist Service - Handles GitHub Gist REST API calls
 * 
 * Provides:
 * - Fetching link data from a public GitHub Gist
 * - Updating existing Gist via GitHub Personal Access Token (PAT)
 * - Creating a new Gist automatically with initial data
 * - Verifying GitHub PAT authentication
 */

import { CONFIG } from './config.js';

export class GistService {
  /**
   * Verify GitHub Token and get user profile
   */
  static async verifyToken(token) {
    if (!token) return { valid: false, error: 'Token is required' };
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token.trim()}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { valid: false, error: data.message || `HTTP ${res.status}` };
      }
      const user = await res.json();
      return { valid: true, user };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  /**
   * Fetch links and metadata from a GitHub Gist
   * Uses cache-busting to ensure visitors get the latest real-time data
   */
  static async fetchGist(gistId) {
    if (!gistId) throw new Error('No Gist ID provided');
    const cleanId = gistId.trim().replace(/^https?:\/\/gist\.github\.com\/[^/]+\//, '');
    const url = `https://api.github.com/gists/${cleanId}?t=${Date.now()}`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to load Gist (${res.status} ${res.statusText})`);
    }

    const gist = await res.json();
    const dataFile = gist.files?.[CONFIG.GIST_DATA_FILE];
    const metaFile = gist.files?.[CONFIG.GIST_META_FILE];

    if (!dataFile || !dataFile.content) {
      // In case user named it something else or it's empty, try finding any .json file
      const anyJson = Object.values(gist.files || {}).find(f => f.filename.endsWith('.json'));
      if (anyJson && anyJson.content) {
        return {
          links: JSON.parse(anyJson.content),
          metadata: metaFile && metaFile.content ? JSON.parse(metaFile.content) : {},
          gistId: cleanId,
          updatedAt: gist.updated_at
        };
      }
      throw new Error(`Gist does not contain ${CONFIG.GIST_DATA_FILE}`);
    }

    let links = [];
    try {
      links = JSON.parse(dataFile.content);
    } catch (err) {
      throw new Error(`Invalid JSON inside ${CONFIG.GIST_DATA_FILE}: ${err.message}`);
    }

    let metadata = {};
    if (metaFile && metaFile.content) {
      try {
        metadata = JSON.parse(metaFile.content);
      } catch (e) {
        console.warn('Could not parse metadata.json:', e);
      }
    }

    return {
      links,
      metadata,
      gistId: cleanId,
      updatedAt: gist.updated_at
    };
  }

  /**
   * Update Gist content with new links and metadata
   * Requires GitHub PAT with 'gist' scope
   */
  static async updateGist(gistId, token, links, metadata = {}) {
    if (!gistId) throw new Error('No Gist ID configured');
    if (!token) throw new Error('GitHub Personal Access Token is required to save changes');

    const cleanId = gistId.trim().replace(/^https?:\/\/gist\.github\.com\/[^/]+\//, '');
    const cleanToken = token.trim();

    const metaPayload = {
      lastUpdated: new Date().toISOString(),
      itemCount: links.length,
      ...metadata
    };

    const files = {};
    files[CONFIG.GIST_DATA_FILE] = {
      content: JSON.stringify(links, null, 2)
    };
    files[CONFIG.GIST_META_FILE] = {
      content: JSON.stringify(metaPayload, null, 2)
    };

    const res = await fetch(`https://api.github.com/gists/${cleanId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: `${CONFIG.SITE_NAME} - Updated ${new Date().toLocaleString()}`,
        files
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub API error: HTTP ${res.status}`);
    }

    const updatedGist = await res.json();
    return {
      success: true,
      gistId: cleanId,
      updatedAt: updatedGist.updated_at
    };
  }

  /**
   * Create a new GitHub Gist with initial links and metadata
   */
  static async createGist(token, links = [], metadata = {}, isPublic = true) {
    if (!token) throw new Error('GitHub Personal Access Token is required');
    const cleanToken = token.trim();

    const metaPayload = {
      lastUpdated: new Date().toISOString(),
      itemCount: links.length,
      version: 1,
      ...metadata
    };

    const files = {};
    files[CONFIG.GIST_DATA_FILE] = {
      content: JSON.stringify(links, null, 2)
    };
    files[CONFIG.GIST_META_FILE] = {
      content: JSON.stringify(metaPayload, null, 2)
    };

    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: `${CONFIG.SITE_NAME} Data Repository`,
        public: isPublic,
        files
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub API error: HTTP ${res.status}`);
    }

    const newGist = await res.json();
    return {
      success: true,
      gistId: newGist.id,
      htmlUrl: newGist.html_url,
      updatedAt: newGist.updated_at
    };
  }
}
