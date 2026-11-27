export class Router {
  constructor() { this.routes = []; }

  add(method, pattern, handler, options = {}) {
    const keys = [];
    const escaped = pattern.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
    const source = escaped.replace(/:([a-zA-Z]+)/g, (_, key) => {
      keys.push(key);
      return '([A-Za-z0-9_-]{1,64})';
    });
    this.routes.push({ method, re: new RegExp(`^${source}/?$`), keys, handler, options, pattern });
    return this;
  }

  get(p, h, o) { return this.add('GET', p, h, o); }
  post(p, h, o) { return this.add('POST', p, h, o); }
  patch(p, h, o) { return this.add('PATCH', p, h, o); }
  put(p, h, o) { return this.add('PUT', p, h, o); }
  delete(p, h, o) { return this.add('DELETE', p, h, o); }

  match(method, pathname) {
    let pathExists = false;
    const allowed = new Set();
    for (const route of this.routes) {
      const m = route.re.exec(pathname);
      if (!m) continue;
      pathExists = true;
      allowed.add(route.method);
      const sameMethod = route.method === method || (method === 'HEAD' && route.method === 'GET');
      if (!sameMethod) continue;
      const params = {};
      route.keys.forEach((key, i) => { params[key] = m[i + 1]; });
      return { route, params };
    }
    return pathExists ? { notAllowed: [...allowed] } : null;
  }
}
