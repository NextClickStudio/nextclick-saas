// Test della normalizzazione URL e dell'import — esegui con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedHostname, isPrivateIp, normalizeUrl, parseCompanyList } from "../lib/url.ts";

test("aggiunge https e toglie gli slash finali", () => {
  assert.equal(normalizeUrl("sito.it"), "https://sito.it");
  assert.equal(normalizeUrl("https://www.Sito.IT/"), "https://www.sito.it");
  assert.equal(normalizeUrl("http://sito.it/shop///"), "http://sito.it/shop");
  assert.equal(normalizeUrl("  sito.it/pagina#top "), "https://sito.it/pagina");
});

test("rifiuta schemi e indirizzi non validi", () => {
  assert.equal(normalizeUrl("ftp://sito.it"), null);
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl(""), null);
  assert.equal(normalizeUrl("non un sito"), null);
});

test("blocca localhost e IP privati", () => {
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("192.168.1.10"), true);
  assert.equal(isBlockedHostname("10.0.0.1"), true);
  assert.equal(isBlockedHostname("169.254.169.254"), true);
  assert.equal(isBlockedHostname("server.local"), true);
  assert.equal(isBlockedHostname("sito.it"), false);
  assert.equal(isPrivateIp("::1"), true);
  assert.equal(isPrivateIp("::ffff:127.0.0.1"), true);
  assert.equal(isPrivateIp("8.8.8.8"), false);
});

test("import: righe valide, duplicati e righe non valide", () => {
  const text = [
    "nome,url",
    "Erboristeria Rossi, erboristeriarossi.it",
    "Beauty Shop, https://erboristeriarossi.it/",
    "Rossi, Bianchi & C., https://rossibianchi.it",
    "riga senza url",
    "Rete interna, http://localhost:3000",
  ].join("\n");
  const r = parseCompanyList(text);
  assert.deepEqual(r.companies, [
    { name: "Erboristeria Rossi", url: "https://erboristeriarossi.it" },
    { name: "Rossi, Bianchi & C.", url: "https://rossibianchi.it" },
  ]);
  assert.equal(r.duplicates.length, 1);
  assert.equal(r.invalid.length, 2);
});

test("import: CSV con punto e virgola", () => {
  const r = parseCompanyList("nome;url\nIntegra Bio;integrabio.com");
  assert.deepEqual(r.companies, [{ name: "Integra Bio", url: "https://integrabio.com" }]);
});
