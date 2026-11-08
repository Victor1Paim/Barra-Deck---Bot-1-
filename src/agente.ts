import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Ferramenta, Contexto } from "./tools/tipos.js";

/** Decide se uma ferramenta que altera dados pode rodar. Retorna true para permitir. */
export type Permissao = (ferramenta: Ferramenta, args: unknown) => Promise<boolean>;

export interface Eventos {
  aoChamarFerramenta?: (nome: string, args: unknown) => void;
}

export class Agente {
  private historico: ChatCompletionMessageParam[] = [];
  private porNome: Map<string, Ferramenta>;

  constructor(
    private cliente: OpenAI,
    private ctx: Contexto,
    private ferramentas: Ferramenta[],
    private prompt: () => string,
    private permitir: Permissao,
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

  /** Executa o ciclo: modelo → ferramentas → modelo … até ter uma resposta final. */
  async conversar(mensagem: string): Promise<string> {
    this.historico.push({ role: "user", content: mensagem });

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
    return `Parei após ${this.ctx.config.maxPassos} passos sem concluir. Tente dividir o pedido.`;
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

    if (f.altera) {
      if (this.ctx.config.modo === "leitura") return { erro: "Modo somente leitura: ação bloqueada." };
      if (this.ctx.config.modo === "perguntar" && !(await this.permitir(f, args))) {
        return { erro: "O usuário recusou esta ação." };
      }
    }

    try {
      return await f.executar(args, this.ctx);
    } catch (e) {
      return { erro: e instanceof Error ? e.message : String(e) };
    }
  }
}
