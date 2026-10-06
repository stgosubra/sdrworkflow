import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST_QUAL, WORKING_FOLLOWUP, LUKEWARM, REACTIVATION } from './copy.mjs';

test('POST_QUAL has en/fr/es with subject + body(name)', () => {
  for (const lang of ['en', 'fr', 'es']) {
    assert.equal(typeof POST_QUAL[lang].subject, 'string');
    assert(POST_QUAL[lang].subject.length > 0);
    assert.equal(typeof POST_QUAL[lang].body, 'function');
    const b = POST_QUAL[lang].body('Alex');
    assert(b.length > 0);
    assert(b.includes('Alex'), `${lang} body should interpolate the name`);
  }
});

test('English copy is the Post-Qual "after our call" message', () => {
  assert.match(POST_QUAL.en.subject, /after our call/i);
  assert.match(POST_QUAL.en.body('X'), /follow up on the project/i);
});

test('French copy is formal (vous) and register-appropriate', () => {
  const b = POST_QUAL.fr.body('X');
  assert.match(b, /vous/);
  assert.match(POST_QUAL.fr.subject, /échange/i);
});

test('Spanish copy is informal (tu) and register-appropriate', () => {
  const b = POST_QUAL.es.body('X');
  assert.match(b, /\btu\b/);
  assert.match(POST_QUAL.es.subject, /seguimiento/i);
});

test('REACTIVATION has en/fr/es with subject + body(name)', () => {
  for (const lang of ['en', 'fr', 'es']) {
    assert.equal(typeof REACTIVATION[lang].subject, 'string');
    assert(REACTIVATION[lang].subject.length > 0);
    assert.equal(typeof REACTIVATION[lang].body, 'function');
    const b = REACTIVATION[lang].body('Alex');
    assert(b.includes('Alex'), `${lang} body should interpolate the name`);
  }
});

test('REACTIVATION FR is formal (vous), ES is informal (tu), registers match', () => {
  assert.match(REACTIVATION.fr.subject, /Toujours d'actualité/);
  assert.match(REACTIVATION.fr.body('X'), /Vous aviez/);
  assert.match(REACTIVATION.es.subject, /Sigues valorando opciones/);
  assert.match(REACTIVATION.es.body('X'), /\btu\b/);
  assert.doesNotMatch(REACTIVATION.es.body('X'), /\busted\b/i);
  assert.match(REACTIVATION.en.subject, /Checking in on your setup/);
});

// The scheduler URL is deliberately absent from every body - Santiago hyperlinks the bare
// call-to-action word in Gmail by hand (the compose &body= param is plain text). Guard both halves.
test('every link-bearing block ends on a bare localized CTA, never a raw URL', () => {
  const CTA = { en: 'Book here', fr: 'Réservez ici', es: 'Reserva aquí' };
  for (const [blockName, block] of Object.entries({ WORKING_FOLLOWUP, LUKEWARM, REACTIVATION })) {
    for (const lang of ['en', 'fr', 'es']) {
      const b = block[lang].body('Alex');
      assert(!/https?:\/\//.test(b), `${blockName}.${lang} must not contain a raw URL`);
      assert(
        b.split('\n').includes(CTA[lang]),
        `${blockName}.${lang} needs "${CTA[lang]}" alone on its own line`
      );
    }
  }
});
