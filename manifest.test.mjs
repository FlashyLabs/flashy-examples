import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(here, 'examples');
const manifest = JSON.parse(readFileSync(join(examplesDir, 'manifest.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(examplesDir, 'manifest.schema.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const readme = readFileSync(join(here, 'README.md'), 'utf8');

const exampleDirs = readdirSync(examplesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
  .map((d) => d.name)
  .sort();

const RUNS = schema.properties.examples.items.properties.runs.enum;
const PACKAGE_NAME = new RegExp(schema.properties.examples.items.properties.packages.items.pattern);

/**
 * The bare-specifier packages a file imports: every `from '<spec>'` whose spec is
 * not relative and not a node: builtin, reduced to its package name
 * (`@scope/name` or `name`). Measured from the source, so the manifest's
 * `packages` field is checked against what the example actually does rather
 * than what somebody typed.
 */
function importedPackages(file) {
  const src = readFileSync(file, 'utf8');
  const found = new Set();
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue;
    const parts = spec.split('/');
    found.add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
  }
  return found;
}

describe('examples manifest', () => {
  it('declares the flashy-examples/1 manifest contract', () => {
    assert.equal(manifest.manifest, 'flashy-examples/1');
    assert.match(manifest.generated, /^\d{4}-\d{2}-\d{2}$/);
    assert(Array.isArray(manifest.examples) && manifest.examples.length > 0);
  });

  it('lists exactly the example directories on disk (no missing, no extra)', () => {
    const listed = manifest.examples.map((e) => e.dir).sort();
    assert.deepEqual(listed, exampleDirs);
  });

  it('has no duplicate dir entries', () => {
    const dirs = manifest.examples.map((e) => e.dir);
    assert.equal(new Set(dirs).size, dirs.length);
  });

  it('every listed example has index.mjs, index.test.mjs and README.md', () => {
    for (const e of manifest.examples) {
      for (const f of ['index.mjs', 'index.test.mjs', 'README.md']) {
        assert(existsSync(join(examplesDir, e.dir, f)), `${e.dir}/${f} missing`);
      }
    }
  });

  it('every entry carries the required, well-typed fields', () => {
    const required = schema.properties.examples.items.required;
    for (const e of manifest.examples) {
      for (const k of required) assert(k in e, `${e.dir} lacks required field ${k}`);
      for (const k of Object.keys(e)) {
        assert(k in schema.properties.examples.items.properties, `${e.dir} carries unknown field ${k}`);
      }
      assert.match(e.dir, /^\d{2}-[a-z0-9-]+$/, `bad dir ${e.dir}`);
      assert.equal(typeof e.title, 'string');
      assert(e.title.length > 0, `empty title for ${e.dir}`);
      assert.equal(typeof e.standard, 'string');
      assert(e.standard.length > 0, `empty standard for ${e.dir}`);
      assert.equal(typeof e.standalone, 'boolean', `standalone must be boolean for ${e.dir}`);
      assert(RUNS.includes(e.runs), `${e.dir} runs must be one of ${RUNS.join('|')}, got ${e.runs}`);
      assert(Array.isArray(e.packages), `${e.dir} packages must be an array`);
      assert.equal(new Set(e.packages).size, e.packages.length, `${e.dir} packages has duplicates`);
      for (const p of e.packages) assert.match(p, PACKAGE_NAME, `${e.dir} lists a malformed package name ${p}`);
      assert.equal(typeof e.teaches, 'string');
      assert(e.teaches.length > 0, `empty teaches for ${e.dir}`);
    }
  });

  it('runs, standalone and packages agree with each other', () => {
    for (const e of manifest.examples) {
      const standalone = e.runs === 'standalone';
      assert.equal(e.standalone, standalone, `${e.dir}: standalone flag disagrees with runs=${e.runs}`);
      assert.equal(e.packages.length === 0, standalone, `${e.dir}: runs=${e.runs} but packages=${JSON.stringify(e.packages)}`);
    }
  });

  it('packages is exactly what index.mjs and index.test.mjs import (measured, not typed)', () => {
    for (const e of manifest.examples) {
      const imported = new Set();
      for (const f of ['index.mjs', 'index.test.mjs']) {
        for (const p of importedPackages(join(examplesDir, e.dir, f))) imported.add(p);
      }
      assert.deepEqual([...e.packages].sort(), [...imported].sort(), `${e.dir}: manifest packages differ from imports`);
    }
  });

  it('every package an example needs is declared in package.json dependencies', () => {
    const declared = new Set(Object.keys(pkg.dependencies ?? {}));
    for (const e of manifest.examples) {
      for (const p of e.packages) assert(declared.has(p), `${e.dir} needs ${p}, which package.json does not declare`);
    }
  });

  it('the standalone examples (11-14) are marked standalone; the dependency examples (01-10) are not', () => {
    const byDir = Object.fromEntries(manifest.examples.map((e) => [e.dir, e]));
    for (const dir of exampleDirs) {
      const n = Number(dir.slice(0, 2));
      assert.equal(byDir[dir].standalone, n >= 11, `${dir} standalone flag is wrong`);
    }
  });

  it('test:standalone runs exactly the standalone examples plus this file', () => {
    const script = pkg.scripts['test:standalone'];
    assert(script.includes('manifest.test.mjs'), 'test:standalone must run manifest.test.mjs');
    for (const e of manifest.examples) {
      const listed = script.includes(`examples/${e.dir}/`);
      assert.equal(listed, e.runs === 'standalone', `${e.dir}: runs=${e.runs} but test:standalone ${listed ? 'lists' : 'omits'} it`);
    }
  });

  it("the README's per-example block states the same Runs line the manifest implies", () => {
    for (const e of manifest.examples) {
      const start = readme.indexOf(`\`${e.dir}\``);
      assert(start >= 0, `README has no block for ${e.dir}`);
      const end = readme.indexOf('\n---', start);
      const block = readme.slice(start, end < 0 ? undefined : end);
      const expected = e.runs === 'standalone'
        ? '**Runs:** standalone — nothing to install.'
        : `**Runs:** needs ${e.packages.map((p) => `\`${p}\``).join(', ')}`;
      assert(block.includes(expected), `${e.dir}: README block lacks the line: ${expected}`);
    }
  });
});
