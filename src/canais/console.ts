import type { Canal } from "../envios.js";

/** Para quem não tem WhatsApp nem e-mail configurado: mostra o aviso na janela do serviço. */
export const canalConsole: Canal = {
  nome: "console",
  atende: (u) => !u.whatsapp && !u.email && !u.whatsappGrupo,
  async enviar(u, texto) {
    console.log(`\n\x1b[33m[para ${u.nome}]\x1b[0m\n${texto}\n`);
  },
};
