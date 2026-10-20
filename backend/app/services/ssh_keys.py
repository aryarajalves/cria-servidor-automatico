import io
import logging
import paramiko
from typing import Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)

def parse_private_key(key_text: str, passphrase: Optional[str] = None) -> Tuple[Any, str]:
    """
    Analisa e valida o texto de uma chave privada SSH (RSA, Ed25519, ECDSA, DSS).
    Retorna o objeto de chave (Paramiko ou Cryptography) e o tipo detectado (ex: 'RSA', 'ED25519', 'ECDSA').
    """
    if not key_text or not key_text.strip():
        raise ValueError("O conteúdo da chave privada não pode ser vazio.")

    clean_key = key_text.strip().replace("\r\n", "\n")
    key_file = io.StringIO(clean_key)
    
    # 1. Tenta carregar via Paramiko
    key_classes = [
        ("RSA", paramiko.RSAKey),
        ("ED25519", paramiko.Ed25519Key),
        ("ECDSA", paramiko.ECDSAKey)
    ]
    if hasattr(paramiko, "DSSKey"):
        key_classes.append(("DSS", getattr(paramiko, "DSSKey")))
    
    passphrase_needed = False
    
    for type_name, key_cls in key_classes:
        key_file.seek(0)
        try:
            pkey = key_cls.from_private_key(key_file, password=passphrase if passphrase else None)
            logger.info(f"Chave privada carregada via Paramiko. Tipo: {type_name}")
            return pkey, type_name
        except paramiko.PasswordRequiredException:
            passphrase_needed = True
            break
        except Exception:
            continue
            
    if passphrase_needed:
        raise ValueError("Esta chave privada está criptografada com senha (passphrase). Por favor, forneça a senha da chave.")

    # 2. Fallback robusto via Cryptography
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ed25519, rsa, ec, dsa
        
        pw_bytes = passphrase.encode("utf-8") if passphrase else None
        crypto_key = None
        
        try:
            crypto_key = serialization.load_ssh_private_key(clean_key.encode("utf-8"), password=pw_bytes)
        except TypeError:
            raise ValueError("Esta chave privada está protegida por senha. Informe a senha no campo correspondente.")
        except Exception:
            try:
                crypto_key = serialization.load_pem_private_key(clean_key.encode("utf-8"), password=pw_bytes)
            except TypeError:
                raise ValueError("Esta chave privada está protegida por senha. Informe a senha no campo correspondente.")
            except Exception:
                pass

        if crypto_key:
            if isinstance(crypto_key, ed25519.Ed25519PrivateKey):
                return crypto_key, "ED25519"
            elif isinstance(crypto_key, rsa.RSAPrivateKey):
                return crypto_key, "RSA"
            elif isinstance(crypto_key, ec.EllipticCurvePrivateKey):
                return crypto_key, "ECDSA"
            elif isinstance(crypto_key, dsa.DSAPrivateKey):
                return crypto_key, "DSA"
            return crypto_key, "CUSTOM"
    except ValueError:
        raise
    except Exception as e:
        logger.warning(f"Erro no fallback cryptography: {e}")

    raise ValueError("Formato de chave privada inválido ou incompleto. Certifique-se de colar o bloco completo iniciando com '-----BEGIN ... PRIVATE KEY-----' e terminando com '-----END ... PRIVATE KEY-----'.")

def extract_public_key(pkey: Any, comment: str = "") -> str:
    """
    Extrai a chave pública no formato OpenSSH padrão (ex: 'ssh-ed25519 AAAA... comment').
    """
    if hasattr(pkey, "get_name") and hasattr(pkey, "get_base64"):
        key_type = pkey.get_name()
        base64_data = pkey.get_base64()
        if comment:
            return f"{key_type} {base64_data} {comment}".strip()
        return f"{key_type} {base64_data}"
    
    if hasattr(pkey, "public_key"):
        from cryptography.hazmat.primitives import serialization
        pub = pkey.public_key()
        pub_bytes = pub.public_bytes(
            encoding=serialization.Encoding.OpenSSH,
            format=serialization.PublicFormat.OpenSSH
        )
        pub_str = pub_bytes.decode("utf-8").strip()
        if comment:
            return f"{pub_str} {comment}".strip()
        return pub_str

    return ""

def generate_key_pair(name: str, key_type: str = "RSA", bits: int = 2048) -> Dict[str, Any]:
    """
    Gera um novo par de chaves SSH (Privada e Pública).
    Suporta tipos 'RSA' (padrão 2048/4096 bits) e 'ED25519'.
    """
    key_type_upper = key_type.upper()
    
    if key_type_upper == "ED25519":
        from cryptography.hazmat.primitives.asymmetric import ed25519
        from cryptography.hazmat.primitives import serialization
        
        priv = ed25519.Ed25519PrivateKey.generate()
        private_pem = priv.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.OpenSSH,
            encryption_algorithm=serialization.NoEncryption()
        ).decode("utf-8")
        
        pub = priv.public_key()
        pub_openssh = pub.public_bytes(
            encoding=serialization.Encoding.OpenSSH,
            format=serialization.PublicFormat.OpenSSH
        ).decode("utf-8")
        
        public_key_str = f"{pub_openssh.strip()} {name}" if name else pub_openssh.strip()
        
        return {
            "name": name,
            "private_key": private_pem,
            "public_key": public_key_str,
            "key_type": "ED25519"
        }
    else:
        # RSA padrão
        rsa_bits = 4096 if bits == 4096 else 2048
        key = paramiko.RSAKey.generate(rsa_bits)
        out = io.StringIO()
        key.write_private_key(out)
        private_pem = out.getvalue()
        public_key_str = extract_public_key(key, comment=name)
        
        return {
            "name": name,
            "private_key": private_pem,
            "public_key": public_key_str,
            "key_type": f"RSA-{rsa_bits}"
        }
