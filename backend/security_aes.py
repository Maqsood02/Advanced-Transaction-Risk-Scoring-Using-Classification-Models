import os
from cryptography.fernet import Fernet

KEY_FILE = "secret.key"

# Ensure we have a persistent key for decryption across server restarts
if os.path.exists(KEY_FILE):
    with open(KEY_FILE, "rb") as f:
        AES_KEY = f.read()
else:
    AES_KEY = Fernet.generate_key()
    with open(KEY_FILE, "wb") as f:
        f.write(AES_KEY)

cipher = Fernet(AES_KEY)

def encrypt_field(text: str) -> str:
    """Encrypts text using AES-256 (Fernet)."""
    if not text:
        return ""
    return cipher.encrypt(text.encode('utf-8')).decode('utf-8')

def decrypt_field(cipher_text: str) -> str:
    """Decrypts text using AES-256 (Fernet)."""
    if not cipher_text:
        return ""
    try:
        return cipher.decrypt(cipher_text.encode('utf-8')).decode('utf-8')
    except Exception:
        return cipher_text
