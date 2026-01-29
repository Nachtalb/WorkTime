// ==================== DATABASE ====================
const DB_NAME = 'WorkTimeDB';
const DB_VERSION = 1;

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Projects store
                if (!db.objectStoreNames.contains('projects')) {
                    const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
                    projectStore.createIndex('number', 'number', { unique: false });
                    projectStore.createIndex('lastUsed', 'lastUsed', { unique: false });
                }

                // Tasks store
                if (!db.objectStoreNames.contains('tasks')) {
                    const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    taskStore.createIndex('projectId', 'projectId', { unique: false });
                    taskStore.createIndex('startTime', 'startTime', { unique: false });
                }

                // Global sessions store (for tracking work sessions)
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                    sessionStore.createIndex('date', 'date', { unique: false });
                }

                // App state store
                if (!db.objectStoreNames.contains('state')) {
                    db.createObjectStore('state', { keyPath: 'key' });
                }
            };
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// ==================== STATE MANAGEMENT ====================
class AppState {
    constructor(db) {
        this.db = db;
        this.currentPage = 'landing';
        this.globalTimerStart = null;
        this.currentSessionId = null;
        this.activeProjectId = null;
        this.activeTaskId = null;
        this.selectedProjectIndex = 0;
        this.selectedTaskIndex = -1;
        this.filterText = '';
        this.isTypingNewTask = false;
        this.isRenamingTask = false;
        this.isRenamingProject = false;
        this.originalTaskDescription = '';
        this.undoStack = [];
    }

    async save() {
        await this.db.put('state', {
            key: 'appState',
            currentPage: this.currentPage,
            globalTimerStart: this.globalTimerStart,
            currentSessionId: this.currentSessionId,
            activeProjectId: this.activeProjectId,
            activeTaskId: this.activeTaskId,
            selectedProjectIndex: this.selectedProjectIndex
        });
    }

    async load() {
        const saved = await this.db.get('state', 'appState');
        if (saved) {
            this.currentPage = saved.currentPage || 'landing';
            this.globalTimerStart = saved.globalTimerStart;
            this.currentSessionId = saved.currentSessionId;
            this.activeProjectId = saved.activeProjectId;
            this.activeTaskId = saved.activeTaskId;
            this.selectedProjectIndex = saved.selectedProjectIndex || 0;
        }
    }
}

