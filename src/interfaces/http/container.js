const path = require('path');
const awilix = require('awilix');
const { InjectionMode } = awilix;

const container = awilix.createContainer({ injectionMode: InjectionMode.PROXY });

// Caminhos relativos à raiz do projeto (não ao cwd) — o seed roda de scripts/
// e o Docker pode subir com outro diretório de trabalho.
const root = path.resolve(__dirname, '../../..');

container.loadModules(
  [
    'src/app/operations/**/*.js',
    'src/app/services/**/*.js',
    'src/infrastructure/repositories/**/*.js',
    'src/interfaces/http/presentation/**/*Controller.js',
  ],
  {
    cwd: root,
    formatName: 'camelCase',
    resolverOptions: {
      injectionMode: InjectionMode.PROXY,
      lifetime: awilix.Lifetime.SINGLETON,
    },
  }
);

module.exports = container;
