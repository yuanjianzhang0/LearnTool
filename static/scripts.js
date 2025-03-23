let currentQuestions = [];
let currentSubject = '';
let currentKnowledgePoint = '';
let currentTestId = null;
let testState = null;
let progressChart = null;

// 注册 ChartDataLabels 插件
Chart.register(ChartDataLabels);

function showSection(section) {
    document.querySelectorAll('.content > div').forEach(div => div.style.display = 'none');
    const targetSection = document.getElementById(section + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
    } else {
        console.error(`Section ${section}-section not found`);
    }
    
    if (section === 'history') {
        loadHistory();
    } else if (section === 'test') {
        restoreTestState();
    } else if (section === 'results') {
        if (!testState) {
            const resultDiv = document.getElementById('test-result-detail');
            if (resultDiv) resultDiv.innerHTML = '<p>暂无评估结果，请先完成测试。</p>';
        } else {
            renderTestResultsFromState();
        }
    }
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const response = await fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    });
    const data = await response.json();
    
    if (data.success) {
        window.location.href = '/';
    } else {
        document.getElementById('login-error').textContent = '登录失败，请检查用户名或密码';
    }
}

function showProgress(textElementId, barElementId, progressElementId, text, expectedTime) {
    const progressText = document.getElementById(textElementId);
    const progressBar = document.getElementById(barElementId);
    const progress = document.getElementById(progressElementId);
    
    progressText.textContent = text;
    progressText.style.display = 'block';
    progressBar.style.display = 'block';
    progress.style.width = '0%';
    
    const totalSteps = 90;
    const intervalTime = expectedTime * 1000 / totalSteps;
    let width = 0;
    
    const interval = setInterval(() => {
        if (width >= totalSteps) {
            clearInterval(interval);
        } else {
            width += 1;
            progress.style.width = `${width}%`;
        }
    }, intervalTime);
    
    return interval;
}

function hideProgress(interval, textElementId, barElementId, progressElementId) {
    clearInterval(interval);
    const progressText = document.getElementById(textElementId);
    const progressBar = document.getElementById(barElementId);
    const progress = document.getElementById(progressElementId);
    
    progress.style.width = '100%';
    setTimeout(() => {
        progressText.style.display = 'none';
        progressBar.style.display = 'none';
    }, 300);
}

async function generateTest() {
    const subject = document.getElementById('subject').value;
    const knowledgePoint = document.getElementById('knowledge-point').value;
    const numQuestions = document.getElementById('num-questions').value;
    
    if (!subject) {
        alert('请选择科目');
        return;
    }
    if (!knowledgePoint) {
        alert('请输入知识点');
        return;
    }
    
    const expectedTime = 13.92;
    const progressInterval = showProgress('progress-text', 'progress-bar', 'progress', '正在生成试题...', expectedTime);

    const response = await fetch('/generate_test', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({subject, knowledge_point: knowledgePoint, num_questions: numQuestions})
    });
    const data = await response.json();
    hideProgress(progressInterval, 'progress-text', 'progress-bar', 'progress');

    if (data.error) {
        document.getElementById('test-questions').innerHTML = `<p class="error">${data.error}</p>`;
        return;
    }

    currentQuestions = data.questions;
    currentSubject = data.subject;
    currentKnowledgePoint = data.knowledge_point;
    currentTestId = data.test_id;
    testState = null;
    renderQuestions();
    document.getElementById('submit-test').style.display = 'block';
    document.getElementById('redo-test').style.display = 'none';
    document.getElementById('test-result').innerHTML = '';
}

function renderQuestions() {
    const questionsDiv = document.getElementById('test-questions');
    questionsDiv.innerHTML = currentQuestions.map((q, index) => `
        <div class="question" id="question-${index}">
            <p>${index + 1}. ${q.question}</p>
            ${q.options.map((opt, i) => `
                <div class="option">
                    <input type="radio" id="q${index}-${i}" name="q${index}" value="${opt}">
                    <label for="q${index}-${i}">${opt}</label>
                </div>
            `).join('')}
        </div>
    `).join('');
}

