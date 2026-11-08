import nodemailer from "nodemailer";
import type { Config, Usuario } from "../config.js";
import type { Canal } from "../envios.js";

export function canalEmail(config: Config): Canal | undefined {
  const { smtp } = config;
  if (!config.empresa.canais.email.ativo) return undefined;
  if (!smtp.host || !smtp.usuario) {
    console.warn("[e-mail] canal ativo, mas SMTP_HOST/SMTP_USUARIO não estão no .env. E-mail desligado.");
    return undefined;
  }
  const transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.porta,
    secure: smtp.seguro,
    auth: { user: smtp.usuario, pass: smtp.senha },
  });
  const remetente = config.empresa.canais.email.remetente || smtp.usuario;
  return {
    nome: "email",
    atende: (u: Usuario) => !!u.email,
    async enviar(u, texto, assunto) {
      await transporte.sendMail({
        from: `Deck One <${remetente}>`,
        to: u.email,
        subject: assunto ?? "Deck One",
        text: texto.replace(/\*(.+?)\*/g, "$1"),
      });
    },
  };
}
