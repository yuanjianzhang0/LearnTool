from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from openai import OpenAI
import json
import os
import sqlite3
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
import random
import re

APPSCRET_KEY = os.getenv('APPSCRET_KEY', '')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_SERVER = os.getenv('SMTP_SERVER', '')
SMTP_PORT = os.getenv('SMTP_PORT', 25)
SMTP_USER = os.getenv('SMTP_USER', '')

app = Flask(__name__)
app.secret_key = APPSCRET_KEY


# with open('key', 'r') as f:
#     DEEPSEEK_API_KEY = f.read().strip()


# os.environ['http_proxy'] = 'http://127.0.0.1:7890'
# os.environ['https_proxy'] = 'http://127.0.0.1:7890'

# with open('smtp_key', 'r') as f:
#     SMTP_PASSWORD = f.read().strip()

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
verification_codes = {}

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

def is_valid_email(email):
    return re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email) is not None

def send_email(to_email, code):
    msg = MIMEText(f'您的验证码是：{code}，有效期 5 分钟。', 'plain', 'utf-8')
    msg['Subject'] = '学习助手 - 密码重置验证码'
    msg['From'] = SMTP_USER
    msg['To'] = to_email
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

@app.route('/')
def advertisement():
    return render_template('advertisement.html')

@app.route('/index')
def index():
    if 'username' not in session:
        print("No username in session, redirecting to login")
        return redirect(url_for('login_page'))
    print(f"Rendering index for {session['username']}")
    return render_template('index.html', username=session['username'])

@app.route('/login', methods=['GET'])
def login_page():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    identifier = request.form['username']
    password = request.form['password']
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    if is_valid_email(identifier):
        c.execute('SELECT username, password FROM users WHERE email = ?', (identifier,))
    else:
        c.execute('SELECT username, password FROM users WHERE username = ?', (identifier,))
    result = c.fetchone()
    if result and result[1] == password:
        session['username'] = result[0]
        conn.close()
        print(f"Login successful for {result[0]}")
        return jsonify({'success': True})
    conn.close()
    print(f"Login failed for {identifier}")
    return jsonify({'success': False, 'error': '用户名/邮箱或密码错误'})

@app.route('/register', methods=['POST'])
def register():
    username = request.form['username']
    email = request.form['email']
    password = request.form['password']
    if not is_valid_email(email):
        return jsonify({'success': False, 'error': '请输入合法的邮箱地址'})
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT username, email FROM users WHERE username = ? OR email = ?', (username, email))
    result = c.fetchone()
    if result:
        conn.close()
        return jsonify({'success': False, 'error': '用户名或邮箱已存在'})
    c.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', (username, email, password))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/send_verification_code', methods=['POST'])
def send_verification_code():
    email = request.form['email']
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT username FROM users WHERE email = ?', (email,))
    result = c.fetchone()
    conn.close()
    if not result:
        return jsonify({'success': False, 'error': '该邮箱未注册'})
    code = str(random.randint(100000, 999999))
    if send_email(email, code):
        verification_codes[email] = {'code': code, 'timestamp': datetime.now().timestamp()}
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': '发送验证码失败，请稍后重试'})

@app.route('/reset_password', methods=['POST'])
def reset_password():
    email = request.form['email']
    code = request.form['code']
    new_password = request.form['new_password']
    if email not in verification_codes:
        return jsonify({'success': False, 'error': '请先获取验证码'})
    stored = verification_codes[email]
    if stored['code'] != code:
        return jsonify({'success': False, 'error': '验证码错误'})
    if (datetime.now().timestamp() - stored['timestamp']) > 300:
        del verification_codes[email]
        return jsonify({'success': False, 'error': '验证码已过期，请重新获取'})
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('UPDATE users SET password = ? WHERE email = ?', (new_password, email))
    conn.commit()
    conn.close()
    del verification_codes[email]
    return jsonify({'success': True})

