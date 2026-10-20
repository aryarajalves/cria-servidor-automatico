#!/usr/bin/env python3
"""
Script utilitário para instalar o hook pre-push do Git.
Garante que a auditoria de bibliotecas seja executada antes de qualquer push local.
"""

from pathlib import Path
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PRE_PUSH_HOOK_CONTENT = """#!/bin/sh
# Hook de pré-push: executa auditoria de dependências antes de permitir o push
echo "🛡️  Executando auditoria de segurança das bibliotecas externas..."
python backend/scripts/audit_dependencies.py

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo "⚠️  Aviso: Foram encontradas pendências na auditoria."
fi

# Permite o push prosseguir (ou altere para exit $EXIT_CODE para bloquear)
exit 0
"""


def install_hook():
    project_root = Path(__file__).resolve().parent.parent.parent
    hooks_dir = project_root / ".git" / "hooks"
    
    if not hooks_dir.exists():
        print(f"Diretório .git/hooks não encontrado em: {hooks_dir}")
        return False
        
    hook_file = hooks_dir / "pre-push"
    try:
        hook_file.write_text(PRE_PUSH_HOOK_CONTENT, encoding="utf-8")
        print(f"✅ Git pre-push hook instalado com sucesso em: {hook_file}")
        return True
    except Exception as e:
        print(f"❌ Erro ao instalar pre-push hook: {e}")
        return False


if __name__ == "__main__":
    success = install_hook()
    sys.exit(0 if success else 1)
