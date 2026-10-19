// Schmaler GitHub-Client: liest data/listings.json und speichert Änderungen als EIN Commit
// (Git-Data-API: Blobs -> Tree -> Commit -> Branch vorschieben). Sonst nichts, keine Fremdskripte.

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `HTTP ${status}`);
    this.status = status;
  }
}

export class Repo {
  constructor({ owner, name, branch }, token) {
    this.base = `https://api.github.com/repos/${owner}/${name}`;
    this.branch = branch;
    this.token = token;
  }

  async api(path, { method = 'GET', body, raw = false } = {}) {
    const res = await fetch(this.base + path, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message; } catch { /* kein JSON */ }
      throw new ApiError(res.status, detail);
    }
    return raw ? res.text() : res.json();
  }

  info() {
    return this.api('');
  }

  async readListings() {
    try {
      const text = await this.api(`/contents/data/listings.json?ref=${encodeURIComponent(this.branch)}`, { raw: true });
      const data = JSON.parse(text);
      return { updated: data.updated, listings: Array.isArray(data.listings) ? data.listings : [] };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return { updated: null, listings: [] };
      throw err;
    }
  }

  // files: [{ path, content, encoding: 'utf-8' | 'base64' }], deletions: [path]
  async commit(message, files, deletions = []) {
    const ref = await this.api(`/git/ref/heads/${this.branch}`);
    const parent = ref.object.sha;
    const parentCommit = await this.api(`/git/commits/${parent}`);

    const entries = [];
    for (const f of files) {
      const blob = await this.api('/git/blobs', { method: 'POST', body: { content: f.content, encoding: f.encoding || 'utf-8' } });
      entries.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    for (const path of deletions) entries.push({ path, mode: '100644', type: 'blob', sha: null });

    const tree = await this.api('/git/trees', { method: 'POST', body: { base_tree: parentCommit.tree.sha, tree: entries } });
    const commit = await this.api('/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [parent] } });
    // Kein force: hat zwischenzeitlich jemand gespeichert, schlägt das fehl statt fremde Änderungen zu überschreiben
    await this.api(`/git/refs/heads/${this.branch}`, { method: 'PATCH', body: { sha: commit.sha } });
    return commit.sha;
  }
}
