// Mini-GitHub für die Admin-Tests: Blobs, Trees, Commits, Branch-Zeiger, Fast-Forward-Prüfung.
export const TOKEN = 'good-token';

export function createMock(initial) {
  const blobs = new Map();
  const trees = new Map([['t0', new Map(Object.entries(initial))]]);
  const commits = new Map([['c0', { tree: 't0', parent: null, message: 'init' }]]);
  let head = 'c0';
  let n = 0;
  const m = { failNextPatch: false, pushAllowed: true, requests: [] };
  const files = () => trees.get(commits.get(head).tree);
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

  m.files = files;
  m.listings = () => JSON.parse(files().get('data/listings.json').toString('utf8')).listings;
  m.commitCount = () => commits.size - 1;
  m.lastMessage = () => commits.get(head).message;
  m.paths = () => [...files().keys()];

  m.handle = async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/repos/RedbullEnso/pc-shop', '');
    const json = (status, body) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    m.requests.push(`${req.method()} ${path}`);
    if (req.headers().authorization !== `Bearer ${TOKEN}`) return json(401, { message: 'Bad credentials' });
    const body = req.method() === 'GET' ? null : req.postDataJSON();

    if (req.method() === 'GET' && path === '') return json(200, { permissions: { push: m.pushAllowed } });
    if (req.method() === 'GET' && path === '/contents/data/listings.json') {
      const f = files().get('data/listings.json');
      return f ? route.fulfill({ status: 200, headers: cors, contentType: 'text/plain', body: f.toString('utf8') }) : json(404, { message: 'Not Found' });
    }
    if (req.method() === 'GET' && path === '/git/ref/heads/main') return json(200, { object: { sha: head } });
    if (req.method() === 'GET' && path.startsWith('/git/commits/')) return json(200, { tree: { sha: commits.get(path.split('/').pop()).tree } });
    if (req.method() === 'POST' && path === '/git/blobs') { const sha = `b${++n}`; blobs.set(sha, body); return json(201, { sha }); }
    if (req.method() === 'POST' && path === '/git/trees') {
      const next = new Map(trees.get(body.base_tree));
      for (const e of body.tree) {
        if (e.sha === null) {
          if (!next.has(e.path)) return json(422, { message: `Löschen nicht möglich, Pfad fehlt: ${e.path}` });
          next.delete(e.path);
        } else {
          const b = blobs.get(e.sha);
          next.set(e.path, Buffer.from(b.content, b.encoding === 'base64' ? 'base64' : 'utf8'));
        }
      }
      const sha = `t${++n}`;
      trees.set(sha, next);
      return json(201, { sha });
    }
    if (req.method() === 'POST' && path === '/git/commits') {
      const sha = `c${++n}`;
      commits.set(sha, { tree: body.tree, parent: body.parents[0], message: body.message });
      return json(201, { sha });
    }
    if (req.method() === 'PATCH' && path === '/git/refs/heads/main') {
      if (m.failNextPatch) { m.failNextPatch = false; return json(422, { message: 'Update is not a fast forward' }); }
      if (commits.get(body.sha).parent !== head) return json(422, { message: 'Update is not a fast forward' });
      head = body.sha;
      return json(200, { object: { sha: head } });
    }
    return json(404, { message: `Mock kennt ${req.method()} ${path} nicht` });
  };
  return m;
}
