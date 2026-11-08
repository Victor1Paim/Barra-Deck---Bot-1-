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

export interface Unidade {
  id: string;
  nome: string;
}

/** Valor de unidade que vale para todas as casas. */
export const TODAS = "todas";

/**
 * Grupo de WhatsApp liberado para o bot. Quem estiver no grupo pode falar com ele,
 * mas o grupo só enxerga as pastas listadas — independente da pessoa.
 */
export interface GrupoWhatsApp {
  /** JID do grupo, ex.: 120363000000000000@g.us (o serviço lista os seus ao conectar). */
  jid: string;
  nome: string;
  /** Pastas de dados (ids de "grupos") que este grupo pode ver e usar. */
  pastas: string[];
  /** Restringe a uma unidade (ex.: "lounge"). Vazio = todas. */
  unidade?: string;
  /** "mencao" (padrão): responde quando chamam o bot. "tudo": lê e responde tudo. */
  responder?: "mencao" | "tudo";
  resumoDiario?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  /** Lista fechada de pastas visíveis (usado nos grupos de WhatsApp). Se existir, vale só ela. */
  pastas?: string[];
  /** Restringe a uma unidade. */
  unidade?: string;
  /** JID do grupo de WhatsApp, quando o "usuário" é um grupo. */
  whatsappGrupo?: string;
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
  unidades: Unidade[];
  grupos: Grupo[];
  usuarios: Usuario[];
  gruposWhatsApp: GrupoWhatsApp[];
  canais: {
    /** conversaPrivada: usuários cadastrados também podem falar no privado (padrão true). */
    whatsapp: { ativo: boolean; conversaPrivada?: boolean };
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
    unidades: [],
    grupos: GRUPOS_PADRAO,
    usuarios: [{ id: "eu", nome: "Eu", admin: true, grupos: ["*"], resumoDiario: "08:00" }],
    gruposWhatsApp: [],
    canais: { whatsapp: { ativo: false, conversaPrivada: true }, email: { ativo: false } },
  };
}

export function carregarEmpresa(arquivo: string): ConfigEmpresa {
  if (!fs.existsSync(arquivo)) return empresaPadrao();
  const lido = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Partial<ConfigEmpresa>;
  const padrao = empresaPadrao();
  const empresa: ConfigEmpresa = {
    empresa: { ...padrao.empresa, ...lido.empresa },
    unidades: lido.unidades ?? [],
    grupos: lido.grupos?.length ? lido.grupos : padrao.grupos,
    usuarios: lido.usuarios?.length ? lido.usuarios : padrao.usuarios,
    gruposWhatsApp: lido.gruposWhatsApp ?? [],
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
  const pastas = new Set(empresa.grupos.map((g) => g.id));
  const unidades = new Set(empresa.unidades.map((u) => u.id));
  for (const g of empresa.gruposWhatsApp) {
    const erradas = g.pastas.filter((p) => !pastas.has(p));
    if (erradas.length) throw new Error(`Grupo de WhatsApp "${g.nome}": pastas inexistentes: ${erradas.join(", ")}`);
    if (g.unidade && !unidades.has(g.unidade)) throw new Error(`Grupo de WhatsApp "${g.nome}": unidade inexistente: ${g.unidade}`);
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

export const idDoGrupoWhatsApp = (jid: string) => `wa:${jid}`;

/** Um grupo de WhatsApp tratado como destinatário/"usuário" (com lista fechada de pastas). */
export function usuarioDoGrupo(g: GrupoWhatsApp): Usuario {
  return {
    id: idDoGrupoWhatsApp(g.jid),
    nome: g.nome,
    whatsappGrupo: g.jid,
    pastas: g.pastas,
    unidade: g.unidade,
    resumoDiario: g.resumoDiario,
  };
}

/** Pessoas + grupos de WhatsApp: todos que podem receber avisos. */
export function destinatarios(config: Config): Usuario[] {
  return [...config.empresa.usuarios, ...config.empresa.gruposWhatsApp.map(usuarioDoGrupo)];
}

export function buscarDestinatario(config: Config, id: string): Usuario | undefined {
  return destinatarios(config).find((u) => u.id === id);
}

/** A unidade do item é visível para este usuário? (sem unidade ou "todas" = sempre) */
export function podeVerUnidade(usuario: Usuario, unidade?: string): boolean {
  return !usuario.unidade || !unidade || unidade === TODAS || unidade === usuario.unidade;
}

/** O usuário pode ver/usar este grupo? */
export function podeVerGrupo(config: Config, usuario: Usuario, grupoId: string): boolean {
  const g = config.empresa.grupos.find((x) => x.id === grupoId);
  if (!g) return false;
  if (usuario.pastas) return usuario.pastas.includes(grupoId);
  if (!g.restrito) return true;
  const permitidos = usuario.grupos ?? [];
  return permitidos.includes("*") || permitidos.includes(grupoId);
}