@app.route('/generate_test', methods=['POST'])
def generate_test():
    if 'username' not in session:
        return jsonify({'error': '请先登录'}), 401
    data = request.get_json()
    subject = data.get('subject', '')
    knowledge_point = data.get('knowledge_point', '')
    num_questions = data.get('num_questions', 10)
    if not subject:
        return jsonify({'error': '请选择科目'}), 400
    prompt = f'''
    你是一个中国初中家庭教师，擅长生成评估题目。请根据给定的科目和知识点生成指定数量的选择题。
    科目：{subject}
    知识点：{knowledge_point}
    要求：
    1. 每题包含题目、四个选项和正确答案。
    2. 返回结果必须是有效的 JSON 格式，包含字段：question, options (数组), answer，要求纯文本，不要markdown下的json。
    3. 不要包含多余的说明文字，仅返回 JSON。
    示例格式：
    [{{"question": "1 + 2 = ?", "options": ["1", "2", "3", "4"], "answer": "3"}}]
    请为科目“{subject}”的知识点“{knowledge_point}”生成{num_questions}道选择题。
    '''
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{'role': 'system', 'content': '你是一个严格遵循指令的助手，只能返回指定格式的响应。'}, {'role': 'user', 'content': prompt}],
            stream=False,
            max_tokens=2000,
            temperature=0.5
        )
        test_content = json.loads(response.choices[0].message.content)
        conn = sqlite3.connect('database.db')
        c = conn.cursor()
        c.execute('INSERT INTO test_history (username, subject, knowledge_point, timestamp, questions) VALUES (?, ?, ?, ?, ?)',
                  (session['username'], subject, knowledge_point, datetime.now().isoformat(), json.dumps(test_content)))
        test_id = c.lastrowid
        conn.commit()
        conn.close()
        print(f"json.dumps(test_content): {jsonify({'questions': test_content, 'subject': subject, 'knowledge_point': knowledge_point, 'test_id': test_id})}")
        return jsonify({'questions': test_content, 'subject': subject, 'knowledge_point': knowledge_point, 'test_id': test_id})
    except Exception as e:
        print(f"Error generating test: {e}")
        return jsonify({'error': '生成试题失败，请稍后重试'}), 500

@app.route('/submit_test', methods=['POST'])
def submit_test():
    if 'username' not in session:
        return jsonify({'error': '请先登录'}), 401
    data = request.get_json()
    test_id = data.get('test_id')
    user_answers = data.get('user_answers', [])
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT questions, subject, knowledge_point, attempt_count FROM test_history WHERE id = ? AND username = ?',
              (test_id, session['username']))
    result = c.fetchone()
    if not result:
        conn.close()
        return jsonify({'error': '试题未找到'}), 404
    questions = json.loads(result[0])
    subject = result[1]
    knowledge_point = result[2]
    attempt_count = result[3] or 1

    # 计算结果和分析
    results = []
    correct_count = 0
    for i, q in enumerate(questions):
        user_answer = user_answers[i] if i < len(user_answers) else ''
        correct = user_answer == q['answer']
        if correct:
            correct_count += 1
        results.append({
            'question': q['question'],
            'user_answer': user_answer,
            'correct_answer': q['answer'],
            'correct': correct
        })
    accuracy = correct_count / len(questions) if questions else 0

    # 使用 AI 分析知识点掌握情况
    prompt = f'''
    你是一个中国初中家庭教师。根据学生的答题结果，分析其对科目“{subject}”的知识点“{knowledge_point}”的掌握情况。
    正确率：{accuracy * 100:.2f}%
    答题详情：{json.dumps(results, ensure_ascii=False)}
    要求：
    1. 返回 JSON 格式，包含字段：summary（总结）、weak_points（薄弱点数组）、suggestions（改进建议数组）。
    2. 仅返回 JSON，无多余说明。
    3. 使用纯文本，不要markdown格式下的json。
    示例：
    {{
        "summary": "学生对浮力的基本概念掌握较好，但应用题有困难",
        "weak_points": ["浮力计算", "单位换算"],
        "suggestions": ["复习浮力公式", "练习10道应用题"]
    }}
    '''
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{'role': 'system', 'content': '你是一个严格遵循指令的助手，只能返回指定格式的响应。'}, {'role': 'user', 'content': prompt}],
            max_tokens=1000,
            temperature=0.5
        )
        analysis = json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error analyzing test results: {e}")
        analysis = {
            "summary": "无法详细分析，请查看答题结果",
            "weak_points": ["未知"],
            "suggestions": ["复习基础知识"]
        }

    # 保存到数据库
    c.execute('UPDATE test_history SET accuracy = ?, user_answers = ?, results = ?, attempt_count = ?, analysis = ? WHERE id = ?',
              (accuracy, json.dumps(user_answers), json.dumps(results), attempt_count + 1, json.dumps(analysis), test_id))
    conn.commit()
    conn.close()
    return jsonify({
        'accuracy': accuracy,
        'results': results,
        'analysis': analysis,
        'subject': subject,
        'knowledge_point': knowledge_point,
        'test_id': test_id,
        'attempt_count': attempt_count + 1
    })

@app.route('/generate_learning_materials', methods=['POST'])
def generate_learning_materials():
    if 'username' not in session:
        return jsonify({'error': '请先登录'}), 401
    data = request.get_json()
    test_id = data.get('test_id')
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT subject, knowledge_point, accuracy FROM test_history WHERE id = ? AND username = ?',
              (test_id, session['username']))
    result = c.fetchone()
    if not result:
        conn.close()
        return jsonify({'error': '记录未找到'}), 404
    subject, knowledge_point, accuracy = result
    if accuracy is None:
        conn.close()
        return jsonify({'error': '请先提交答案以计算正确率'}), 400
    learning_path = generate_learning_path(subject, knowledge_point, accuracy)
    knowledge_graph = generate_knowledge_graph(subject, knowledge_point, accuracy)
    c.execute('UPDATE test_history SET learning_path = ?, knowledge_graph = ? WHERE id = ?',
              (json.dumps(learning_path), json.dumps(knowledge_graph), test_id))
    conn.commit()
    conn.close()
    return jsonify({'learning_path': learning_path, 'knowledge_graph': knowledge_graph})

