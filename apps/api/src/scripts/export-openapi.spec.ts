import { assertValidOpenApiDocument } from './export-openapi';

function validDocument() {
  return {
    openapi: '3.0.0',
    info: { title: 'EasySignage API', version: '1.0' },
    paths: {
      '/health': { get: {} },
    },
    components: {
      securitySchemes: {
        'access-token': { type: 'http', scheme: 'bearer' },
      },
    },
  };
}

describe('assertValidOpenApiDocument', () => {
  it('aceita um documento OpenAPI 3.x bem formado', () => {
    expect(() => assertValidOpenApiDocument(validDocument())).not.toThrow();
  });

  it('rejeita valores que não são objeto', () => {
    expect(() => assertValidOpenApiDocument(null)).toThrow(/não é um objeto/);
    expect(() => assertValidOpenApiDocument('x')).toThrow(/não é um objeto/);
  });

  it('rejeita quando o campo "openapi" está ausente ou não é 3.x', () => {
    const doc = validDocument() as Record<string, unknown>;
    delete doc.openapi;
    expect(() => assertValidOpenApiDocument(doc)).toThrow(/campo "openapi"/);

    const doc2 = { ...validDocument(), openapi: '2.0' };
    expect(() => assertValidOpenApiDocument(doc2)).toThrow(/campo "openapi"/);
  });

  it('rejeita quando "info.title" está ausente', () => {
    const doc = validDocument() as Record<string, unknown>;
    doc.info = {};
    expect(() => assertValidOpenApiDocument(doc)).toThrow(/info\.title/);
  });

  it('rejeita quando "paths" está vazio', () => {
    const doc = { ...validDocument(), paths: {} };
    expect(() => assertValidOpenApiDocument(doc)).toThrow(/paths.*vazio/);
  });

  it('rejeita quando "components.securitySchemes" está vazio', () => {
    const doc = { ...validDocument(), components: { securitySchemes: {} } };
    expect(() => assertValidOpenApiDocument(doc)).toThrow(/securitySchemes/);
  });
});
