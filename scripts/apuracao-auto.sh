#!/usr/bin/env bash
# Apuração automática: grava a totalização FINAL publicada pelo TSE e republica o site
# quando ela muda. Feito para rodar a cada 15 min por um timer do systemd (make apuracao-agendar).
#
# - O site mostra o parcial ao vivo sozinho (navegador → TSE); este script só leva o
#   resultado FINAL para o banco, a página de 2º turno e os perfis das candidaturas.
# - Republica no máximo uma vez a cada INTERVALO_MIN minutos (cada publicação envia ~770 MB),
#   e só quando algum resultado final novo apareceu desde a última publicação.
# - Depois de FIM (fim do período de divulgação), desliga o próprio timer.
#
# Uso manual: scripts/apuracao-auto.sh          (uma passada)
#             FORCAR=1 scripts/apuracao-auto.sh (publica mesmo sem mudança, respeitando só a trava)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/backend/data"
ESTADO="$DATA/apuracao-auto.estado"   # assinatura e horário da última publicação
INTERVALO_MIN="${INTERVALO_MIN:-60}"
FIM="${FIM:-2026-11-01}"
TIMER="tanaurna-apuracao.timer"

log() { echo "[$(date '+%d/%m %H:%M:%S')] $*"; }
avisar() { command -v notify-send >/dev/null && notify-send -a "Tá na Urna" "Tá na Urna" "$1" 2>/dev/null || true; }

# Uma execução por vez (a publicação leva ~10 min).
exec 9>"$DATA/.apuracao-auto.lock"
flock -n 9 || { log "outra execução em andamento; saindo"; exit 0; }

if [[ "$(TZ=America/Sao_Paulo date +%F)" > "$FIM" ]]; then
  log "período de divulgação encerrado ($FIM): desligando o timer"
  systemctl --user disable --now "$TIMER" 2>/dev/null || true
  exit 0
fi

cd "$ROOT/backend"
log "consultando o TSE"
.venv/bin/python -m etl.resultados

# Assinatura do que há de FINAL no banco (muda quando surge ou se corrige um resultado final).
read -r N ASSINATURA < <(.venv/bin/python - <<'EOF'
import hashlib, sqlite3
c = sqlite3.connect("data/politicos.db")
try:
    rows = c.execute("SELECT turno, uf, cargo, sq, votos, situacao, eleito FROM resultados ORDER BY 1,2,3,4").fetchall()
except sqlite3.OperationalError:
    rows = []
arquivos = {(r[0], r[1], r[2]) for r in rows}
print(len(arquivos), hashlib.sha256(repr(rows).encode()).hexdigest()[:16])
EOF
)

if [[ "$N" == 0 ]]; then
  log "nenhuma totalização final publicada pelo TSE ainda"
  exit 0
fi

ULTIMA_ASS=""; ULTIMA_EM=0
[[ -f "$ESTADO" ]] && read -r ULTIMA_ASS ULTIMA_EM < "$ESTADO"
AGORA=$(date +%s)

if [[ "$ASSINATURA" == "$ULTIMA_ASS" && -z "${FORCAR:-}" ]]; then
  log "$N disputas com resultado final; nada novo desde a última publicação"
  exit 0
fi
if (( AGORA - ULTIMA_EM < INTERVALO_MIN * 60 )); then
  log "$N disputas com resultado final (há novidade), mas a última publicação foi há menos de $INTERVALO_MIN min; fica para a próxima"
  exit 0
fi

log "$N disputas com resultado final: atualizando derivados e publicando"
.venv/bin/python -m etl.derivados >/dev/null
cd "$ROOT"
if make publicar; then
  echo "$ASSINATURA $AGORA" > "$ESTADO"
  log "publicado ($N disputas com resultado final)"
  avisar "Resultado final publicado no site ($N disputas)."
else
  log "ERRO ao publicar; tento de novo na próxima passada"
  avisar "Falha ao publicar a apuração. Veja: journalctl --user -u tanaurna-apuracao"
  exit 1
fi
