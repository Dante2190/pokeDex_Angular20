
export default {
  basePath: '/<pokeDex_Angular20>',
  supportedLocales: {
  "en-US": ""
},
  entryPoints: {
    '': () => import('./main.server.mjs')
  },
};
