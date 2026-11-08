import fs from "node:fs";
import path from "node:path";
import { cifrar, decifrar, derivarChave, estaCifrado } from "./cripto.js";

const chaves = new Map<string, Buffer>();
function chaveDe(segredo: string): Buffer {
  let c = chaves.get(segredo);
  if (!c) chaves.set(segredo, (c = derivarChave(segredo)));
  return c;
}

/** Trava entre processos (CLI e serviço podem rodar juntos). */
function comTrava<R>(arquivo: string, fn: () => R): R {
  const trava = `${arquivo}.lock`;
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const limite = Date.now() + 5000;
  for (;;) {
    try {
      fs.mkdirSync(trava);
      break;
    } catch (e: any) {
      if (e.code !== "EEXIST") throw e;
      // Trava velha (processo morreu no meio): libera depois de 30s.
      try {
        if (Date.now() - fs.statSync(trava).mtimeMs > 30_000) fs.rmSync(trava, { recursive: true, force: true });
      } catch {}
      if (Date.now() > limite) throw new Error(`Arquivo ocupado: ${path.basename(arquivo)}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(trava, { recursive: true, force: true });
  }
}

/**
 * Coleção persistida em JSON, opcionalmente criptografada (AES-256-GCM).
 * Arquivos antigos sem criptografia são cifrados na próxima gravação.
 */
export class Colecao<T extends { id: string }> {
  constructor(
    private arquivo: string,
    private segredo = "",
  ) {}

  ler(): T[] {
    if (!fs.existsSync(this.arquivo)) return [];
    let conteudo = fs.readFileSync(this.arquivo, "utf8");
    if (estaCifrado(conteudo)) {
      if (!this.segredo) throw new Error("Os dados estão criptografados: defina DECK_CHAVE_DADOS no .env.");
      conteudo = decifrar(conteudo, chaveDe(this.segredo));
    }
    return JSON.parse(conteudo) as T[];
  }

  private escrever(itens: T[]): void {
    const json = JSON.stringify(itens, null, 2);
    const tmp = `${this.arquivo}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, this.segredo ? cifrar(json, chaveDe(this.segredo)) : json, "utf8");
    fs.renameSync(tmp, this.arquivo);
  }

  /** Lê, altera e grava de forma atômica (com trava). */
  transacao<R>(fn: (itens: T[]) => { itens: T[]; resultado: R }): R {
    return comTrava(this.arquivo, () => {
      const { itens, resultado } = fn(this.ler());
      this.escrever(itens);
      return resultado;
    });
  }

  gravar(itens: T[]): void {
    this.transacao(() => ({ itens, resultado: undefined }));
  }

  adicionar(item: T): T {
    return this.transacao((itens) => ({ itens: [...itens, item], resultado: item }));
  }

  atualizar(id: string, mudar: (item: T) => T): T | undefined {
    return this.transacao((itens) => {
      const i = itens.findIndex((x) => x.id === id);
      if (i < 0) return { itens, resultado: undefined };
      itens[i] = mudar(itens[i]);
      return { itens, resultado: itens[i] };
    });
  }

  remover(id: string): boolean {
    return this.transacao((itens) => {
      const resto = itens.filter((x) => x.id !== id);
      return { itens: resto, resultado: resto.length !== itens.length };
    });
  }
}

export function novoId(prefixo: string): string {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
