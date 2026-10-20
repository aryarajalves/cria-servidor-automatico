#!/usr/bin/env python3
"""
Script de Auditoria Automatizada de Dependências Externas (Backend & Frontend).
Executa pip-audit nas dependências Python (requirements.txt) e npm audit no frontend (package.json).
Pode ser executado localmente, em Git pre-push hooks ou em pipelines de CI (GitHub Actions).
"""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

# Garante suporte a UTF-8 no Windows para emojis e caracteres especiais
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


def parse_npm_audit(json_data: dict) -> dict:
    """Extrai informações sumarizadas do JSON do npm audit."""
    metadata = json_data.get("metadata", {})
    vuln_counts = metadata.get("vulnerabilities", {})
    
    findings = []
    vulnerabilities = json_data.get("vulnerabilities", {})
    
    for pkg_name, details in vulnerabilities.items():
        if isinstance(details, dict):
            severity = details.get("severity", "unknown")
            is_direct = details.get("isDirect", False)
            range_spec = details.get("range", "")
            fix_avail = details.get("fixAvailable", False)
            fix_text = "Sim" if fix_avail else "Não"
            if isinstance(fix_avail, dict):
                fix_text = f"Sim (v{fix_avail.get('version', 'nova')})"
            
            findings.append({
                "package": pkg_name,
                "severity": severity,
                "is_direct": is_direct,
                "range": range_spec,
                "fix": fix_text
            })
            
    # Ordenar achados por severidade (critical > high > moderate > low > info)
    severity_order = {"critical": 0, "high": 1, "moderate": 2, "low": 3, "info": 4}
    findings.sort(key=lambda x: severity_order.get(x["severity"], 99))
    
    return {
        "counts": vuln_counts,
        "findings": findings,
        "total": vuln_counts.get("total", len(findings))
    }


def parse_pip_audit(json_data) -> dict:
    """Extrai informações sumarizadas do JSON do pip-audit."""
    findings = []
    
    dependencies = json_data.get("dependencies", []) if isinstance(json_data, dict) else (json_data if isinstance(json_data, list) else [])
    
    for dep in dependencies:
        pkg_name = dep.get("name", "")
        pkg_ver = dep.get("version", "")
        vulns = dep.get("vulns", [])
        for v in vulns:
            vuln_id = v.get("id", "")
            fix_versions = v.get("fix_versions", [])
            fix_text = ", ".join(fix_versions) if fix_versions else "Nenhuma disponível"
            description = v.get("description", "")
            
            findings.append({
                "package": pkg_name,
                "version": pkg_ver,
                "id": vuln_id,
                "fix": fix_text,
                "description": description[:120] + "..." if len(description) > 120 else description
            })
            
    return {
        "findings": findings,
        "total": len(findings)
    }


def run_command(cmd: list, cwd: Path = None, timeout: int = 120) -> tuple:
    """Executa um comando de terminal de forma segura e com timeout."""
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=True if os.name == "nt" else False
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Timeout ao executar comando de auditoria"
    except Exception as e:
        return -1, "", str(e)


def audit_frontend(frontend_dir: Path) -> dict:
    """Executa o npm audit na pasta frontend."""
    if not frontend_dir.exists() or not (frontend_dir / "package.json").exists():
        return {"error": f"Diretório ou package.json não encontrado em: {frontend_dir}"}
        
    code, stdout, stderr = run_command(["npm", "audit", "--json"], cwd=frontend_dir)
    
    try:
        data = json.loads(stdout)
        parsed = parse_npm_audit(data)
        return parsed
    except Exception:
        # Se npm audit falhou ou não retornou JSON
        return {
            "error": stderr or stdout or "Falha ao processar saída do npm audit",
            "counts": {},
            "findings": [],
            "total": 0
        }


def audit_backend(requirements_file: Path) -> dict:
    """Executa o pip-audit no requirements.txt do projeto."""
    if not requirements_file.exists():
        return {"error": f"Arquivo requirements.txt não encontrado em: {requirements_file}"}
        
    # Usa --no-deps e --disable-pip para análise offline rápida contra advisory DB
    cmd = [
        sys.executable, "-m", "pip_audit",
        "-r", str(requirements_file),
        "--no-deps",
        "--disable-pip",
        "-f", "json"
    ]
    
    code, stdout, stderr = run_command(cmd)
    
    try:
        data = json.loads(stdout)
        parsed = parse_pip_audit(data)
        return parsed
    except Exception:
        return {
            "error": stderr or stdout or "Falha ao processar saída do pip-audit",
            "findings": [],
            "total": 0
        }


