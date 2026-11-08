import fs from "node:fs";
import path from "node:path";

/** Coleção simples persistida em um arquivo JSON. Suficiente para começar; dá para trocar por SQLite depois. */
export class Colecao<T extends { id: string }> {
  constructor(private arquivo: string) {}

  ler(): T[] {
    if (!fs.existsSync(this.arquivo)) return [];
    return JSON.parse(fs.readFileSync(this.arquivo, "utf8")) as T[];
  }

  gravar(itens: T[]): void {
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    const tmp = `${this.arquivo}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(itens, null, 2), "utf8");
    fs.renameSync(tmp, this.arquivo);
  }

  adicionar(item: T): T {
    const itens = this.ler();
    itens.push(item);
    this.gravar(itens);
    return item;
  }

  atualizar(id: string, mudar: (item: T) => T): T | undefined {
    const itens = this.ler();
    const i = itens.findIndex((x) => x.id === id);
    if (i < 0) return undefined;
    itens[i] = mudar(itens[i]);
    this.gravar(itens);
    return itens[i];
  }

  remover(id: string): boolean {
    const itens = this.ler();
    const resto = itens.filter((x) => x.id !== id);
    if (resto.length === itens.length) return false;
    this.gravar(resto);
    return true;
  }
}

export function novoId(prefixo: string): string {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
