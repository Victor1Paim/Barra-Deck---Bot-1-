import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

/**
 * perguntar -> confirma qualquer gravação
 * misto     -> cria sozinho; confirma editar e apagar (padrão)
 * auto      -> faz sozinho, exceto o que é sempre confirmado (apagar, mexer em financeiro)
 * leitura   -> só consulta
 */
export type Modo = "perguntar" | "misto" | "auto" | "leitura";

export interface Grupo {
  id: string;
  nome: string;
  descricao: string;
  /** Restrito: só usuários que listam este grupo (ou "*") enxergam. */
  restrito?: boolean;
  /** Edições neste grupo sempre pedem confirmação, em qualquer modo. */
  sensivel?: boolean;
}

export interface Usuario {
  id: string;
  nome: string;
  /** Número com DDI e DDD, só dígitos. Ex.: 5511999990000 */
  whatsapp?: string;
  email?: string;
  admin?: boolean;
  /** Grupos restritos que pode ver. "*" = todos. */
  grupos?: string[];
  /** Horário do resumo diário (HH:MM). Vazio = sem resumo. */
  resumoDiario?: string;
}

export interface ConfigEmpresa {
  empresa: { nome: string; descricao: string };
  grupos: Grupo[];
  usuarios: Usuario[];
  canais: {
    whatsapp: { ativo: boolean };
    email: { ativo: boolean; remetente?: string };
  };
}

export interface Config {
  apiKey: string;
  modelo: string;
  modo: Modo;
  pastaDados: string;
  pastaConhecimento: string;
  pastaSkills: string;
  fuso: string;
  maxPassos: number;
  /** Chave de criptografia dos dados (vazia = sem criptografia). */
  chaveDados: string;
  smtp: { host: string; porta: number; usuario: string; senha: string; seguro: boolean };
  empresa: ConfigEmpresa;
}

const MODOS: Modo[] = ["perguntar", "misto", "auto", "leitura"];

export const GRUPOS_PADRAO: Grupo[] = [
  { id: "clientes", nome: "Clientes e fornecedores", descricao: "Contatos, histórico, preferências, condições combinadas" },
  { id: "processos", nome: "Processos e reuniões", descricao: "Como fazemos as coisas, decisões, atas de reunião" },
  { id: "financeiro", nome: "Financeiro", descricao: "Contas a pagar e receber, valores, vencimentos", restrito: true, sensivel: true },
  { id: "projetos", nome: "Projetos, tarefas e ideias", descricao: "Trabalho em andamento, responsáveis, ideias" },
  { id: "geral", nome: "Geral", descricao: "O que não se encaixa nos outros grupos" },
];

export function empresaPadrao(): ConfigEmpresa {
  return {
    empresa: { nome: "Minha Empresa", descricao: "" },
    grupos: GRUPOS_PADRAO,
    usuarios: [{ id: "eu", nome: "Eu", admin: true, grupos: ["*"], resumoDiario: "08:00" }],
    canais: { whatsapp: { ativo: false }, email: { ativo: false } },
  };
}

export function carregarEmpresa(arquivo: string): ConfigEmpresa {
  if (!fs.existsSync(arquivo)) return empresaPadrao();
  const lido = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Partial<ConfigEmpresa>;
  const padrao = empresaPadrao();
  const empresa: ConfigEmpresa = {
    empresa: { ...padrao.empresa, ...lido.empresa },
    grupos: lido.grupos?.length ? lido.grupos : padrao.grupos,
    usuarios: lido.usuarios?.length ? lido.usuarios : padrao.usuarios,
    canais: {
      whatsapp: { ...padrao.canais.whatsapp, ...lido.canais?.whatsapp },
      email: { ...padrao.canais.email, ...lido.canais?.email },
    },
  };
  const ids = new Set<string>();
  for (const u of empresa.usuarios) {
    if (ids.has(u.id)) throw new Error(`Usuário repetido em deck.config.json: ${u.id}`);
    ids.add(u.id);
  }
  return empresa;
}

export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const modo = (env.DECK_MODO ?? "misto") as Modo;
  if (!MODOS.includes(modo)) {
    throw new Error(`DECK_MODO inválido: "${modo}". Use: ${MODOS.join(", ")}.`);
  }
  return {
    apiKey: env.OPENAI_API_KEY ?? "",
    modelo: env.OPENAI_MODEL ?? "gpt-5.4-mini",
    modo,
    pastaDados: path.resolve(env.DECK_DADOS ?? "./dados"),
    pastaConhecimento: path.resolve(env.DECK_CONHECIMENTO ?? "./conhecimento"),
    pastaSkills: path.resolve(env.DECK_SKILLS ?? "./skills"),
    fuso: env.DECK_FUSO ?? "America/Sao_Paulo",
    maxPassos: Number(env.DECK_MAX_PASSOS ?? 12),
    chaveDados: env.DECK_CHAVE_DADOS ?? "",
    smtp: {
      host: env.SMTP_HOST ?? "",
      porta: Number(env.SMTP_PORTA ?? 587),
      usuario: env.SMTP_USUARIO ?? "",
      senha: env.SMTP_SENHA ?? "",
      seguro: env.SMTP_SEGURO === "true",
    },
    empresa: carregarEmpresa(path.resolve(env.DECK_CONFIG ?? "./deck.config.json")),
  };
}

export function buscarUsuario(config: Config, id: string | undefined): Usuario {
  const usuarios = config.empresa.usuarios;
  const u = id ? usuarios.find((x) => x.id === id) : usuarios.find((x) => x.admin) ?? usuarios[0];
  if (!u) throw new Error(`Usuário "${id}" não existe em deck.config.json.`);
  return u;
}

/** O usuário pode ver/usar este grupo? */
export function podeVerGrupo(config: Config, usuario: Usuario, grupoId: string): boolean {
  const g = config.empresa.grupos.find((x) => x.id === grupoId);
  if (!g) return false;
  if (!g.restrito) return true;
  const permitidos = usuario.grupos ?? [];
  return permitidos.includes("*") || permitidos.includes(grupoId);
}