def format_markdown_report(backend_result: dict, frontend_result: dict) -> str:
    """Gera um relatório formatado em Markdown para console ou GitHub Step Summary."""
    lines = []
    lines.append("# 🛡️ Relatório de Auditoria de Dependências Externas")
    lines.append("")
    
    # Seção Backend
    lines.append("## 🐍 Backend (Python / requirements.txt)")
    if "error" in backend_result and backend_result.get("error"):
        lines.append(f"> ⚠️ **Aviso:** {backend_result['error']}")
    else:
        b_findings = backend_result.get("findings", [])
        b_total = backend_result.get("total", 0)
        lines.append(f"**Total de vulnerabilidades encontradas:** `{b_total}`")
        lines.append("")
        if b_findings:
            lines.append("| Pacote | Versão Atual | Vulnerabilidade ID | Versão Corrigida |")
            lines.append("| --- | --- | --- | --- |")
            for f in b_findings:
                lines.append(f"| `{f['package']}` | {f['version']} | [{f['id']}](https://osv.dev/vulnerability/{f['id']}) | {f['fix']} |")
        else:
            lines.append("✅ Nenhuma vulnerabilidade detectada nas dependências do Backend!")
    lines.append("")
    
    # Seção Frontend
    lines.append("## ⚛️ Frontend (Node.js / package.json)")
    if "error" in frontend_result and frontend_result.get("error"):
        lines.append(f"> ⚠️ **Aviso:** {frontend_result['error']}")
    else:
        f_counts = frontend_result.get("counts", {})
        f_findings = frontend_result.get("findings", [])
        f_total = frontend_result.get("total", 0)
        
        crit = f_counts.get("critical", 0)
        high = f_counts.get("high", 0)
        mod = f_counts.get("moderate", 0)
        low = f_counts.get("low", 0)
        
        lines.append(f"**Total:** `{f_total}` (Críticas: `{crit}` | Altas: `{high}` | Moderadas: `{mod}` | Baixas: `{low}`)")
        lines.append("")
        if f_findings:
            lines.append("| Pacote | Severidade | Dependência Direta? | Versão Afetada | Correção Disponível? |")
            lines.append("| --- | --- | --- | --- | --- |")
            for f in f_findings:
                direct = "Sim" if f["is_direct"] else "Não (indireta)"
                lines.append(f"| `{f['package']}` | **{f['severity'].upper()}** | {direct} | `{f['range']}` | {f['fix']} |")
        else:
            lines.append("✅ Nenhuma vulnerabilidade detectada nas dependências do Frontend!")
            
    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Auditor de segurança de bibliotecas externas (Backend & Frontend)")
    parser.add_argument("--backend-only", action="store_true", help="Auditar apenas backend")
    parser.add_argument("--frontend-only", action="store_true", help="Auditar apenas frontend")
    parser.add_argument("--output-file", type=str, default="", help="Arquivo para salvar o relatório Markdown")
    parser.add_argument("--github-summary", action="store_true", help="Gravar no GITHUB_STEP_SUMMARY se existir")
    parser.add_argument("--fail-on", choices=["critical", "high", "moderate", "any", "none"], default="none",
                        help="Nível de severidade que causa falha (código de saída 1)")
    
    args = parser.parse_args()
    
    project_root = Path(__file__).resolve().parent.parent.parent
    requirements_file = project_root / "requirements.txt"
    frontend_dir = project_root / "frontend"
    
    backend_res = {}
    frontend_res = {}
    
    if not args.frontend_only:
        print("🔍 Auditando dependências do Backend (Python)...")
        backend_res = audit_backend(requirements_file)
        
    if not args.backend_only:
        print("🔍 Auditando dependências do Frontend (Node.js)...")
        frontend_res = audit_frontend(frontend_dir)
        
    report = format_markdown_report(backend_res, frontend_res)
    print("\n" + report)
    
    # Salvar em arquivo se solicitado
    if args.output_file:
        try:
            with open(args.output_file, "w", encoding="utf-8") as f:
                f.write(report)
            print(f"\n📄 Relatório salvo com sucesso em: {args.output_file}")
        except Exception as e:
            print(f"Erro ao salvar arquivo de relatório: {e}", file=sys.stderr)
            
    # Salvar em GITHUB_STEP_SUMMARY se solicitado e presente
    if args.github_summary or os.environ.get("GITHUB_STEP_SUMMARY"):
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            try:
                with open(summary_path, "a", encoding="utf-8") as f:
                    f.write(report + "\n")
                print("📄 Relatório anexado ao GitHub Step Summary!")
            except Exception as e:
                print(f"Erro ao gravar GITHUB_STEP_SUMMARY: {e}", file=sys.stderr)
                
    # Avaliar código de saída baseado em --fail-on
    if args.fail_on != "none":
        f_counts = frontend_res.get("counts", {})
        crit = f_counts.get("critical", 0)
        high = f_counts.get("high", 0)
        mod = f_counts.get("moderate", 0)
        b_total = backend_res.get("total", 0)
        
        has_failure = False
        if args.fail_on == "critical" and crit > 0:
            has_failure = True
        elif args.fail_on == "high" and (crit > 0 or high > 0):
            has_failure = True
        elif args.fail_on == "moderate" and (crit > 0 or high > 0 or mod > 0):
            has_failure = True
        elif args.fail_on == "any" and (backend_res.get("total", 0) > 0 or frontend_res.get("total", 0) > 0):
            has_failure = True
            
        if has_failure:
            print(f"\n❌ Falha na auditoria: Vulnerabilidades atingiram o limite especificado (--fail-on {args.fail_on}).", file=sys.stderr)
            sys.exit(1)
            
    print("\n✅ Auditoria concluída com sucesso.")
    sys.exit(0)


if __name__ == "__main__":
    main()
