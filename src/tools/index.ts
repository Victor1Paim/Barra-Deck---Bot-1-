import type { Ferramenta } from "./tipos.js";
import { salvarNota, buscarNotas, editarNota, apagarNota } from "./notas.js";
import { criarLembrete, listarLembretes, concluirLembrete } from "./lembretes.js";
import { listarDocumentos, lerDocumento } from "./conhecimento.js";

export const ferramentasBase: Ferramenta[] = [
  salvarNota,
  buscarNotas,
  editarNota,
  apagarNota,
  criarLembrete,
  listarLembretes,
  concluirLembrete,
  listarDocumentos,
  lerDocumento,
];
