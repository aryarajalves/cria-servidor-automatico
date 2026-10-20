"""
Testes unitários para o script de auditoria de dependências (Backend e Frontend).
"""

from pathlib import Path
import pytest

from scripts.audit_dependencies import (
    parse_npm_audit,
    parse_pip_audit,
    format_markdown_report,
    audit_frontend,
    audit_backend,
)


def test_parse_npm_audit_empty():
    sample_data = {
        "metadata": {
            "vulnerabilities": {
                "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0
            }
        },
        "vulnerabilities": {}
    }
    result = parse_npm_audit(sample_data)
    assert result["total"] == 0
    assert len(result["findings"]) == 0


def test_parse_npm_audit_with_findings():
    sample_data = {
        "metadata": {
            "vulnerabilities": {
                "info": 0, "low": 1, "moderate": 1, "high": 2, "critical": 0, "total": 4
            }
        },
        "vulnerabilities": {
            "axios": {
                "name": "axios",
                "severity": "high",
                "isDirect": True,
                "range": "1.0.0 - 1.6.0",
                "fixAvailable": True
            },
            "undici": {
                "name": "undici",
                "severity": "high",
                "isDirect": False,
                "range": "5.0.0 - 5.28.0",
                "fixAvailable": {"name": "undici", "version": "5.28.1"}
            },
            "lodash": {
                "name": "lodash",
                "severity": "low",
                "isDirect": False,
                "range": "<4.17.21",
                "fixAvailable": False
            }
        }
    }
    result = parse_npm_audit(sample_data)
    assert result["total"] == 4
    assert len(result["findings"]) == 3
    # High severities must come before low
    assert result["findings"][0]["severity"] == "high"
    assert result["findings"][1]["severity"] == "high"
    assert result["findings"][2]["severity"] == "low"
    assert "Sim" in result["findings"][1]["fix"]


def test_parse_pip_audit_empty():
    sample_data = {"dependencies": []}
    result = parse_pip_audit(sample_data)
    assert result["total"] == 0
    assert len(result["findings"]) == 0


def test_parse_pip_audit_with_findings():
    sample_data = {
        "dependencies": [
            {
                "name": "requests",
                "version": "2.31.0",
                "vulns": [
                    {
                        "id": "PYSEC-2024-100",
                        "fix_versions": ["2.32.0"],
                        "description": "Vulnerabilidade em requests"
                    }
                ]
            },
            {
                "name": "pyjwt",
                "version": "2.8.0",
                "vulns": [
                    {
                        "id": "PYSEC-2024-200",
                        "fix_versions": ["2.9.0"],
                        "description": "Vulnerabilidade em pyjwt"
                    }
                ]
            }
        ]
    }
    result = parse_pip_audit(sample_data)
    assert result["total"] == 2
    assert len(result["findings"]) == 2
    assert result["findings"][0]["package"] == "requests"
    assert result["findings"][0]["fix"] == "2.32.0"
    assert result["findings"][1]["package"] == "pyjwt"


def test_format_markdown_report_clean():
    backend_res = {"findings": [], "total": 0}
    frontend_res = {"counts": {"critical": 0, "high": 0, "moderate": 0, "low": 0}, "findings": [], "total": 0}
    
    report = format_markdown_report(backend_res, frontend_res)
    assert "Nenhuma vulnerabilidade detectada nas dependências do Backend" in report
    assert "Nenhuma vulnerabilidade detectada nas dependências do Frontend" in report


def test_format_markdown_report_with_findings():
    backend_res = {
        "findings": [
            {"package": "requests", "version": "2.31.0", "id": "PYSEC-2024-100", "fix": "2.32.0"}
        ],
        "total": 1
    }
    frontend_res = {
        "counts": {"critical": 1, "high": 2, "moderate": 0, "low": 0},
        "findings": [
            {"package": "axios", "severity": "critical", "is_direct": True, "range": "<1.6.0", "fix": "Sim"}
        ],
        "total": 3
    }
    
    report = format_markdown_report(backend_res, frontend_res)
    assert "Total de vulnerabilidades encontradas:** `1`" in report
    assert "`requests`" in report
    assert "PYSEC-2024-100" in report
    assert "Críticas: `1`" in report
    assert "`axios`" in report
    assert "**CRITICAL**" in report


def test_audit_frontend_missing_directory(tmp_path):
    non_existent = tmp_path / "inexistente"
    res = audit_frontend(non_existent)
    assert "error" in res


def test_audit_backend_missing_file(tmp_path):
    non_existent = tmp_path / "requirements_fantasma.txt"
    res = audit_backend(non_existent)
    assert "error" in res