// ==================== UTILITIES ====================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(ms) {
    if (!ms || ms < 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatTimeShort(ms) {
    if (!ms || ms < 0) return '0m';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function formatTimeHHMM(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function isToday(date) {
    return isSameDay(date, new Date());
}

function isYesterday(date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(date, yesterday);
}

function getRelativeDate(date) {
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    return formatDateShort(date);
}

function getTodayStart() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

// ==================== MAIN APP ====================
class WorkTimeApp {
    constructor() {
        this.db = new Database();
        this.state = null;
        this.timerInterval = null;
        this.clockInterval = null;
    }

    async init() {
        await this.db.init();
        this.state = new AppState(this.db);
        await this.state.load();
        await this.ensureOtherProjectExists();

        this.setupEventListeners();
        this.startClock();
        this.startTimerUpdates();

        // Restore to saved page
        this.navigateTo(this.state.currentPage);
    }

    async ensureOtherProjectExists() {
        const projects = await this.db.getAll('projects');
        const otherProject = projects.find(p => p.isOther);

        if (!otherProject) {
            await this.db.put('projects', {
                id: 'other',
                number: '0',
                name: 'Other',
                isOther: true,
                createdAt: Date.now(),
                lastUsed: Date.now()
            });
        }
    }

    // ==================== NAVIGATION ====================
    navigateTo(page, projectId = null) {
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.getElementById(`${page}-page`).classList.remove('hidden');

        this.state.currentPage = page;
        this.state.filterText = '';
        this.state.isTypingNewTask = false;
        this.state.isRenamingTask = false;
        this.state.isRenamingProject = false;
        this.state.selectedTaskIndex = -1;

        if (page === 'overview') {
            this.state.selectedProjectIndex = 0;
            this.renderOverview();
        } else if (page === 'project' && projectId) {
            this.state.activeProjectId = projectId;
            this.renderProject();
        } else if (page === 'landing') {
            this.updateLandingTime();
        }

        this.state.save();
        this.updateFilterDisplay();
    }

    // ==================== CLOCK & TIMERS ====================
    startClock() {
        this.updateLandingTime();
        this.clockInterval = setInterval(() => this.updateLandingTime(), 1000);
    }

    updateLandingTime() {
        const now = new Date();
        document.getElementById('current-time').textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        document.getElementById('current-date').textContent = formatDate(now);
    }

    startTimerUpdates() {
        this.timerInterval = setInterval(() => this.updateTimerDisplays(), 1000);
    }

    async updateTimerDisplays() {
        const globalTime = this.state.globalTimerStart ? Date.now() - this.state.globalTimerStart : 0;

        // Get active task time
        let taskTime = 0;
        if (this.state.activeTaskId) {
            const task = await this.db.get('tasks', this.state.activeTaskId);
            if (task && task.startTime && !task.endTime) {
                taskTime = Date.now() - task.startTime;
            }
        }

        // Update overview page timers
        const overviewGlobal = document.getElementById('overview-global-time');
        const overviewTask = document.getElementById('overview-task-time');
        if (overviewGlobal) {
            overviewGlobal.textContent = formatTime(globalTime);
        }
        if (overviewTask) {
            if (taskTime > 0) {
                overviewTask.textContent = `Active task: ${formatTime(taskTime)}`;
                overviewTask.classList.add('active');
            } else {
                overviewTask.textContent = '';
                overviewTask.classList.remove('active');
            }
        }

        // Update project page timers
        const projectGlobal = document.getElementById('project-global-time');
        const projectTask = document.getElementById('project-task-time');
        if (projectGlobal) {
            projectGlobal.textContent = formatTime(globalTime);
        }
        if (projectTask) {
            if (taskTime > 0) {
                projectTask.textContent = `Active task: ${formatTime(taskTime)}`;
                projectTask.classList.add('active');
            } else {
                projectTask.textContent = '';
                projectTask.classList.remove('active');
            }
        }

        // Update active task duration in task list
        if (this.state.currentPage === 'project') {
            const activeTaskEl = document.querySelector('.task-item.active .task-duration');
            if (activeTaskEl && taskTime > 0) {
                activeTaskEl.textContent = formatTime(taskTime);
            }
        }
    }

    // ==================== GLOBAL TIMER ====================
    async startGlobalTimer() {
        if (this.state.globalTimerStart) return; // Already started

        this.state.globalTimerStart = Date.now();
        this.state.currentSessionId = generateId();

        await this.db.put('sessions', {
            id: this.state.currentSessionId,
            date: getTodayStart().getTime(),
            startTime: this.state.globalTimerStart,
            endTime: null
        });

        await this.state.save();
        this.navigateTo('overview');
    }

    async stopGlobalTimer() {
        if (!this.state.globalTimerStart) return;

        // Stop active task first
        await this.stopActiveTask();

        // End session
        if (this.state.currentSessionId) {
            const session = await this.db.get('sessions', this.state.currentSessionId);
            if (session) {
                session.endTime = Date.now();
                await this.db.put('sessions', session);
            }
        }

        this.state.globalTimerStart = null;
        this.state.currentSessionId = null;
        this.state.activeProjectId = null;
        this.state.activeTaskId = null;

        await this.state.save();
    }

    // ==================== PROJECTS ====================
    async getProjects() {
        const projects = await this.db.getAll('projects');
        return projects.sort((a, b) => b.lastUsed - a.lastUsed);
    }

    async getFilteredProjects() {
        const projects = await this.getProjects();
        if (!this.state.filterText) return projects;

        return projects.filter(p =>
            p.number.startsWith(this.state.filterText) ||
            (p.name && p.name.toLowerCase().includes(this.state.filterText.toLowerCase()))
        );
    }

    async createProject(number, name = '') {
        const id = generateId();
        const project = {
            id,
            number,
            name,
            isOther: false,
            createdAt: Date.now(),
            lastUsed: Date.now()
        };

        await this.db.put('projects', project);
        return project;
    }

    async deleteProject(projectId) {
        const project = await this.db.get('projects', projectId);
        if (project && project.isOther) return; // Can't delete Other

        // Delete all tasks for this project
        const tasks = await this.db.getByIndex('tasks', 'projectId', projectId);
        for (const task of tasks) {
            await this.db.delete('tasks', task.id);
        }

        await this.db.delete('projects', projectId);

        if (this.state.activeProjectId === projectId) {
            this.state.activeProjectId = null;
            this.state.activeTaskId = null;
        }

        await this.state.save();
    }

    async renameProject(projectId, newName) {
        const project = await this.db.get('projects', projectId);
        if (project && !project.isOther) {
            project.name = newName;
            await this.db.put('projects', project);
        }
    }

    async getProjectDurationToday(projectId) {
        const tasks = await this.db.getByIndex('tasks', 'projectId', projectId);
        const todayStart = getTodayStart().getTime();

        let totalDuration = 0;
        for (const task of tasks) {
            if (task.startTime >= todayStart) {
                if (task.endTime) {
                    totalDuration += task.endTime - task.startTime;
                } else if (task.id === this.state.activeTaskId) {
                    totalDuration += Date.now() - task.startTime;
                }
            }
        }

        return totalDuration;
    }

    async getProjectDurationTotal(projectId) {
        const tasks = await this.db.getByIndex('tasks', 'projectId', projectId);

        let totalDuration = 0;
        for (const task of tasks) {
            if (task.endTime) {
                totalDuration += task.endTime - task.startTime;
            } else if (task.id === this.state.activeTaskId) {
                totalDuration += Date.now() - task.startTime;
            }
        }

        return totalDuration;
    }

    // ==================== TASKS ====================
    async getProjectTasks(projectId) {
        const tasks = await this.db.getByIndex('tasks', 'projectId', projectId);
        return tasks.sort((a, b) => b.startTime - a.startTime);
    }

    async createTask(projectId, description) {
        // Stop any active task first
        await this.stopActiveTask();

        const id = generateId();
        const task = {
            id,
            projectId,
            description,
            startTime: Date.now(),
            endTime: null
        };

        await this.db.put('tasks', task);

        // Update project last used
        const project = await this.db.get('projects', projectId);
        if (project) {
            project.lastUsed = Date.now();
            await this.db.put('projects', project);
        }

        this.state.activeProjectId = projectId;
        this.state.activeTaskId = id;

        // Add to undo stack
        this.state.undoStack.push({ type: 'createTask', taskId: id, projectId });

        await this.state.save();
        return task;
    }

    async stopActiveTask() {
        if (!this.state.activeTaskId) return;

        const task = await this.db.get('tasks', this.state.activeTaskId);
        if (task && !task.endTime) {
            task.endTime = Date.now();
            await this.db.put('tasks', task);
        }

        this.state.activeTaskId = null;
    }

    async startTask(taskId) {
        // Stop any active task
        await this.stopActiveTask();

        const task = await this.db.get('tasks', taskId);
        if (!task) return;

        // Create a new task entry with same description
        await this.createTask(task.projectId, task.description);
    }

    async deleteTask(taskId) {
        const task = await this.db.get('tasks', taskId);
        if (!task) return;

        // If this was the active task, try to restore previous
        if (this.state.activeTaskId === taskId) {
            this.state.activeTaskId = null;

            // Check undo stack for previous task
            const lastUndo = this.state.undoStack[this.state.undoStack.length - 2];
            if (lastUndo && lastUndo.type === 'createTask' && lastUndo.taskId !== taskId) {
                const prevTask = await this.db.get('tasks', lastUndo.taskId);
                if (prevTask) {
                    // Restart the previous task
                    await this.createTask(prevTask.projectId, prevTask.description);
                }
            }
        }

        await this.db.delete('tasks', taskId);
    }

    async updateTaskDescription(taskId, description) {
        const task = await this.db.get('tasks', taskId);
        if (task) {
            task.description = description;
            await this.db.put('tasks', task);
        }
    }

    async getLastTask(projectId) {
        const tasks = await this.getProjectTasks(projectId);
        return tasks[0] || null;
    }

    // ==================== RENDERING ====================
    async renderOverview() {
        const projects = await this.getFilteredProjects();
        const grid = document.getElementById('projects-grid');
        grid.innerHTML = '';

        for (let i = 0; i < projects.length; i++) {
            const project = projects[i];
            const lastTask = await this.getLastTask(project.id);
            const durationToday = await this.getProjectDurationToday(project.id);
            const durationTotal = await this.getProjectDurationTotal(project.id);

            const card = document.createElement('div');
            card.className = 'project-card';
            card.dataset.projectId = project.id;
            card.dataset.index = i;

            if (i === this.state.selectedProjectIndex) {
                card.classList.add('selected');
            }

            if (project.id === this.state.activeProjectId) {
                card.classList.add('active');
            }

            card.innerHTML = `
                <div class="card-title">
                    <span class="card-number">${project.isOther ? 'O' : project.number}</span>
                    <span>${project.name || (project.isOther ? 'Other' : 'Unnamed Project')}</span>
                </div>
                <div class="card-last-task">${lastTask ? lastTask.description : 'No tasks yet'}</div>
                <div class="card-tags">
                    <span class="tag">Started ${formatDateShort(new Date(project.createdAt))}</span>
                    <span class="tag" data-tooltip="${formatDateShort(new Date(project.lastUsed))}">Last: ${getRelativeDate(new Date(project.lastUsed))}</span>
                    <span class="tag duration">Total: ${formatTimeShort(durationTotal)}</span>
                </div>
            `;

            card.addEventListener('click', () => this.openProject(project.id));
            grid.appendChild(card);
        }

        this.updateFilterDisplay();
    }

    async renderProject() {
        const project = await this.db.get('projects', this.state.activeProjectId);
        if (!project) return;

        // Render title
        const titleEl = document.getElementById('project-title');
        titleEl.innerHTML = `
            <span class="card-number">${project.isOther ? 'O' : project.number}</span>
            <span class="project-name">${project.name || (project.isOther ? 'Other' : 'Unnamed Project')}</span>
        `;

        // Render tags
        const tagsEl = document.getElementById('project-tags');
        const durationToday = await this.getProjectDurationToday(project.id);
        const durationTotal = await this.getProjectDurationTotal(project.id);

        tagsEl.innerHTML = `
            <span class="tag">Started ${formatDateShort(new Date(project.createdAt))}</span>
            <span class="tag" data-tooltip="${formatDateShort(new Date(project.lastUsed))}">Last: ${getRelativeDate(new Date(project.lastUsed))}</span>
            <span class="tag duration">Today: ${formatTimeShort(durationToday)}</span>
            <span class="tag duration">Total: ${formatTimeShort(durationTotal)}</span>
        `;

        // Render tasks grouped by day
        await this.renderTasks();
    }

    async renderTasks() {
        const tasks = await this.getProjectTasks(this.state.activeProjectId);
        const container = document.getElementById('tasks-container');
        container.innerHTML = '';

        // Group tasks by day
        const tasksByDay = {};
        for (const task of tasks) {
            const dayKey = new Date(task.startTime).toDateString();
            if (!tasksByDay[dayKey]) {
                tasksByDay[dayKey] = [];
            }
            tasksByDay[dayKey].push(task);
        }

        // Render each day
        const dayKeys = Object.keys(tasksByDay).sort((a, b) => new Date(b) - new Date(a));
        let globalIndex = 0;

        for (const dayKey of dayKeys) {
            const dayTasks = tasksByDay[dayKey];
            const dayDate = new Date(dayKey);

            // Calculate day total
            let dayTotal = 0;
            for (const task of dayTasks) {
                if (task.endTime) {
                    dayTotal += task.endTime - task.startTime;
                } else if (task.id === this.state.activeTaskId) {
                    dayTotal += Date.now() - task.startTime;
                }
            }

            const section = document.createElement('div');
            section.className = 'day-section';

            section.innerHTML = `
                <div class="day-header">
                    <span>${getRelativeDate(dayDate)} - ${formatDateShort(dayDate)}</span>
                    <span class="day-total">${formatTimeShort(dayTotal)}</span>
                </div>
            `;

            for (const task of dayTasks) {
                const taskEl = document.createElement('div');
                taskEl.className = 'task-item';
                taskEl.dataset.taskId = task.id;
                taskEl.dataset.index = globalIndex;

                if (globalIndex === this.state.selectedTaskIndex) {
                    taskEl.classList.add('selected');
                }

                if (task.id === this.state.activeTaskId) {
                    taskEl.classList.add('active');
                }

                const duration = task.endTime ?
                    task.endTime - task.startTime :
                    (task.id === this.state.activeTaskId ? Date.now() - task.startTime : 0);

                taskEl.innerHTML = `
                    <div class="task-time-info">
                        <div class="task-start-time">${formatTimeHHMM(new Date(task.startTime))}</div>
                        <div class="task-duration ${task.id === this.state.activeTaskId ? 'active' : ''}">${formatTime(duration)}</div>
                    </div>
                    <div class="task-description">${task.description}</div>
                `;

                taskEl.addEventListener('click', () => {
                    this.state.selectedTaskIndex = parseInt(taskEl.dataset.index);
                    this.updateTaskSelection();
                });

                section.appendChild(taskEl);
                globalIndex++;
            }

            container.appendChild(section);
        }
    }

    updateTaskSelection() {
        document.querySelectorAll('.task-item').forEach(el => {
            el.classList.remove('selected');
            if (parseInt(el.dataset.index) === this.state.selectedTaskIndex) {
                el.classList.add('selected');
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    updateProjectSelection() {
        document.querySelectorAll('.project-card').forEach(el => {
            el.classList.remove('selected');
            if (parseInt(el.dataset.index) === this.state.selectedProjectIndex) {
                el.classList.add('selected');
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    updateFilterDisplay() {
        const display = document.getElementById('filter-display');
        if (this.state.filterText) {
            display.innerHTML = `<span>Filter: ${this.state.filterText}</span>`;
        } else {
            display.innerHTML = '';
        }
    }

    async openProject(projectId) {
        this.navigateTo('project', projectId);
    }

    // ==================== NEW TASK INPUT ====================
    showNewTaskInput() {
        this.state.isTypingNewTask = true;
        const container = document.getElementById('new-task-input-container');
        const input = document.getElementById('new-task-input');
        container.classList.remove('hidden');
        input.value = '';
        input.focus();
    }

    hideNewTaskInput() {
        this.state.isTypingNewTask = false;
        const container = document.getElementById('new-task-input-container');
        const input = document.getElementById('new-task-input');
        container.classList.add('hidden');
        input.value = '';
    }

    async submitNewTask() {
        const input = document.getElementById('new-task-input');
        const description = input.value.trim();

        if (description) {
            await this.createTask(this.state.activeProjectId, description);
            this.hideNewTaskInput();
            await this.renderProject();
        }
    }

    // ==================== TASK RENAMING ====================
    startRenamingTask(taskIndex) {
        const taskEl = document.querySelector(`.task-item[data-index="${taskIndex}"]`);
        if (!taskEl) return;

        this.state.isRenamingTask = true;
        const descEl = taskEl.querySelector('.task-description');
        this.state.originalTaskDescription = descEl.textContent;

        descEl.innerHTML = `<input type="text" value="${descEl.textContent}">`;
        const input = descEl.querySelector('input');
        input.focus();
        input.select();
    }

    async finishRenamingTask(save = true) {
        if (!this.state.isRenamingTask) return;

        const taskEl = document.querySelector(`.task-item[data-index="${this.state.selectedTaskIndex}"]`);
        if (!taskEl) return;

        const input = taskEl.querySelector('.task-description input');
        const taskId = taskEl.dataset.taskId;

        if (save && input) {
            const newDescription = input.value.trim();
            if (newDescription) {
                await this.updateTaskDescription(taskId, newDescription);
            }
        }

        this.state.isRenamingTask = false;
        await this.renderTasks();
    }

    // ==================== PROJECT RENAMING ====================
    showRenameProjectPopup() {
        const project = this.db.get('projects', this.state.activeProjectId);
        project.then(p => {
            if (p && p.isOther) return; // Can't rename Other

            this.state.isRenamingProject = true;
            const popup = document.getElementById('rename-popup');
            const input = document.getElementById('rename-input');
            popup.classList.remove('hidden');
            input.value = p.name || '';
            input.focus();
            input.select();
        });
    }

    hideRenameProjectPopup() {
        this.state.isRenamingProject = false;
        document.getElementById('rename-popup').classList.add('hidden');
    }

    async submitRenameProject() {
        const input = document.getElementById('rename-input');
        const newName = input.value.trim();

        await this.renameProject(this.state.activeProjectId, newName);
        this.hideRenameProjectPopup();
        await this.renderProject();
    }

    // ==================== DELETE CONFIRMATIONS ====================
    showDeleteProjectPopup(projectId) {
        this.db.get('projects', projectId).then(project => {
            if (project && project.isOther) return;

            this.pendingDeleteProjectId = projectId;
            const popup = document.getElementById('delete-popup');
            const message = document.getElementById('delete-message');
            message.textContent = `Are you sure you want to delete project "${project.name || project.number}"?`;
            popup.classList.remove('hidden');
        });
    }

    showDeleteTaskPopup(taskId) {
        this.db.get('tasks', taskId).then(task => {
            if (!task) return;

            this.pendingDeleteTaskId = taskId;
            const popup = document.getElementById('delete-popup');
            const message = document.getElementById('delete-message');
            message.textContent = `Are you sure you want to delete task "${task.description}"?`;
            popup.classList.remove('hidden');
        });
    }

    hideDeletePopup() {
        document.getElementById('delete-popup').classList.add('hidden');
        this.pendingDeleteProjectId = null;
        this.pendingDeleteTaskId = null;
    }

    async confirmDelete() {
        if (this.pendingDeleteProjectId) {
            await this.deleteProject(this.pendingDeleteProjectId);
            this.hideDeletePopup();
            await this.renderOverview();
        } else if (this.pendingDeleteTaskId) {
            await this.deleteTask(this.pendingDeleteTaskId);
            this.hideDeletePopup();
            this.state.selectedTaskIndex = -1;
            await this.renderTasks();
        }
    }

    // ==================== HELP POPUP ====================
    showHelpPopup() {
        const popup = document.getElementById('help-popup');
        const content = document.getElementById('help-shortcuts');

        let shortcuts = [];

        if (this.state.currentPage === 'landing') {
            shortcuts = [
                { keys: 'Enter', description: 'Start global timer and go to Overview' }
            ];
        } else if (this.state.currentPage === 'overview') {
            shortcuts = [
                { keys: '1-9, 0', description: 'Filter projects by number' },
                { keys: '↑ ↓ ← →', description: 'Navigate between projects' },
                { keys: 'Enter', description: 'Open selected project' },
                { keys: 'N', description: 'Create new project' },
                { keys: 'O', description: 'Open "Other" project' },
                { keys: 'Delete', description: 'Delete selected project' },
                { keys: 'Escape', description: 'Stop timers and go to Landing' },
                { keys: 'Ctrl+S', description: 'Export today as TXT' },
                { keys: 'Ctrl+E', description: 'Export today as CSV' },
                { keys: 'Ctrl+Shift+E', description: 'Full database export (JSON)' },
                { keys: 'Ctrl+Shift+I', description: 'Import database (JSON)' },
                { keys: 'Ctrl+O', description: 'Show today overview' },
                { keys: '?', description: 'Show this help' }
            ];
        } else if (this.state.currentPage === 'project') {
            shortcuts = [
                { keys: 'Start typing', description: 'Create new task' },
                { keys: '↑ ↓', description: 'Navigate between tasks' },
                { keys: 'Enter', description: 'Start selected task / Confirm rename' },
                { keys: 'F2', description: 'Rename project' },
                { keys: 'Delete', description: 'Delete selected task' },
                { keys: 'Escape', description: 'Cancel / Go back to Overview' },
                { keys: 'Ctrl+S', description: 'Export project today as TXT' },
                { keys: 'Ctrl+E', description: 'Export project today as CSV' },
                { keys: 'Ctrl+Shift+S', description: 'Export full project as TXT' },
                { keys: 'Ctrl+Shift+E', description: 'Export full project as CSV' },
                { keys: '?', description: 'Show this help' }
            ];
        }

        content.innerHTML = shortcuts.map(s => `
            <div class="shortcut-item">
                <span class="shortcut-desc">${s.description}</span>
                <span class="shortcut-keys"><kbd>${s.keys}</kbd></span>
            </div>
        `).join('');

        popup.classList.remove('hidden');
    }

    hideHelpPopup() {
        document.getElementById('help-popup').classList.add('hidden');
    }

    // ==================== TODAY OVERVIEW POPUP ====================
    async showTodayOverviewPopup() {
        const popup = document.getElementById('today-popup');
        const statsEl = document.getElementById('today-stats');
        const timelineEl = document.getElementById('today-timeline');
        const chartEl = document.getElementById('today-chart');

        const todayStart = getTodayStart().getTime();

        // Get today's sessions
        const allSessions = await this.db.getAll('sessions');
        const todaySessions = allSessions.filter(s => s.date === todayStart);

        // Calculate total work time
        let totalWorkTime = 0;
        for (const session of todaySessions) {
            const endTime = session.endTime || Date.now();
            totalWorkTime += endTime - session.startTime;
        }

        // Get project stats for today
        const projects = await this.getProjects();
        const projectStats = [];

        for (const project of projects) {
            const duration = await this.getProjectDurationToday(project.id);
            if (duration > 0) {
                projectStats.push({
                    name: project.name || (project.isOther ? 'Other' : `Project ${project.number}`),
                    duration
                });
            }
        }

        projectStats.sort((a, b) => b.duration - a.duration);
        const maxDuration = projectStats.length > 0 ? projectStats[0].duration : 1;

        // Render stats
        statsEl.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${formatTime(totalWorkTime)}</div>
                <div class="stat-label">Total Work Time</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${todaySessions.length}</div>
                <div class="stat-label">Sessions</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${projectStats.length}</div>
                <div class="stat-label">Projects Worked</div>
            </div>
        `;

        // Render timeline
        timelineEl.innerHTML = `
            <div class="timeline-header">Work Sessions</div>
            <div class="timeline-sessions">
                ${todaySessions.map(s => `
                    <div class="session-item">
                        <span class="session-time">${formatTimeHHMM(new Date(s.startTime))} - ${s.endTime ? formatTimeHHMM(new Date(s.endTime)) : 'ongoing'}</span>
                        <span class="session-duration">${formatTime(( s.endTime || Date.now()) - s.startTime)}</span>
                    </div>
                `).join('')}
            </div>
        `;

        // Render chart
        chartEl.innerHTML = `
            <div class="chart-title">Time by Project</div>
            <div class="chart-bars">
                ${projectStats.map(p => `
                    <div class="chart-bar-item">
                        <span class="chart-bar-label">${p.name}</span>
                        <div class="chart-bar-container">
                            <div class="chart-bar" style="width: ${(p.duration / maxDuration) * 100}%"></div>
                        </div>
                        <span class="chart-bar-value">${formatTimeShort(p.duration)}</span>
                    </div>
                `).join('')}
            </div>
        `;

        popup.classList.remove('hidden');
    }

    hideTodayOverviewPopup() {
        document.getElementById('today-popup').classList.add('hidden');
    }

    // ==================== IMPORT POPUP ====================
    showImportPopup() {
        const popup = document.getElementById('import-popup');
        const input = document.getElementById('import-file');
        input.value = '';
        popup.classList.remove('hidden');
    }

    hideImportPopup() {
        document.getElementById('import-popup').classList.add('hidden');
    }

    // ==================== EXPORT / IMPORT ====================
    async exportTodayTxt() {
        const todayStart = getTodayStart();
        const projects = await this.getProjects();
        let output = `WorkTime Report - ${formatDate(todayStart)}\n`;
        output += '='.repeat(50) + '\n\n';

        // Get sessions
        const allSessions = await this.db.getAll('sessions');
        const todaySessions = allSessions.filter(s => s.date === todayStart.getTime());

        if (todaySessions.length > 0) {
            output += 'Work Sessions:\n';
            for (const session of todaySessions) {
                output += `  ${formatTimeHHMM(new Date(session.startTime))} - ${session.endTime ? formatTimeHHMM(new Date(session.endTime)) : 'ongoing'}\n`;
            }
            output += '\n';
        }

        for (const project of projects) {
            const tasks = await this.getProjectTasks(project.id);
            const todayTasks = tasks.filter(t => t.startTime >= todayStart.getTime());

            if (todayTasks.length === 0) continue;

            const durationToday = await this.getProjectDurationToday(project.id);
            output += `\n${project.name || (project.isOther ? 'Other' : `Project ${project.number}`)} (${formatTimeShort(durationToday)})\n`;
            output += '-'.repeat(40) + '\n';

            for (const task of todayTasks) {
                const duration = task.endTime ? task.endTime - task.startTime : (task.id === this.state.activeTaskId ? Date.now() - task.startTime : 0);
                output += `  ${formatTimeHHMM(new Date(task.startTime))} [${formatTimeShort(duration)}] ${task.description}\n`;
            }
        }

        this.downloadFile(output, `worktime-${formatDateShort(todayStart).replace(/\s/g, '-')}.txt`, 'text/plain');
    }

    async exportTodayCsv() {
        const todayStart = getTodayStart();
        const projects = await this.getProjects();
        let csv = 'Project,Date,Start Time,Duration (minutes),Description\n';

        for (const project of projects) {
            const tasks = await this.getProjectTasks(project.id);
            const todayTasks = tasks.filter(t => t.startTime >= todayStart.getTime());

            for (const task of todayTasks) {
                const duration = task.endTime ? task.endTime - task.startTime : (task.id === this.state.activeTaskId ? Date.now() - task.startTime : 0);
                const projectName = project.name || (project.isOther ? 'Other' : `Project ${project.number}`);
                csv += `"${projectName}","${formatDateShort(new Date(task.startTime))}","${formatTimeHHMM(new Date(task.startTime))}",${Math.round(duration / 60000)},"${task.description.replace(/"/g, '""')}"\n`;
            }
        }

        this.downloadFile(csv, `worktime-${formatDateShort(todayStart).replace(/\s/g, '-')}.csv`, 'text/csv');
    }

    async exportProjectTodayTxt() {
        const project = await this.db.get('projects', this.state.activeProjectId);
        if (!project) return;

        const todayStart = getTodayStart();
        const tasks = await this.getProjectTasks(project.id);
        const todayTasks = tasks.filter(t => t.startTime >= todayStart.getTime());
        const durationToday = await this.getProjectDurationToday(project.id);

        let output = `${project.name || (project.isOther ? 'Other' : `Project ${project.number}`)} - ${formatDate(todayStart)}\n`;
        output += '='.repeat(50) + '\n';
        output += `Started: ${formatDateShort(new Date(project.createdAt))}\n`;
        output += `Last used: ${getRelativeDate(new Date(project.lastUsed))}\n`;
        output += `Today: ${formatTimeShort(durationToday)}\n`;
        output += '-'.repeat(40) + '\n\n';

        for (const task of todayTasks) {
            const duration = task.endTime ? task.endTime - task.startTime : (task.id === this.state.activeTaskId ? Date.now() - task.startTime : 0);
            output += `${formatTimeHHMM(new Date(task.startTime))} [${formatTimeShort(duration)}] ${task.description}\n`;
        }

        const projectSlug = (project.name || project.number).replace(/\s/g, '-').toLowerCase();
        this.downloadFile(output, `${projectSlug}-${formatDateShort(todayStart).replace(/\s/g, '-')}.txt`, 'text/plain');
    }

    async exportProjectTodayCsv() {
        const project = await this.db.get('projects', this.state.activeProjectId);
        if (!project) return;

        const todayStart = getTodayStart();
        const tasks = await this.getProjectTasks(project.id);
        const todayTasks = tasks.filter(t => t.startTime >= todayStart.getTime());

        let csv = 'Date,Start Time,Duration (minutes),Description\n';

        for (const task of todayTasks) {
            const duration = task.endTime ? task.endTime - task.startTime : (task.id === this.state.activeTaskId ? Date.now() - task.startTime : 0);
            csv += `"${formatDateShort(new Date(task.startTime))}","${formatTimeHHMM(new Date(task.startTime))}",${Math.round(duration / 60000)},"${task.description.replace(/"/g, '""')}"\n`;
        }

        const projectSlug = (project.name || project.number).replace(/\s/g, '-').toLowerCase();
        this.downloadFile(csv, `${projectSlug}-${formatDateShort(todayStart).replace(/\s/g, '-')}.csv`, 'text/csv');
    }

    async exportProjectFullTxt() {
        const project = await this.db.get('projects', this.state.activeProjectId);
        if (!project) return;

        const tasks = await this.getProjectTasks(project.id);
        const durationTotal = await this.getProjectDurationTotal(project.id);

        let output = `${project.name || (project.isOther ? 'Other' : `Project ${project.number}`)} - Full History\n`;
        output += '='.repeat(50) + '\n';
        output += `Started: ${formatDateShort(new Date(project.createdAt))}\n`;
        output += `Last used: ${getRelativeDate(new Date(project.lastUsed))}\n`;
        output += `Total duration: ${formatTimeShort(durationTotal)}\n`;
        output += '-'.repeat(40) + '\n\n';

        // Group by day
        const tasksByDay = {};
        for (const task of tasks) {
            const dayKey = new Date(task.startTime).toDateString();
            if (!tasksByDay[dayKey]) tasksByDay[dayKey] = [];
            tasksByDay[dayKey].push(task);
        }

        const dayKeys = Object.keys(tasksByDay).sort((a, b) => new Date(b) - new Date(a));

        for (const dayKey of dayKeys) {
            const dayTasks = tasksByDay[dayKey];
            output += `\n${dayKey}\n`;

            for (const task of dayTasks) {
                const duration = task.endTime ? task.endTime - task.startTime : (task.id === this.state.activeTaskId ? Date.now() - task.startTime : 0);
                output += `  ${formatTimeHHMM(new Date(task.startTime))} [${formatTimeShort(duration)}] ${task.description}\n`;
            }
        }

        const projectSlug = (project.name || project.number).replace(/\s/g, '-').toLowerCase();
        this.downloadFile(output, `${projectSlug}-full.txt`, 'text/plain');
    }

    async exportProjectFullCsv() {
        const project = await this.db.get('projects', this.state.activeProjectId);
        if (!project) return;

        const tasks = await this.getProjectTasks(project.id);

        let csv = 'Date,Start Time,Duration (minutes),Description\n';

        for (const task of tasks) {
            const duration = task.endTime ? task.endTime - task.startTime : (task.id === this.state.activeTaskId ? Date.now() - task.startTime : 0);
            csv += `"${formatDateShort(new Date(task.startTime))}","${formatTimeHHMM(new Date(task.startTime))}",${Math.round(duration / 60000)},"${task.description.replace(/"/g, '""')}"\n`;
        }

        const projectSlug = (project.name || project.number).replace(/\s/g, '-').toLowerCase();
        this.downloadFile(csv, `${projectSlug}-full.csv`, 'text/csv');
    }

    async exportFullDatabase() {
        const data = {
            version: 1,
            exportedAt: Date.now(),
            projects: await this.db.getAll('projects'),
            tasks: await this.db.getAll('tasks'),
            sessions: await this.db.getAll('sessions'),
            state: await this.db.get('state', 'appState')
        };

        this.downloadFile(JSON.stringify(data, null, 2), `worktime-backup-${formatDateShort(new Date()).replace(/\s/g, '-')}.json`, 'application/json');
    }

    async importDatabase(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    // Clear existing data
                    await this.db.clear('projects');
                    await this.db.clear('tasks');
                    await this.db.clear('sessions');

                    // Import projects
                    for (const project of data.projects) {
                        await this.db.put('projects', project);
                    }

                    // Import tasks
                    for (const task of data.tasks) {
                        await this.db.put('tasks', task);
                    }

                    // Import sessions
                    for (const session of data.sessions) {
                        await this.db.put('sessions', session);
                    }

                    // Import state
                    if (data.state) {
                        await this.db.put('state', data.state);
                    }

                    // Reload state
                    await this.state.load();
                    await this.ensureOtherProjectExists();

                    this.hideImportPopup();
                    this.navigateTo(this.state.currentPage);

                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==================== EVENT LISTENERS ====================
    setupEventListeners() {
        // Start button click
        document.getElementById('start-btn').addEventListener('click', () => this.startGlobalTimer());

        // Import file change
        document.getElementById('import-file').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importDatabase(e.target.files[0]);
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    isPopupOpen() {
        return !document.getElementById('help-popup').classList.contains('hidden') ||
               !document.getElementById('delete-popup').classList.contains('hidden') ||
               !document.getElementById('rename-popup').classList.contains('hidden') ||
               !document.getElementById('import-popup').classList.contains('hidden') ||
               !document.getElementById('today-popup').classList.contains('hidden');
    }

    async handleKeydown(e) {
        // Handle popup-specific keys first
        if (!document.getElementById('help-popup').classList.contains('hidden')) {
            if (e.key === 'Escape' || e.key === '?') {
                e.preventDefault();
                this.hideHelpPopup();
            }
            return;
        }

        if (!document.getElementById('delete-popup').classList.contains('hidden')) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.confirmDelete();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideDeletePopup();
            }
            return;
        }

        if (!document.getElementById('rename-popup').classList.contains('hidden')) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submitRenameProject();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideRenameProjectPopup();
            }
            return;
        }

        if (!document.getElementById('import-popup').classList.contains('hidden')) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.hideImportPopup();
            }
            return;
        }

        if (!document.getElementById('today-popup').classList.contains('hidden')) {
            if (e.key === 'Escape' || (e.ctrlKey && e.key === 'o')) {
                e.preventDefault();
                this.hideTodayOverviewPopup();
            }
            return;
        }

        // Help shortcut (works on all pages)
        if (e.key === '?' && !this.state.isTypingNewTask && !this.state.isRenamingTask) {
            e.preventDefault();
            this.showHelpPopup();
            return;
        }

        // Page-specific handling
        if (this.state.currentPage === 'landing') {
            await this.handleLandingKeydown(e);
        } else if (this.state.currentPage === 'overview') {
            await this.handleOverviewKeydown(e);
        } else if (this.state.currentPage === 'project') {
            await this.handleProjectKeydown(e);
        }
    }

    async handleLandingKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            await this.startGlobalTimer();
        }
    }

    async handleOverviewKeydown(e) {
        const projects = await this.getFilteredProjects();

        // Escape - go back to landing and stop timers
        if (e.key === 'Escape') {
            e.preventDefault();
            await this.stopGlobalTimer();
            this.navigateTo('landing');
            return;
        }

        // Ctrl+O - today overview
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            this.showTodayOverviewPopup();
            return;
        }

        // Ctrl+Shift+E - full export
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            this.exportFullDatabase();
            return;
        }

        // Ctrl+Shift+I - import
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            this.showImportPopup();
            return;
        }

        // Ctrl+S - export today txt
        if (e.ctrlKey && !e.shiftKey && e.key === 's') {
            e.preventDefault();
            this.exportTodayTxt();
            return;
        }

        // Ctrl+E - export today csv
        if (e.ctrlKey && !e.shiftKey && e.key === 'e') {
            e.preventDefault();
            this.exportTodayCsv();
            return;
        }

        // Number keys for filtering
        if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            this.state.filterText += e.key;
            this.state.selectedProjectIndex = 0;
            await this.renderOverview();

            // If no matches and still typing, prepare for new project
            const filtered = await this.getFilteredProjects();
            if (filtered.length === 0) {
                // Will create new project when Enter is pressed
            }
            return;
        }

        // Backspace to clear filter
        if (e.key === 'Backspace' && this.state.filterText) {
            e.preventDefault();
            this.state.filterText = this.state.filterText.slice(0, -1);
            this.state.selectedProjectIndex = 0;
            await this.renderOverview();
            return;
        }

        // Arrow navigation
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (this.state.selectedProjectIndex < projects.length - 1) {
                this.state.selectedProjectIndex++;
                this.updateProjectSelection();
            }
            return;
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            if (this.state.selectedProjectIndex > 0) {
                this.state.selectedProjectIndex--;
                this.updateProjectSelection();
            }
            return;
        }

        // Enter - open selected or create new
        if (e.key === 'Enter') {
            e.preventDefault();
            if (projects.length > 0) {
                const project = projects[this.state.selectedProjectIndex];
                this.openProject(project.id);
            } else if (this.state.filterText) {
                // Create new project with filter text as number
                const newProject = await this.createProject(this.state.filterText);
                this.state.filterText = '';
                this.openProject(newProject.id);
            }
            return;
        }

        // N - new project
        if (e.key === 'n' || e.key === 'N') {
            if (!this.state.filterText) {
                e.preventDefault();
                const nextNumber = await this.getNextProjectNumber();
                const newProject = await this.createProject(nextNumber.toString());
                this.openProject(newProject.id);
            }
            return;
        }

        // O - open Other
        if (e.key === 'o' || e.key === 'O') {
            if (!this.state.filterText && !e.ctrlKey) {
                e.preventDefault();
                this.openProject('other');
            }
            return;
        }

        // Delete - delete selected project
        if (e.key === 'Delete') {
            e.preventDefault();
            if (projects.length > 0) {
                const project = projects[this.state.selectedProjectIndex];
                if (!project.isOther) {
                    this.showDeleteProjectPopup(project.id);
                }
            }
            return;
        }
    }

    async getNextProjectNumber() {
        const projects = await this.db.getAll('projects');
        let maxNum = 0;
        for (const p of projects) {
            const num = parseInt(p.number);
            if (!isNaN(num) && num > maxNum) {
                maxNum = num;
            }
        }
        return maxNum + 1;
    }

    async handleProjectKeydown(e) {
        const tasks = await this.getProjectTasks(this.state.activeProjectId);

        // Handle new task input
        if (this.state.isTypingNewTask) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.hideNewTaskInput();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                await this.submitNewTask();
            }
            return;
        }

        // Handle task renaming
        if (this.state.isRenamingTask) {
            if (e.key === 'Escape') {
                e.preventDefault();
                await this.finishRenamingTask(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                await this.finishRenamingTask(true);
            }
            return;
        }

        // Escape - go back to overview
        if (e.key === 'Escape') {
            e.preventDefault();
            this.navigateTo('overview');
            return;
        }

        // F2 - rename project
        if (e.key === 'F2') {
            e.preventDefault();
            this.showRenameProjectPopup();
            return;
        }

        // Ctrl+Shift+S - export full project txt
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            this.exportProjectFullTxt();
            return;
        }

        // Ctrl+Shift+E - export full project csv
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            this.exportProjectFullCsv();
            return;
        }

        // Ctrl+S - export project today txt
        if (e.ctrlKey && !e.shiftKey && e.key === 's') {
            e.preventDefault();
            this.exportProjectTodayTxt();
            return;
        }

        // Ctrl+E - export project today csv
        if (e.ctrlKey && !e.shiftKey && e.key === 'e') {
            e.preventDefault();
            this.exportProjectTodayCsv();
            return;
        }

        // Arrow navigation for tasks
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.state.selectedTaskIndex < tasks.length - 1) {
                this.state.selectedTaskIndex++;
                this.updateTaskSelection();
            }
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.state.selectedTaskIndex > 0) {
                this.state.selectedTaskIndex--;
            } else if (this.state.selectedTaskIndex === -1 && tasks.length > 0) {
                this.state.selectedTaskIndex = 0;
            }
            this.updateTaskSelection();
            return;
        }

        // Enter on selected task - start it or rename
        if (e.key === 'Enter' && this.state.selectedTaskIndex >= 0) {
            e.preventDefault();
            const task = tasks[this.state.selectedTaskIndex];
            if (task) {
                if (task.id === this.state.activeTaskId) {
                    // Already active, start renaming
                    this.startRenamingTask(this.state.selectedTaskIndex);
                } else {
                    // Start this task
                    await this.startTask(task.id);
                    await this.renderProject();
                }
            }
            return;
        }

        // Delete selected task
        if (e.key === 'Delete' && this.state.selectedTaskIndex >= 0) {
            e.preventDefault();
            const task = tasks[this.state.selectedTaskIndex];
            if (task) {
                this.showDeleteTaskPopup(task.id);
            }
            return;
        }

        // Start typing to create new task (printable characters)
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== '?') {
            e.preventDefault();
            this.showNewTaskInput();
            document.getElementById('new-task-input').value = e.key;
            return;
        }
    }
}

// Initialize the app
const app = new WorkTimeApp();
app.init().catch(console.error);
