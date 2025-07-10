import sqlite3
from passlib.context import CryptContext

DB_PATH = '../monitor.db'  # 根据实际路径调整
NEW_PASSWORD = 'admin123'

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
new_hash = pwd_context.hash(NEW_PASSWORD)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("UPDATE users SET password_hash = ? WHERE username = 'admin'", (new_hash,))
conn.commit()
conn.close()

print(f"已将 admin 用户密码重置为: {NEW_PASSWORD}") 