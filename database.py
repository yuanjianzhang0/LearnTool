import sqlite3
def init_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (username TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS test_history 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, 
                  subject TEXT, knowledge_point TEXT, accuracy REAL, timestamp TEXT,
                  learning_path TEXT, knowledge_graph TEXT, questions TEXT,
                  user_answers TEXT, results TEXT, attempt_count INTEGER DEFAULT 1,
                  analysis TEXT)''')  # 新增 analysis 列
    conn.commit()
    conn.close()

init_db()
print('Database initialized.')