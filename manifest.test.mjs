import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(here, 'examples');
const manifest = JSON.parse(readFileSync(join(examplesDir, 'manifest.json'), 'utf8'));

const exampleDirs = readdirSync(examplesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
  .map((d) => d.name)
  .sort();

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
    for (const e of manifest.examples) {
      assert.match(e.dir, /^\d{2}-[a-z0-9-]+$/, `bad dir ${e.dir}`);
      assert.equal(typeof e.title, 'string');
      assert(e.title.length > 0, `empty title for ${e.dir}`);
      assert.equal(typeof e.standard, 'string');
      assert(e.standard.length > 0, `empty standard for ${e.dir}`);
      assert.equal(typeof e.standalone, 'boolean', `standalone must be boolean for ${e.dir}`);
      assert.equal(typeof e.teaches, 'string');
      assert(e.teaches.length > 0, `empty teaches for ${e.dir}`);
    }
  });

  it('the standalone examples (11-14) are marked standalone; the dependency examples (01-10) are not', () => {
    const byDir = Object.fromEntries(manifest.examples.map((e) => [e.dir, e]));
    for (const dir of exampleDirs) {
      const n = Number(dir.slice(0, 2));
      assert.equal(byDir[dir].standalone, n >= 11, `${dir} standalone flag is wrong`);
    }
  });
});
