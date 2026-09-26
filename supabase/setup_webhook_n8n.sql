-- ⚠️ SUPERADO em 26/09/2026 pela migration 0021_novo_cadastro_sai_do_n8n.sql.
-- O aviso de novo cadastro não passa mais pelo n8n; o trigger chama a Edge
-- Function `novo-cadastro`. Este arquivo fica como registro histórico.
-- Aviso: ele também já NÃO batia com a produção — descrevia `net.http_post`
-- com `row_to_json(NEW)`, enquanto o trigger vivo usava
-- `supabase_functions.http_request`, cujo payload é {type, table, record, ...}.
-- Foi a produção, não este arquivo, que serviu de referência para a migração.

-- Habilita a extensão pg_net (HTTP requests do banco)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Função que chama o n8n ao criar novo usuário
CREATE OR REPLACE FUNCTION notify_n8n_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email != 'luccapavanallo@gmail.com' THEN
    PERFORM net.http_post(
      url     := 'https://n8n-n8n.yjlhot.easypanel.host/webhook/sombrear-novo-cadastro',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := json_build_object('record', row_to_json(NEW))::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_profile_notify ON profiles;
CREATE TRIGGER on_new_profile_notify
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION notify_n8n_new_user();
