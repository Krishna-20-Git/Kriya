/**
 * Writes the OpenAPI document to docs/api/openapi.json so reviewers can read it
 * (or import it into Postman) without running the server. Needs no database.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from './openapi.js';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../docs/api/openapi.json');
writeFileSync(out, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.log(`Wrote ${out}`);