async function submitTest() {
    const userAnswers = currentQuestions.map((q, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        return selected ? selected.value : '';
    });

    const expectedTime = 5; // 提交预计时间
    const progressInterval = showProgress('progress-text', 'progress-bar', 'progress', '正在提交评估...', expectedTime);

    const response = await fetch('/submit_test', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            test_id: currentTestId,
            user_answers: userAnswers
        })
    });
    const data = await response.json();
    hideProgress(progressInterval, 'progress-text', 'progress-bar', 'progress');

    if (data.error) {
        document.getElementById('test-result').innerHTML = `<p class="error">${data.error}</p>`;
        return;
    }

    testState = {
        results: data.results,
        accuracy: data.accuracy,
        analysis: data.analysis, // 新增：存储分析结果
        subject: data.subject,
        knowledgePoint: data.knowledge_point
    };
    renderQuestions(); // 重新渲染题目以显示反馈
    renderTestResults(); // 在测试页面显示初步结果
    document.getElementById('submit-test').style.display = 'none';
    document.getElementById('redo-test').style.display = 'block';
    showSection('results'); // 提交后切换到评估结果页面
}

function renderTestResults() {
    const questionsDiv = document.getElementById('test-questions');
    testState.results.forEach((r, index) => {
        const questionDiv = document.getElementById(`question-${index}`);
        const resultSpan = document.createElement('span');
        resultSpan.className = r.correct ? 'result correct' : 'result incorrect';
        resultSpan.textContent = r.correct ? '✓' : '✗';
        questionDiv.appendChild(resultSpan);

        const options = questionDiv.querySelectorAll('.option');
        options.forEach(opt => {
            const label = opt.querySelector('label');
            const input = opt.querySelector('input');
            if (label.textContent === r.correct_answer) {
                opt.classList.add('correct');
            }
            if (label.textContent === r.user_answer && !r.correct) {
                opt.classList.add('incorrect');
            }
            if (label.textContent === r.user_answer) {
                input.checked = true;
            }
        });

        const feedback = document.createElement('div');
        feedback.className = 'answer-feedback';
        feedback.textContent = `正确答案是：${r.correct_answer} | 你的答案是：${r.user_answer || '未选择'}`;
        questionDiv.appendChild(feedback);
    });

    // 在测试页面显示简要结果
    document.getElementById('test-result').innerHTML = `
        <p>正确率: ${(testState.accuracy * 100).toFixed(2)}%</p>
        <button class="btn" onclick="generateLearningMaterials()">生成学习路径和知识图谱</button>
    `;
    
    // 在评估结果页面显示详细结果
    renderTestResultsFromState();
}

