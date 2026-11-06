#!/usr/bin/env bash
# O-Finance Desktop Entry Installation Script for Linux / Kali Linux Workstation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DESKTOP_DIR="${HOME}/.local/share/applications"
DESKTOP_FILE="${DESKTOP_DIR}/o-finance.desktop"

mkdir -p "${DESKTOP_DIR}"

# Find node/npm/electron path or run npx electron
DESKTOP_EXEC="bash -c 'cd \"${PROJECT_ROOT}\" && npm run desktop:start'"

cat <<EOF > "${DESKTOP_FILE}"
[Desktop Entry]
Version=1.0
Type=Application
Name=O-Finance Workstation
GenericName=Financial Operating System
Comment=Local-First Private Financial Operating System Workstation Shell
Exec=${DESKTOP_EXEC}
Icon=utilities-terminal
Terminal=false
Categories=Office;Finance;Utility;
Keywords=Finance;Accounting;Beancount;Ledger;Quant;
StartupWMClass=o-finance-workstation
EOF

chmod +x "${DESKTOP_FILE}"

echo "[O-Finance] Linux desktop entry successfully installed at ${DESKTOP_FILE}"
