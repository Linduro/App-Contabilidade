-- Vincula o advogado owner ao e-mail da plataforma
INSERT INTO advogados (nome, email, ativo) VALUES
  ('Cartoon HQ', 'cartoonhq@gmail.com', true)
ON CONFLICT (email) DO UPDATE SET ativo = true, nome = EXCLUDED.nome;

INSERT INTO advogados_especialidades (advogado_id, especialidade_id, nivel_experiencia)
SELECT a.id, e.id, 'especialista'
FROM advogados a
CROSS JOIN especialidades_advogados e
WHERE a.email = 'cartoonhq@gmail.com'
  AND e.slug IN ('banking_law', 'administrativo', 'tributario', 'responsabilidade_civil', 'security')
ON CONFLICT DO NOTHING;
