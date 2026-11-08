import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { precisaConfirmar, type Ferramenta, type Contexto } from "./tools/tipos.js";

/** Pergunta ao usuário se pode executar a ação. true = pode. */
export type Confirmar = (pergunta: string) => Promise<boolean>;

export interface Eventos {
  aoChamarFerramenta?: (nome: string, args: unknown) => void;
}

/** Mantém o histórico curto para não gastar tokens à toa (as informações ficam nas notas). */
const MAX_HISTORICO = 40;

export class Agente {
  private historico: ChatCompletionMessageParam[] = [];
  private porNome: Map<string, Ferramenta>;

  constructor(
    private cliente: OpenAI,
    private ctx: Contexto,
    private ferramentas: Ferramenta[],
    private prompt: () => string,
    private confirmar: Confirmar,
    private eventos: Eventos = {},
  ) {
    this.porNome = new Map(ferramentas.map((f) => [f.nome, f]));
  }

  limpar(): void {
    this.historico = [];
  }

  private definicoes(): ChatCompletionTool[] {
    return this.ferramentas.map((f) => ({
      type: "function",
      function: { name: f.nome, description: f.descricao, parameters: f.parametros },
    }));
  }

  private aparar(): void {
    if (this.historico.length <= MAX_HISTORICO) return;
    // Corta no começo de uma mensagem do usuário, para não separar chamada e resultado de ferramenta.
    let i = this.historico.length - MAX_HISTORICO;
    while (i < this.historico.length && this.historico[i].role !== "user") i++;
    this.historico = this.historico.slice(i);
  }

  /** Ciclo: modelo → ferramentas → modelo … até ter uma resposta final. */
  async conversar(mensagem: string): Promise<string> {
    this.historico.push({ role: "user", content: mensagem });
    this.aparar();

    for (let passo = 0; passo < this.ctx.config.maxPassos; passo++) {
      const resp = await this.cliente.chat.completions.create({
        model: this.ctx.config.modelo,
        messages: [{ role: "system", content: this.prompt() }, ...this.historico],
        tools: this.definicoes(),
      });
      const msg = resp.choices[0].message;
      this.historico.push(msg);

      if (!msg.tool_calls?.length) return msg.content ?? "";

      for (const chamada of msg.tool_calls) {
        const resultado =
          chamada.type === "function"
            ? await this.executar(chamada.function.name, chamada.function.arguments)
            : { erro: "Tipo de chamada não suportado." };
        this.historico.push({
          role: "tool",
          tool_call_id: chamada.id,
          content: typeof resultado === "string" ? resultado : JSON.stringify(resultado),
        });
      }
    }
    return `Ops, me enrolei: parei depois de ${this.ctx.config.maxPassos} passos sem terminar. Tenta dividir o pedido? 🙏`;
  }

  private async executar(nome: string, argsTexto: string): Promise<unknown> {
    const f = this.porNome.get(nome);
    if (!f) return { erro: `Ferramenta desconhecida: ${nome}` };

    let args: unknown;
    try {
      args = argsTexto ? JSON.parse(argsTexto) : {};
    } catch {
      return { erro: "Argumentos em JSON inválido." };
    }

    this.eventos.aoChamarFerramenta?.(nome, args);

    if (f.nivel !== "leitura" && this.ctx.config.modo === "leitura") {
      return { erro: "Modo somente leitura: ação bloqueada." };
    }

    try {
      if (precisaConfirmar(f, args, this.ctx)) {
        const resumo = f.resumir?.(args, this.ctx) ?? `${nome} ${JSON.stringify(args)}`;
        if (!(await this.confirmar(`Posso ${resumo}?`))) return { erro: "O usuário recusou esta ação. Não tente de novo sem ele pedir." };
      }
      return await f.executar(args, this.ctx);
    } catch (e) {
      return { erro: e instanceof Error ? e.message : String(e) };
    }
  }
}
