import crypto from "node:crypto";

const ALG = "aes-256-gcm";

interface Envelope {
  deck: 1;
  iv: string;
  tag: string;
  dados: string;
}

/** Deriva uma chave de 32 bytes de qualquer texto (frase-senha ou chave gerada). */
export function derivarChave(segredo: string): Buffer {
  return crypto.scryptSync(segredo, "deck-one/v1", 32);
}

export function cifrar(texto: string, chave: Buffer): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALG, chave, iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  const env: Envelope = { deck: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), dados: dados.toString("base64") };
  return JSON.stringify(env);
}

export function estaCifrado(conteudo: string): boolean {
  try {
    return (JSON.parse(conteudo) as Envelope).deck === 1;
  } catch {
    return false;
  }
}

export function decifrar(conteudo: string, chave: Buffer): string {
  const env = JSON.parse(conteudo) as Envelope;
  const d = crypto.createDecipheriv(ALG, chave, Buffer.from(env.iv, "base64"));
  d.setAuthTag(Buffer.from(env.tag, "base64"));
  try {
    return Buffer.concat([d.update(Buffer.from(env.dados, "base64")), d.final()]).toString("utf8");
  } catch {
    throw new Error("Não foi possível abrir os dados: DECK_CHAVE_DADOS errada.");
  }
}

export function gerarChave(): string {
  return crypto.randomBytes(32).toString("base64url");
}
