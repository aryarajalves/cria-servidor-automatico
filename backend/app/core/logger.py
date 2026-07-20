"""
Configuração central de logging do backend.

Objetivo: permitir depurar (debug) todas as requisições e processos do sistema,
mostrando SEMPRE data/hora no horário de Brasília e o nível do log
(DEBUG, INFO, WARNING, ERROR, CRITICAL).

Uso em qualquer módulo:
    from app.core.logger import logger
    logger.debug("mensagem")
    logger.info("mensagem")
    logger.warning("mensagem")
    logger.error("mensagem")
    logger.critical("mensagem")
"""

import logging
import os
import sys
from datetime import datetime

try:
    from zoneinfo import ZoneInfo
    BR_TZ = ZoneInfo("America/Sao_Paulo")
except Exception:
    # Fallback caso o banco de timezones (tzdata) não esteja disponível no SO
    from datetime import timezone, timedelta
    BR_TZ = timezone(timedelta(hours=-3))

LOG_FORMAT = "[%(asctime)s BRT] [%(levelname)s] [%(name)s] %(message)s"
DATE_FORMAT = "%d/%m/%y %H:%M:%S"


class BrasiliaFormatter(logging.Formatter):
    """Formatter que converte o timestamp do log para o horário de Brasília,
    independente do fuso horário configurado no servidor/container."""

    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=BR_TZ)
        return dt.strftime(datefmt or DATE_FORMAT)


# Diretório onde os arquivos de log diários são gravados (usado pelo Visualizador de Logs)
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "logs")
LOG_RETENTION_DAYS = 30


class DailyBrasiliaFileHandler(logging.Handler):
    """Handler que grava os logs em um arquivo por dia (YYYY-MM-DD.log),
    usando sempre a data no horário de Brasília para decidir o arquivo,
    independente do fuso horário do servidor/container."""

    def __init__(self, log_dir: str):
        super().__init__()
        self.log_dir = log_dir
        os.makedirs(self.log_dir, exist_ok=True)
        self._current_date = None
        self._stream = None

    def _date_str(self, record) -> str:
        return datetime.fromtimestamp(record.created, tz=BR_TZ).strftime("%Y-%m-%d")

    def _file_path(self, date_str: str) -> str:
        return os.path.join(self.log_dir, f"{date_str}.log")

    def emit(self, record):
        try:
            date_str = self._date_str(record)
            if date_str != self._current_date or self._stream is None:
                if self._stream:
                    self._stream.close()
                self._current_date = date_str
                self._stream = open(self._file_path(date_str), "a", encoding="utf-8")
            self._stream.write(self.format(record) + "\n")
            self._stream.flush()
        except Exception:
            self.handleError(record)

    def close(self):
        if self._stream:
            self._stream.close()
            self._stream = None
        super().close()


def _cleanup_old_logs() -> None:
    """Remove arquivos de log com mais de LOG_RETENTION_DAYS dias."""
    try:
        if not os.path.isdir(LOG_DIR):
            return
        limite = datetime.now(tz=BR_TZ).date()
        for filename in os.listdir(LOG_DIR):
            if not filename.endswith(".log"):
                continue
            date_part = filename[:-4]
            try:
                file_date = datetime.strptime(date_part, "%Y-%m-%d").date()
            except ValueError:
                continue
            if (limite - file_date).days > LOG_RETENTION_DAYS:
                os.remove(os.path.join(LOG_DIR, filename))
    except Exception:
        # Limpeza de logs nunca deve derrubar a aplicação
        pass


# Referência ao handler de arquivo ativo, usada pelo Visualizador de Logs
# para poder "soltar" o arquivo do dia atual antes de apagá-lo (o Windows
# bloqueia a exclusão de arquivos que estejam abertos por um processo).
_file_handler_ref: "DailyBrasiliaFileHandler" = None


def setup_logging() -> None:
    """Configura o logging da aplicação inteira (root logger + uvicorn)."""
    global _file_handler_ref

    level_name = os.getenv("LOG_LEVEL", "DEBUG").upper()
    level = getattr(logging, level_name, logging.DEBUG)

    formatter = BrasiliaFormatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    file_handler = DailyBrasiliaFileHandler(LOG_DIR)
    file_handler.setFormatter(formatter)
    _file_handler_ref = file_handler

    handlers = [console_handler, file_handler]

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers = handlers

    # Garante que os logs do uvicorn (servidor) usem o mesmo formato/horário/arquivo
    for uvicorn_logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_logger = logging.getLogger(uvicorn_logger_name)
        uv_logger.handlers = handlers
        uv_logger.propagate = False
        uv_logger.setLevel(level)

    _cleanup_old_logs()


def close_active_log_file() -> None:
    """Fecha o arquivo de log do dia atual (ele é reaberto automaticamente no
    próximo log). Deve ser chamado antes de apagar o arquivo do dia corrente."""
    if _file_handler_ref is not None:
        if _file_handler_ref._stream:
            _file_handler_ref._stream.close()
            _file_handler_ref._stream = None
            _file_handler_ref._current_date = None


def current_brasilia_date_str() -> str:
    """Retorna a data de hoje (YYYY-MM-DD) no horário de Brasília."""
    return datetime.now(tz=BR_TZ).strftime("%Y-%m-%d")


# Logger principal da aplicação, pronto para ser importado em qualquer módulo
logger = logging.getLogger("autoserver")
