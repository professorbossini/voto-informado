#!/usr/bin/env bash
# Instala (ou remove, com --remover) o timer do systemd do usuário que roda
# scripts/apuracao-auto.sh a cada 15 minutos até o fim do período de divulgação.
#
#   scripts/apuracao-agendar.sh            instala e liga
#   scripts/apuracao-agendar.sh --remover  desliga e remove
#
# Acompanhar: systemctl --user list-timers tanaurna-apuracao.timer
#             journalctl --user -u tanaurna-apuracao -f
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
NOME="tanaurna-apuracao"

if [[ "${1:-}" == "--remover" ]]; then
  systemctl --user disable --now "$NOME.timer" 2>/dev/null || true
  rm -f "$UNIT_DIR/$NOME.service" "$UNIT_DIR/$NOME.timer"
  systemctl --user daemon-reload
  echo "✓ timer removido"
  exit 0
fi

# O serviço precisa achar node/npx (build do site), gh (credencial do push) e make.
CAMINHOS=()
for bin in node npx gh git make python3; do
  p="$(command -v "$bin" 2>/dev/null || true)"
  [[ -n "$p" ]] && CAMINHOS+=("$(dirname "$p")")
done
PATH_SERVICO="$(printf '%s\n' "${CAMINHOS[@]}" /usr/local/bin /usr/bin /bin | awk '!v[$0]++' | paste -sd:)"

mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/$NOME.service" <<EOF
[Unit]
Description=Tá na Urna: grava a apuração final do TSE e republica o site
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$ROOT
Environment=PATH=$PATH_SERVICO
ExecStart=$ROOT/scripts/apuracao-auto.sh
TimeoutStartSec=45min
Nice=10
EOF

cat > "$UNIT_DIR/$NOME.timer" <<EOF
[Unit]
Description=Tá na Urna: apuração automática a cada 15 min

[Timer]
OnCalendar=*:0/15
# Se o computador estava desligado ou suspenso, roda assim que voltar.
Persistent=true
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$NOME.timer"
# Sem "linger", o timer só roda com a sessão aberta (ainda assim recupera ao voltar).
loginctl enable-linger "$USER" 2>/dev/null || echo "(aviso: não foi possível ligar o linger; o timer roda enquanto sua sessão estiver aberta)"
echo "✓ timer instalado"
systemctl --user list-timers "$NOME.timer" --no-pager