function toggleWrongQuestions(element) {
    const wrongList = element.nextElementSibling;
    if (wrongList.style.display === 'none' || wrongList.style.display === '') {
        wrongList.style.display = 'block';
        element.querySelector('i').className = 'icon-wrong icon-collapse';
    } else {
        wrongList.style.display = 'none';
        element.querySelector('i').className = 'icon-wrong';
    }
}
function renderTestResultsFromState() {
    const resultDiv = document.getElementById('test-result-detail');
    if (!resultDiv) {
        console.error("Element 'test-result-detail' not found in DOM");
        return;
    }

    if (!testState) {
        resultDiv.innerHTML = '<p class="no-data">暂无评估结果，请先完成测试。</p>';
        return;
    }

    resultDiv.innerHTML = `
        <div class="result-card">
            <div class="result-header">
                <h3>${testState.subject} - ${testState.knowledgePoint}</h3>
                <p class="accuracy">正确率: <span class="highlight">${(testState.accuracy * 100).toFixed(2)}%</span></p>
            </div>
            <div class="result-body">
                ${testState.analysis ? `
                    <div class="analysis-section">
                        <h4><i class="icon-summary"></i>总结</h4>
                        <p>${testState.analysis.summary}</p>
                    </div>
                    <div class="analysis-section">
                        <h4><i class="icon-weak"></i>薄弱点</h4>
                        <ul class="weak-points">
                            ${testState.analysis.weak_points.map(wp => `<li>${wp}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="analysis-section">
                        <h4><i class="icon-suggestion"></i>改进建议</h4>
                        <ol class="suggestions">
                            ${testState.analysis.suggestions.map(s => `<li>${s}</li>`).join('')}
                        </ol>
                    </div>
                ` : '<p class="no-data">分析数据暂不可用</p>'}
            </div>
            <div class="result-footer">
                <h4 class="toggle-wrong" onclick="toggleWrongQuestions(this)"><i class="icon-wrong"></i>错题回顾</h4>
                <ul class="wrong-questions" style="display: none;">
                    ${testState.results.filter(r => !r.correct).map(r => `
                        <li>
                            <span class="question-text">${r.question}</span><br>
                            <span class="user-answer">你的答案: <span class="incorrect">${r.user_answer || '未选择'}</span></span><br>
                            <span class="correct-answer">正确答案: <span class="correct">${r.correct_answer}</span></span>
                        </li>
                    `).join('') || '<li class="no-wrong">无错题</li>'}
                </ul>
            </div>
        </div>
    `;
    console.log("Test results rendered successfully");
}

async function generateLearningMaterials() {
    const expectedTime = 25;
    const progressInterval = showProgress('results-progress-text', 'results-progress-bar', 'results-progress', '正在生成学习路径和知识图谱...', expectedTime);
    
    const response = await fetch('/generate_learning_materials', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({test_id: currentTestId})
    });
    const data = await response.json();
    hideProgress(progressInterval, 'results-progress-text', 'results-progress-bar', 'results-progress');

    if (data.error) {
        document.getElementById('test-result').innerHTML += `<p class="error">${data.error}</p>`;
        return;
    }

    updateLearningPath(data.learning_path);
    updateKnowledgeGraph(data.knowledge_graph);
    showSection('path'); // 默认显示学习路径
}

async function regenerateMaterials(testId, section) {
    const expectedTime = 25;
    const textElementId = section === 'path' ? 'path-progress-text' : section === 'graph' ? 'graph-progress-text' : 'results-progress-text';
    const barElementId = section === 'path' ? 'path-progress-bar' : section === 'graph' ? 'graph-progress-bar' : 'results-progress-bar';
    const progressElementId = section === 'path' ? 'path-progress' : section === 'graph' ? 'graph-progress' : 'results-progress';
    const progressInterval = showProgress(textElementId, barElementId, progressElementId, '正在生成...', expectedTime);

    const response = await fetch('/generate_learning_materials', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({test_id: testId})
    });
    const data = await response.json();
    hideProgress(progressInterval, textElementId, barElementId, progressElementId);

    if (data.error) {
        alert(data.error);
        return;
    }

    if (section === 'path') {
        updateLearningPath(data.learning_path);
    } else if (section === 'graph') {
        updateKnowledgeGraph(data.knowledge_graph);
    }
}

function restoreTestState() {
    if (currentQuestions.length > 0) {
        renderQuestions();
        if (testState) {
            renderTestResults();
            document.getElementById('submit-test').style.display = 'none';
            document.getElementById('redo-test').style.display = 'block';
        } else {
            document.getElementById('submit-test').style.display = 'block';
            document.getElementById('redo-test').style.display = 'none';
            document.getElementById('test-result').innerHTML = '';
        }
    }
}

function redoTest() {
    testState = null;
    renderQuestions();
    document.getElementById('submit-test').style.display = 'block';
    document.getElementById('redo-test').style.display = 'none';
    document.getElementById('test-result').innerHTML = '';
    document.getElementById('test-result-detail').innerHTML = '';
}

function updateLearningPath(path) {
    const pathDiv = document.getElementById('learning-path');
    pathDiv.innerHTML = path.map((step, index) => `
        <div class="path-step">
            <div class="path-step-icon">${index + 1}</div>
            <div class="path-step-content">${step}</div>
        </div>
    `).join('');
}

function updateKnowledgeGraph(graph) {
    const container = document.getElementById('knowledge-graph');
    if (!container) {
        console.error("Knowledge graph container not found!");
        return;
    }
    
    container.innerHTML = '';
    try {
        const nodes = new vis.DataSet(graph.nodes.map((node, index) => {
            if (!node.id || !node.label) throw new Error("Invalid node format");
            return {
                id: node.id,
                label: node.label,
                font: { size: 20 },
                color: index === 0 ? '#e74c3c' : '#3498db',
                shape: index === 0 ? 'circle' : 'box',
                size: 30
            };
        }));
        const edges = new vis.DataSet(graph.edges.map(edge => {
            if (!edge.from || !edge.to) throw new Error("Invalid edge format");
            return {
                from: edge.from,
                to: edge.to,
                length: 150
            };
        }));
        const data = { nodes, edges };
        const options = {
            layout: {
                hierarchical: {
                    direction: 'LR',
                    sortMethod: 'directed'
                }
            },
            physics: { enabled: false },
            edges: {
                color: '#2c3e50',
                width: 2
            }
        };
        new vis.Network(container, data, options);
        console.log("Knowledge graph rendered successfully");
    } catch (e) {
        console.error("Error rendering knowledge graph:", e);
        container.innerHTML = `<p class="error">知识图谱渲染失败：${e.message}</p>`;
    }
}

async function loadHistory() {
    const response = await fetch('/get_history');
    const data = await response.json();
    
    if (data.error) {
        document.getElementById('history-list').innerHTML = `<p class="error">${data.error}</p>`;
        return;
    }
    
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = data.history.map(h => `
        <div class="history-item">
            <div class="history-item-header">
                <div>
                    <span class="history-item-title">${h.subject} - ${h.knowledge_point}</span>
                    <span class="history-item-details"> - 正确率 ${(h.accuracy !== null ? (h.accuracy * 100).toFixed(2) : '未提交')}% (第 ${h.attempt_count} 次)</span>
                </div>
                <div class="history-item-actions">
                    <button class="btn btn-small" onclick="viewQuestions('${h.id}')">查看试题</button>
                    <button class="btn btn-small" onclick="viewResults('${h.id}')">查看评估结果</button>
                    <button class="btn btn-small" onclick="viewPath('${h.id}')">查看学习路径</button>
                    <button class="btn btn-small" onclick="viewGraph('${h.id}')">查看知识图谱</button>
                    <button class="btn btn-small btn-danger" onclick="deleteHistory(${h.id})">删除</button>
                </div>
            </div>
            <div class="history-item-details">${new Date(h.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
    
    updateSubjectSelect(data.history);
}

function viewResults(id) {
    fetch('/get_history').then(response => response.json()).then(data => {
        const record = data.history.find(h => h.id == id);
        if (record.results) {
            testState = {
                results: record.results,
                accuracy: record.accuracy,
                analysis: record.analysis,
                subject: record.subject,
                knowledgePoint: record.knowledge_point
            };
            renderTestResultsFromState();
            showSection('results');
        } else {
            document.getElementById('test-result-detail').innerHTML = '<p>该测试尚未提交，无法查看评估结果。</p>';
            showSection('results');
        }
    });
}

function updateSubjectSelect(history) {
    const subjectSelect = document.getElementById('subject-select');
    subjectSelect.value = '';
    updateKnowledgePointSelect(history);
}

function updateKnowledgePointSelect(history = null) {
    if (!history) {
        fetch('/get_history').then(response => response.json()).then(data => updateKnowledgePointSelect(data.history));
        return;
    }

    const subjectSelect = document.getElementById('subject-select');
    const selectedSubject = subjectSelect.value;
    const knowledgePointSelect = document.getElementById('knowledge-point-select');
    
    if (!selectedSubject) {
        knowledgePointSelect.innerHTML = '<option value="">请先选择科目</option>';
    } else {
        const filteredHistory = history.filter(h => h.subject === selectedSubject);
        const uniqueKnowledgePoints = [...new Set(filteredHistory.map(h => h.knowledge_point))];
        knowledgePointSelect.innerHTML = '<option value="">选择知识点</option>' + uniqueKnowledgePoints.map(kp => `
            <option value="${kp}">${kp}</option>
        `).join('');
    }
    
    updateProgressChart(history);
}

function updateProgressChart(history = null) {
    if (!history) {
        fetch('/get_history').then(response => response.json()).then(data => updateProgressChart(data.history));
        return;
    }

    const subjectSelect = document.getElementById('subject-select');
    const knowledgePointSelect = document.getElementById('knowledge-point-select');
    const selectedSubject = subjectSelect.value;
    const selectedKp = knowledgePointSelect.value;
    
    const filteredHistory = selectedSubject ? history.filter(h => h.subject === selectedSubject && h.accuracy !== null) : [];
    const finalHistory = selectedKp ? filteredHistory.filter(h => h.knowledge_point === selectedKp) : filteredHistory;

    const labels = finalHistory.map(h => `ID ${h.id}`);
    const data = finalHistory.map(h => ({
        x: h.id,
        y: (h.accuracy * 100).toFixed(2),
        timestamp: new Date(h.timestamp).toLocaleString()
    }));

    const ctx = document.getElementById('progress-chart').getContext('2d');
    if (progressChart) {
        progressChart.destroy();
    }

    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${selectedSubject || '所有科目'} ${selectedKp || '所有知识点'} 正确率 (%)`,
                data: data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: '正确率 (%)' }
                },
                x: {
                    title: { display: true, text: '测试 ID' }
                }
            },
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return `正确率: ${point.y}% | 时间: ${point.timestamp}`;
                        }
                    }
                },
                datalabels: {
                    display: true,
                    align: 'top',
                    formatter: (value) => value.timestamp.split(' ')[0]
                }
            }
        }
    });
}

function viewQuestions(id) {
    fetch('/get_history').then(response => response.json()).then(data => {
        const record = data.history.find(h => h.id == id);
        currentQuestions = record.questions;
        currentSubject = record.subject;
        currentKnowledgePoint = record.knowledge_point;
        currentTestId = record.id;
        testState = record.results ? {
            results: record.results,
            accuracy: record.accuracy,
            analysis: record.analysis,
            subject: record.subject,
            knowledgePoint: record.knowledge_point
        } : null;
        renderQuestions();
        if (testState) {
            renderTestResults();
            document.getElementById('submit-test').style.display = 'none';
            document.getElementById('redo-test').style.display = 'block';
        } else {
            document.getElementById('submit-test').style.display = 'block';
            document.getElementById('redo-test').style.display = 'none';
            document.getElementById('test-result').innerHTML = '';
        }
        showSection('test');
    });
}

function viewPath(id) {
    fetch('/get_history').then(response => response.json()).then(data => {
        const record = data.history.find(h => h.id == id);
        const pathDiv = document.getElementById('learning-path');
        if (record.learning_path) {
            updateLearningPath(record.learning_path);
        } else {
            pathDiv.innerHTML = `
                <div class="not-generated">
                    <p>学习路径未生成，请生成。</p>
                    <button class="btn" onclick="regenerateMaterials('${id}', 'path')">重新生成</button>
                </div>
            `;
        }
        showSection('path');
    });
}

function viewGraph(id) {
    fetch('/get_history').then(response => response.json()).then(data => {
        const record = data.history.find(h => h.id == id);
        const graphDiv = document.getElementById('knowledge-graph');
        if (record.knowledge_graph) {
            updateKnowledgeGraph(record.knowledge_graph);
        } else {
            graphDiv.innerHTML = `
                <div class="not-generated">
                    <p>知识图谱未生成，请生成。</p>
                    <button class="btn" onclick="regenerateMaterials('${id}', 'graph')">重新生成</button>
                </div>
            `;
        }
        showSection('graph');
    });
}

async function deleteHistory(id) {
    if (confirm('确定删除这条记录吗？')) {
        const response = await fetch(`/delete_history/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        const data = await response.json();
        if (data.success) {
            loadHistory();
        }
    }
}

async function clearHistory() {
    if (confirm('确定清除所有历史记录吗？')) {
        const response = await fetch('/clear_history', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        const data = await response.json();
        if (data.success) {
            loadHistory();
        }
    }
}