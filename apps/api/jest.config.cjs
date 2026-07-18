/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  /**
   * Os pacotes do workspace são publicados como ESM puro (`dist/*.js` com `export`),
   * mas o Jest desta app roda em CommonJS. Em runtime o Node 22+ interopera isso via
   * `require(esm)`, mas o Jest não — por isso mapeamos direto para o código-fonte
   * TypeScript, que o ts-jest compila para CommonJS como qualquer outro ficheiro.
   */
  moduleNameMapper: {
    '^@easysignage/license-core$': '<rootDir>/../../../packages/license-core/src/index',
    '^@easysignage/shared-types$': '<rootDir>/../../../packages/shared-types/src/index',
    '^@easysignage/device-protocol$': '<rootDir>/../../../packages/device-protocol/src/index',
    /** Os pacotes-fonte usam imports relativos `./foo.js` (estilo ESM/NodeNext); ao
     * compilar para CommonJS via ts-jest, resolvemos de volta para `./foo` (.ts). */
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
