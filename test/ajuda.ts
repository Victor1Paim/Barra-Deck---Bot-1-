import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { carregarConfig, type Config, type Usuario } from "../src/config.js";
import type { Contexto } from "../src/tools/tipos.js";

export const VICTOR: Usuario = { id: "victor", nome: "Victor", admin: true, grupos: ["*"], resumoDiario: "08:00" };
export const ANA: Usuario = { id: "ana", nome: "Ana", resumoDiario: "08:00" };

export function configTemp(extra: Record<string, string> = {}): Config {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-"));
  fs.mkdirSync(path.join(dir, "conhecimento"));
  const config = carregarConfig({
    DECK_DADOS: path.join(dir, "dados"),
    DECK_CONHECIMENTO: path.join(dir, "conhecimento"),
    DECK_CONFIG: path.join(dir, "nao-existe.json"),
    ...extra,
  });
  config.empresa.usuarios = [VICTOR, ANA];
  return config;
}

export function ctx(config: Config, usuario: Usuario, agora: Date | (() => Date) = new Date("2026-11-08T12:00:00Z")): Contexto {
  return { config, usuario, agora: typeof agora === "function" ? agora : () => agora };
}