@app.route('/get_history', methods=['GET'])
def get_history():
    if 'username' not in session:
        return jsonify({'error': '请先登录'}), 401
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT id, subject, knowledge_point, accuracy, timestamp, learning_path, knowledge_graph, questions, user_answers, results, attempt_count, analysis FROM test_history WHERE username = ? ORDER BY timestamp DESC',
              (session['username'],))
    history = [{'id': row[0], 'subject': row[1], 'knowledge_point': row[2], 'accuracy': row[3], 'timestamp': row[4],
                'learning_path': json.loads(row[5]) if row[5] else None,
                'knowledge_graph': json.loads(row[6]) if row[6] else None,
                'questions': json.loads(row[7]),
                'user_answers': json.loads(row[8]) if row[8] else None,
                'results': json.loads(row[9]) if row[9] else None,
                'attempt_count': row[10],
                'analysis': json.loads(row[11]) if row[11] else None} for row in c.fetchall()]
    conn.close()
    return jsonify({'history': history})

@app.route('/delete_history/<int:id>', methods=['POST'])
def delete_history(id):
    if 'username' not in session:
        return jsonify({'error': '请先登录'}), 401
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('DELETE FROM test_history WHERE id = ? AND username = ?', (id, session['username']))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/clear_history', methods=['POST'])
def clear_history():
    if 'username' not in session:
        return jsonify({'error': '请先登录'}), 401
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('DELETE FROM test_history WHERE username = ?', (session['username'],))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

def generate_learning_path(subject, knowledge_point, accuracy):
    accuracy_percent = f"{accuracy * 100:.2f}%"
    prompt = f'''
    你是一个中国初中家庭教师。根据学生对科目“{subject}”的知识点“{knowledge_point}”的评估结果（正确率 {accuracy_percent}），
    请生成一个详细且个性化的学习路径。返回结果为 JSON 格式，包含一个数组，数组元素为具体的学习建议字符串。
    要求：
    1. 学习路径应包含至少5个具体步骤。
    2. 每一步骤应包括明确的学习目标、方法或练习类型。
    3. 根据正确率调整建议：正确率低于50%时从基础开始，高于80%时增加挑战性内容。
    4. 要求纯文本，不要markdown格式下的json
    示例：
    ["复习浮力基本概念，通过教材例题理解", "完成5道浮力计算的基础练习题", "学习阿基米德原理，观看相关教学视频", "练习10道浮力应用题，掌握单位换算", "解决2道综合性浮力问题，提升分析能力"]
    '''
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=1000,
            temperature=0.5
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error generating learning path: {e}")
        return ["复习基础知识，阅读教材相关章节", "完成5道基础练习题", "联系老师获取帮助", "观看教学视频加深理解", "尝试解决简单应用题"]

def generate_knowledge_graph(subject, knowledge_point, accuracy):
    accuracy_percent = f"{accuracy * 100:.2f}%"
    prompt = f'''
    你是一个中国初中家庭教师。根据学生对科目“{subject}”的知识点“{knowledge_point}”的评估结果（正确率 {accuracy_percent}），
    请生成一个知识图谱。返回结果为有效的 JSON 格式，包含 nodes 和 edges 两个字段，nodes 为节点数组，edges 为边数组，要求纯文本，不要markdown格式下的json。
    要求：
    1. nodes 包含至少5个节点，每个节点有 id 和 label。
    2. edges 表示知识点之间的层级或依赖关系。
    3. 根据正确率调整图谱复杂度：正确率低于50%时展示基础知识点，高于80%时包含进阶内容。
    示例：
    {{"nodes": [{{"id": "root", "label": "物理"}}, {{"id": "n1", "label": "浮力基本概念"}}, {{"id": "n2", "label": "阿基米德原理"}}], "edges": [{{"from": "root", "to": "n1"}}, {{"from": "n1", "to": "n2"}}]}}
    '''
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{'role': 'system', 'content': '你是一个严格遵循指令的助手，只能返回有效的 JSON 字符串，不添加任何多余文本。'}, {'role': 'user', 'content': prompt}],
            max_tokens=1500,
            temperature=0.5
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error generating knowledge graph: {e}")
        return {"nodes": [{"id": "root", "label": f"{subject} - {knowledge_point}"}, {"id": "n1", "label": f"{knowledge_point}基础"}, {"id": "n2", "label": f"{knowledge_point}应用"}, {"id": "n3", "label": f"{knowledge_point}进阶"}, {"id": "n4", "label": "相关概念"}], "edges": [{"from": "root", "to": "n1"}, {"from": "n1", "to": "n2"}, {"from": "n2", "to": "n3"}, {"from": "root", "to": "n4"}]}

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login_page'))

if __name__ == '__main__':
    # app.run(debug=True)
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
