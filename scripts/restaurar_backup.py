# -*- coding: utf-8 -*-
"""
Restauração do backup semanal do Sombrear.

O backup-semanal (edge function, pg_cron toda segunda 06:00 UTC) grava
backup-AAAA-MM-DD.json no bucket privado 'backups' com TODAS as tabelas vitais.
Este script é o par dele — validação de integridade e restauração de verdade.

Uso (na raiz do repo, .env com SUPABASE_ACCESS_TOKEN e VITE_SUPABASE_* presentes):

  python scripts/restaurar_backup.py                  # valida o backup mais recente
  python scripts/restaurar_backup.py --listar         # lista os backups disponíveis
  python scripts/restaurar_backup.py --ensaio         # restaura config_automacoes numa tabela
                                                      #   temporária e compara (prova o mecanismo)
  python scripts/restaurar_backup.py --restaurar orcamentos --confirmar
      # DESASTRE DE VERDADE: repõe as linhas do backup na tabela indicada
      # (upsert por id — não apaga linhas novas; use com o time ciente)
"""
import json
import ssl
import sys
import urllib.request

PROJETO = 'nlswyjpjzibuvdsaooyg'
SUPABASE_URL = f'https://{PROJETO}.supabase.co'
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

CHAVES_PK = {'profiles': 'id', 'config_automacoes': 'chave'}  # demais tabelas: 'id'


def env():
    d = {}
    for linha in open('.env', encoding='utf-8'):
        if '=' in linha and not linha.startswith('#'):
            k, v = linha.strip().split('=', 1)
            d[k] = v
    return d


def sql(token, query):
    corpo = json.dumps({'query': query}).encode()
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{PROJETO}/database/query',
        method='POST', data=corpo,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json',
                 'User-Agent': 'sombrear-deploy/1.0'})
    return json.loads(urllib.request.urlopen(req, context=CTX).read())


def storage(token_servico, caminho, metodo='GET'):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/storage/v1/{caminho}', method=metodo,
        headers={'Authorization': f'Bearer {token_servico}', 'apikey': token_servico})
    return urllib.request.urlopen(req, context=CTX).read()


def token_servico(cfg):
    # service role via Management API (não fica no .env)
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{PROJETO}/api-keys?reveal=true',
        headers={'Authorization': f'Bearer {cfg["SUPABASE_ACCESS_TOKEN"]}',
                 'User-Agent': 'sombrear-deploy/1.0'})
    chaves = json.loads(urllib.request.urlopen(req, context=CTX).read())
    for c in chaves:
        if c.get('name') == 'service_role':
            return c['api_key']
    raise SystemExit('service_role não encontrada')


def listar(srv):
    corpo = json.dumps({'prefix': '', 'sortBy': {'column': 'name', 'order': 'desc'}}).encode()
    req = urllib.request.Request(
        f'{SUPABASE_URL}/storage/v1/object/list/backups', method='POST', data=corpo,
        headers={'Authorization': f'Bearer {srv}', 'apikey': srv, 'Content-Type': 'application/json'})
    return [a['name'] for a in json.loads(urllib.request.urlopen(req, context=CTX).read())
            if a['name'].startswith('backup-')]


def baixar(srv, nome):
    bruto = storage(srv, f'object/backups/{nome}')
    return json.loads(bruto)


def validar(cfg, srv, nome):
    dump = baixar(srv, nome)
    tabelas = dump['tabelas']
    erros = [t for t in tabelas if t.startswith('ERRO_')]
    print(f'Backup {nome} (gerado em {dump["gerado_em"]}):')
    total = 0
    for t, linhas in sorted(tabelas.items()):
        if t.startswith('ERRO_'):
            continue
        total += len(linhas)
        print(f'  {t:32s} {len(linhas):6d} linhas')
    print(f'  {"TOTAL":32s} {total:6d}')
    if erros:
        print('⚠️  ERROS NO BACKUP:', erros)
        return False
    # amostra de sanidade: contagens ao vivo vs backup (tabelas mudam, então só alerta se MUITO diferente)
    for t in ('orcamentos', 'precos_tecidos', 'config_automacoes'):
        vivo = sql(cfg['SUPABASE_ACCESS_TOKEN'], f'select count(*) as n from {t}')[0]['n']
        no_backup = len(tabelas.get(t, []))
        marca = 'ok' if abs(vivo - no_backup) <= max(5, vivo * 0.2) else '⚠️ divergente'
        print(f'  sanidade {t}: vivo={vivo} backup={no_backup} [{marca}]')
    print('✅ backup íntegro e legível')
    return True


def ensaio(cfg, srv, nome):
    """Prova o mecanismo: restaura config_automacoes numa tabela temporária e compara."""
    dump = baixar(srv, nome)
    linhas = dump['tabelas']['config_automacoes']
    tok = cfg['SUPABASE_ACCESS_TOKEN']
    sql(tok, 'drop table if exists backup_teste_restauracao')
    sql(tok, 'create table backup_teste_restauracao (like config_automacoes including all)')
    for l in linhas:
        cols = ', '.join(l.keys())
        vals = ', '.join("null" if v is None else "'" + str(v).replace("'", "''") + "'" for v in l.values())
        sql(tok, f'insert into backup_teste_restauracao ({cols}) values ({vals})')
    conferencia = sql(tok, '''select (select count(*) from backup_teste_restauracao) as restauradas,
                                     (select count(*) from config_automacoes) as originais''')[0]
    sql(tok, 'drop table backup_teste_restauracao')
    ok = conferencia['restauradas'] == len(linhas)
    print(f'ensaio: {conferencia["restauradas"]} linhas restauradas de {len(linhas)} do backup '
          f'(tabela original tem {conferencia["originais"]}) → {"✅ mecanismo provado" if ok else "❌ FALHOU"}')
    return ok


def restaurar(cfg, srv, nome, tabela):
    dump = baixar(srv, nome)
    if tabela not in dump['tabelas']:
        raise SystemExit(f'tabela {tabela} não existe no backup')
    linhas = dump['tabelas'][tabela]
    pk = CHAVES_PK.get(tabela, 'id')
    tok = cfg['SUPABASE_ACCESS_TOKEN']
    print(f'restaurando {len(linhas)} linhas em {tabela} (upsert por {pk})…')
    feitas = 0
    for l in linhas:
        cols = ', '.join(l.keys())
        vals = ', '.join("null" if v is None else "'" + str(v).replace("'", "''") + "'" for v in l.values())
        sets = ', '.join(f'{c} = excluded.{c}' for c in l.keys() if c != pk)
        sql(tok, f'insert into {tabela} ({cols}) values ({vals}) '
                 f'on conflict ({pk}) do update set {sets}')
        feitas += 1
        if feitas % 100 == 0:
            print(f'  {feitas}/{len(linhas)}…')
    print(f'✅ {feitas} linhas repostas em {tabela}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    cfg = env()
    srv = token_servico(cfg)
    nomes = listar(srv)
    if not nomes:
        raise SystemExit('nenhum backup no bucket')

    if '--listar' in sys.argv:
        for n in nomes:
            print(n)
    elif '--ensaio' in sys.argv:
        ensaio(cfg, srv, nomes[0])
    elif '--restaurar' in sys.argv:
        if '--confirmar' not in sys.argv:
            raise SystemExit('restauração real exige --confirmar')
        tabela = sys.argv[sys.argv.index('--restaurar') + 1]
        restaurar(cfg, srv, nomes[0], tabela)
    else:
        validar(cfg, srv, nomes[0])
