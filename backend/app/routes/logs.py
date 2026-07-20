"""
Rotas do Visualizador de Logs.

Permite listar os dias com logs disponíveis, carregar as linhas de um dia
(com limite) e apagar o arquivo de log de um dia diretamente no servidor.
"""

import os
import re
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.core.logger import (
    LOG_DIR,
    close_active_log_file,
    current_brasilia_date_str,
    logger,
)

router = APIRouter(prefix="/logs", tags=["logs"])

# Ex: [02/07/26 18:11:35 BRT] [INFO] [autoserver] mensagem...
LINE_RE = re.compile(
    r"^\[(?P<timestamp>\d{2}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}) BRT\] "
    r"\[(?P<level>[A-Z]+)\] \[(?P<source>[^\]]+)\] (?P<message>.*)$"
)

DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _validate_day(day: str) -> None:
    if not DAY_RE.match(day):
        raise HTTPException(status_code=400, detail="Formato de dia inválido. Use YYYY-MM-DD.")


def _log_file_path(day: str) -> str:
    return os.path.join(LOG_DIR, f"{day}.log")


def _parse_line(raw_line: str, line_number: int) -> dict:
    match = LINE_RE.match(raw_line)
    if match:
        return {
            "id": line_number,
            "timestamp": match.group("timestamp"),
            "level": match.group("level"),
            "source": match.group("source"),
            "message": match.group("message"),
            "raw": raw_line,
        }
    return {
        "id": line_number,
        "timestamp": None,
        "level": "UNKNOWN",
        "source": None,
        "message": raw_line,
        "raw": raw_line,
    }


@router.get("/days")
async def list_log_days():
    """Lista os dias que possuem arquivo de log, mais recente primeiro."""
    if not os.path.isdir(LOG_DIR):
        return {"days": []}

    days = []
    for filename in os.listdir(LOG_DIR):
        if not filename.endswith(".log"):
            continue
        day = filename[:-4]
        if not DAY_RE.match(day):
            continue
        path = os.path.join(LOG_DIR, filename)
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                total_lines = sum(1 for _ in f)
            size_bytes = os.path.getsize(path)
        except OSError:
            continue
        days.append({"day": day, "total_lines": total_lines, "size_bytes": size_bytes})

    days.sort(key=lambda d: d["day"], reverse=True)
    return {"days": days}


@router.get("")
async def get_logs(day: Optional[str] = None, limit: int = 2000):
    """Carrega as linhas de log de um dia específico (padrão: hoje), já parseadas."""
    day = day or current_brasilia_date_str()
    _validate_day(day)

    if limit <= 0 or limit > 20000:
        limit = 2000

    path = _log_file_path(day)
    if not os.path.exists(path):
        logger.debug(f"Visualizador de Logs: nenhum arquivo encontrado para o dia {day}")
        return {"day": day, "total": 0, "returned": 0, "lines": []}

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        all_lines = [line.rstrip("\n") for line in f]

    total = len(all_lines)
    tail = all_lines[-limit:]
    start_index = total - len(tail)

    parsed = [
        _parse_line(raw, start_index + i + 1)
        for i, raw in enumerate(tail)
    ]

    logger.debug(f"Visualizador de Logs: carregadas {len(parsed)}/{total} linha(s) do dia {day}")

    return {"day": day, "total": total, "returned": len(parsed), "lines": parsed}


@router.delete("/{day}")
async def delete_log_day(day: str):
    """Apaga o arquivo de log de um dia específico diretamente no servidor."""
    _validate_day(day)
    path = _log_file_path(day)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Nenhum log encontrado para esse dia.")

    try:
        if day == current_brasilia_date_str():
            # Solta o arquivo do dia atual antes de apagar (necessário no Windows)
            close_active_log_file()
        os.remove(path)
    except OSError as exc:
        logger.error(f"Falha ao apagar log do dia {day}: {exc}")
        raise HTTPException(status_code=500, detail="Não foi possível apagar o log no servidor.")

    logger.info(f"Log do dia {day} apagado no servidor via Visualizador de Logs.")
    return {"detail": f"Log do dia {day} apagado com sucesso."}


from pydantic import BaseModel
from typing import List

class DeleteLinesRequest(BaseModel):
    line_ids: List[int]  # IDs correspondentes aos índices das linhas (1-indexed baseados em total)

@router.post("/{day}/delete-lines")
async def delete_log_lines(day: str, req: DeleteLinesRequest):
    """Apaga linhas específicas de log baseando-se em seus IDs (1-indexed no arquivo)."""
    _validate_day(day)
    path = _log_file_path(day)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Arquivo de log não encontrado.")

    if not req.line_ids:
        return {"status": "success", "message": "Nenhuma linha especificada."}

    try:
        # Se for o dia atual, fecha a stream ativa para podermos reescrever sem locks no Windows
        if day == current_brasilia_date_str():
            close_active_log_file()

        # Lê todas as linhas do arquivo original
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = [line.rstrip("\n") for line in f]

        lines_to_delete_set = set(req.line_ids)
        # Filtra as linhas que não estão no set de remoção
        new_lines = [
            line for i, line in enumerate(all_lines)
            if (i + 1) not in lines_to_delete_set
        ]

        # Reescreve o arquivo
        with open(path, "w", encoding="utf-8") as f:
            for line in new_lines:
                f.write(line + "\n")

        removed_count = len(all_lines) - len(new_lines)
        logger.info(f"Visualizador de Logs: Apagadas {removed_count} linhas do log do dia {day}.")
        return {
            "status": "success",
            "message": f"Sucesso: {removed_count} linha(s) de log apagada(s).",
            "deleted_count": removed_count
        }

    except Exception as e:
        logger.error(f"Erro ao apagar linhas de log: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao apagar linhas do log: {str(e)}")
