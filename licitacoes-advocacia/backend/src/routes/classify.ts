import { Router } from "express";
import { z } from "zod";
import {
  classifyText,
  ClassifierError,
} from "../services/classifier.js";

const router = Router();

const classifySchema = z.object({
  texto: z
    .string({ required_error: "Campo 'texto' é obrigatório." })
    .min(1, "Campo 'texto' não pode ser vazio.")
    .max(50_000, "Campo 'texto' excede o limite de 50.000 caracteres."),
});

router.post("/", async (req, res) => {
  const parsed = classifySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Payload inválido.",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const especialidades = await classifyText(parsed.data.texto);

    return res.json({
      data: especialidades,
      count: especialidades.length,
    });
  } catch (error) {
    if (error instanceof ClassifierError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    console.error("[classify] Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno ao classificar texto.",
    });
  }
});

export default router;
