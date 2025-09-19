
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/<pokeDex_Angular20>/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "redirectTo": "/%3CpokeDex_Angular20%3E/pokemon",
    "route": "/%3CpokeDex_Angular20%3E"
  },
  {
    "renderMode": 2,
    "route": "/%3CpokeDex_Angular20%3E/pokemon"
  },
  {
    "renderMode": 2,
    "redirectTo": "/%3CpokeDex_Angular20%3E/pokemon",
    "route": "/%3CpokeDex_Angular20%3E/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 10426, hash: 'e6f234385b8d101da4ba76e37471f576976b13b95aeeddf8c3a55ca7d63cb4f4', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 974, hash: '731e6361a7ddf668508f4bd964bea6e6696f977ee08029d5003f288ada595f71', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-5ZOJAWP2.css': {size: 38756, hash: 'ncyHnCz4RB4', text: () => import('./assets-chunks/styles-5ZOJAWP2_css.mjs').then(m => m.default)}
  },
};
