// Task Progression Tracker — Multi-Flow

const STORAGE_KEY = "taskProgressionDataV2";

const STATUS = {
	PENDING: "pending",
	IN_PROGRESS: "in-progress",
	COMPLETED: "completed",
};

const STATUS_CYCLE = [STATUS.PENDING, STATUS.IN_PROGRESS, STATUS.COMPLETED];

const STATUS_ICONS = {
	[STATUS.PENDING]: "⏳",
	[STATUS.IN_PROGRESS]: "⚡",
	[STATUS.COMPLETED]: "✅",
};

const EMOJI_LIST = [
	"🔥",
	"⭐",
	"📌",
	"🎯",
	"💡",
	"🚀",
	"✏️",
	"📝",
	"🐛",
	"🔧",
	"📊",
	"🏆",
	"⚠️",
	"💬",
	"🔒",
	"🎨",
	"🧪",
	"📦",
	"🔗",
	"💻",
	"🗂️",
	"🌟",
	"👀",
	"✔️",
	"❌",
];

let flows = [];
let activeEmojiTarget = null;

// --- Branching history tree ---
let historyRoot = null;
let historyCurrent = null;
let historyIdCounter = 0;
let historyPanelOpen = false;

function createHistoryNode(state, parent, label) {
	return {
		id: historyIdCounter++,
		state,
		parent,
		children: [],
		label,
		timestamp: Date.now(),
	};
}

function initHistory() {
	historyRoot = createHistoryNode(JSON.stringify(flows), null, "Initial state");
	historyCurrent = historyRoot;
	updateHistoryUI();
}

function pushHistory(label) {
	const node = createHistoryNode(JSON.stringify(flows), historyCurrent, label);
	historyCurrent.children.push(node);
	historyCurrent = node;
	updateHistoryUI();
	if (historyPanelOpen) renderHistoryPanel();
}

function undo() {
	if (!historyCurrent || !historyCurrent.parent) return;
	historyCurrent = historyCurrent.parent;
	flows = JSON.parse(historyCurrent.state);
	save();
	render();
	updateHistoryUI();
	if (historyPanelOpen) renderHistoryPanel();
}

function redo(childIndex) {
	if (!historyCurrent || historyCurrent.children.length === 0) return;
	if (historyCurrent.children.length === 1) {
		historyCurrent = historyCurrent.children[0];
	} else if (childIndex !== undefined) {
		historyCurrent = historyCurrent.children[childIndex];
	} else {
		showRedoBranchPicker();
		return;
	}
	flows = JSON.parse(historyCurrent.state);
	save();
	render();
	updateHistoryUI();
	if (historyPanelOpen) renderHistoryPanel();
}

function updateHistoryUI() {
	const undoBtn = document.getElementById("undoBtn");
	const redoBtn = document.getElementById("redoBtn");
	if (undoBtn) undoBtn.disabled = !historyCurrent?.parent;
	if (redoBtn) redoBtn.disabled = !historyCurrent?.children.length;
	if (redoBtn && (historyCurrent?.children.length ?? 0) > 1) {
		redoBtn.textContent = "↪ Redo ⋯";
		redoBtn.title = "Redo — multiple branches, click to choose";
	} else if (redoBtn) {
		redoBtn.textContent = "↪ Redo";
		redoBtn.title = "Redo (Ctrl+Y)";
	}
}

function showRedoBranchPicker() {
	const existing = document.getElementById("redoBranchPicker");
	if (existing) {
		existing.remove();
		return;
	}
	const picker = document.createElement("div");
	picker.id = "redoBranchPicker";
	picker.className = "redo-branch-picker";
	historyCurrent.children.forEach((child, i) => {
		const btn = document.createElement("button");
		btn.className = "redo-branch-item";
		btn.textContent = child.label;
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			picker.remove();
			redo(i);
		});
		picker.appendChild(btn);
	});
	const redoBtn = document.getElementById("redoBtn");
	const rect = redoBtn.getBoundingClientRect();
	picker.style.top = `${rect.bottom + window.scrollY + 6}px`;
	picker.style.left = `${rect.left}px`;
	document.body.appendChild(picker);
	setTimeout(
		() =>
			document.addEventListener("click", () => picker.remove(), {
				once: true,
			}),
		0,
	);
}

function timeAgo(ts) {
	const diff = Math.floor((Date.now() - ts) / 1000);
	if (diff < 60) return `${diff}s ago`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	return `${Math.floor(diff / 3600)}h ago`;
}

function renderHistoryPanel() {
	const body = document.getElementById("historyPanelBody");
	if (!body) return;
	body.innerHTML = "";
	if (historyRoot) traverseHistoryTree(body, historyRoot, "", true, true);
}

function traverseHistoryTree(container, node, branchPrefix, isLast, isRoot) {
	const isCurrent = node === historyCurrent;
	const row = document.createElement("div");
	row.className = `h-row${isCurrent ? " h-current" : ""}`;

	const pre = document.createElement("span");
	pre.className = "h-pre";
	pre.textContent = isRoot ? "" : branchPrefix + (isLast ? "└─ " : "├─ ");

	const dot = document.createElement("span");
	dot.className = "h-dot";
	dot.textContent = isCurrent ? "●" : "○";

	const lbl = document.createElement("span");
	lbl.className = "h-label";
	lbl.textContent = node.label;

	const ts = document.createElement("span");
	ts.className = "h-time";
	ts.textContent = timeAgo(node.timestamp);

	row.appendChild(pre);
	row.appendChild(dot);
	row.appendChild(lbl);
	row.appendChild(ts);

	if (node.children.length > 1) {
		const badge = document.createElement("span");
		badge.className = "h-branch-badge";
		badge.textContent = `${node.children.length} branches`;
		row.appendChild(badge);
	}

	row.addEventListener("click", () => {
		historyCurrent = node;
		flows = JSON.parse(node.state);
		save();
		render();
		updateHistoryUI();
		renderHistoryPanel();
	});

	container.appendChild(row);

	const childPrefix = isRoot ? "" : branchPrefix + (isLast ? "   " : "│  ");
	node.children.forEach((child, i) => {
		traverseHistoryTree(
			container,
			child,
			childPrefix,
			i === node.children.length - 1,
			false,
		);
	});
}

function toggleHistoryPanel() {
	historyPanelOpen = !historyPanelOpen;
	const panel = document.getElementById("historyPanel");
	const btn = document.getElementById("historyBtn");
	if (historyPanelOpen) {
		panel.classList.remove("hidden");
		btn.classList.add("active");
		renderHistoryPanel();
	} else {
		panel.classList.add("hidden");
		btn.classList.remove("active");
	}
}

function genId() {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function load() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) flows = JSON.parse(stored);
	} catch (e) {
		flows = [];
	}
	if (flows.length === 0) {
		flows.push({ id: genId(), name: "Flow 1", tasks: [] });
	}
	render();
	initHistory();
}

function save() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
	} catch (e) {
		console.warn("Could not save");
	}
}

function addFlow() {
	flows.push({ id: genId(), name: "Flow " + (flows.length + 1), tasks: [] });
	const name = flows[flows.length - 1].name;
	save();
	pushHistory(`Added flow "${name}"`);
	render();
}

function deleteFlow(flowId) {
	const flow = flows.find((f) => f.id === flowId);
	const label = flow ? `Deleted flow "${flow.name}"` : "Deleted flow";
	flows = flows.filter((f) => f.id !== flowId);
	save();
	pushHistory(label);
	render();
}

function hideFlow(flowId) {
	const flow = flows.find((f) => f.id === flowId);
	if (flow) {
		flow.hidden = true;
		save();
		pushHistory(`Hidden flow "${flow.name}"`);
		render();
	}
}

function markFlowDone(flowId) {
	const flow = flows.find((f) => f.id === flowId);
	if (flow) {
		flow.done = true;
		flow.hidden = true;
		save();
		pushHistory(`Marked done "${flow.name}"`);
		render();
	}
}

function restoreFlow(flowId) {
	const flow = flows.find((f) => f.id === flowId);
	if (flow) {
		flow.hidden = false;
		flow.done = false;
		save();
		pushHistory(`Restored flow "${flow.name}"`);
		render();
	}
}

function isFlowComplete(flow) {
	return (
		flow.tasks.length > 0 &&
		flow.tasks.every((t) => t.status === STATUS.COMPLETED)
	);
}

function renameFlow(flowId, name) {
	const flow = flows.find((f) => f.id === flowId);
	if (flow && name.trim()) {
		const old = flow.name;
		flow.name = name.trim();
		save();
		pushHistory(`Renamed "${old}" → "${flow.name}"`);
	}
}

function addTask(flowId, description) {
	if (!description.trim()) return;
	const flow = flows.find((f) => f.id === flowId);
	if (!flow) return;
	flow.tasks.push({
		id: genId(),
		description: description.trim(),
		status: STATUS.PENDING,
	});
	save();
	pushHistory(`Added task "${description.trim().slice(0, 30)}"`);
	render();
}

function deleteTask(flowId, taskId) {
	const flow = flows.find((f) => f.id === flowId);
	if (!flow) return;
	const task = flow.tasks.find((t) => t.id === taskId);
	const label = task
		? `Deleted task "${task.description.slice(0, 30)}"`
		: "Deleted task";
	flow.tasks = flow.tasks.filter((t) => t.id !== taskId);
	save();
	pushHistory(label);
	render();
}

function cycleStatus(flowId, taskId) {
	const flow = flows.find((f) => f.id === flowId);
	if (!flow) return;
	const task = flow.tasks.find((t) => t.id === taskId);
	if (!task) return;
	const idx = STATUS_CYCLE.indexOf(task.status);
	task.status = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
	save();
	pushHistory(
		`Status → ${getStatusLabel(task.status)}: "${task.description.slice(0, 25)}"`,
	);
	render();
}

function editTask(flowId, taskId, newDescription) {
	const flow = flows.find((f) => f.id === flowId);
	if (!flow) return;
	const task = flow.tasks.find((t) => t.id === taskId);
	if (!task || !newDescription.trim()) return;
	task.description = newDescription.trim();
	save();
	pushHistory(`Edited task "${task.description.slice(0, 30)}"`);
}

function startEditTask(flowId, taskId, textEl) {
	const flow = flows.find((f) => f.id === flowId);
	if (!flow) return;
	const task = flow.tasks.find((t) => t.id === taskId);
	if (!task) return;

	const inp = document.createElement("input");
	inp.type = "text";
	inp.className = "task-edit-input";
	inp.value = task.description;
	inp.maxLength = 120;
	textEl.replaceWith(inp);
	inp.focus();
	inp.select();
	inp.addEventListener("click", (e) => e.stopPropagation());
	inp.addEventListener("dblclick", (e) => e.stopPropagation());

	const done = () => {
		editTask(flowId, taskId, inp.value);
		render();
	};
	inp.addEventListener("blur", done);
	inp.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			inp.blur();
		}
		if (e.key === "Escape") render();
	});
}

function getStatusLabel(status) {
	switch (status) {
		case STATUS.PENDING:
			return "Pending";
		case STATUS.IN_PROGRESS:
			return "In Progress";
		case STATUS.COMPLETED:
			return "Completed";
		default:
			return status;
	}
}

function renderFlow(flow) {
	const col = document.createElement("div");
	col.className = "flow-column";

	// Header
	const header = document.createElement("div");
	header.className = "flow-header";

	const nameEl = document.createElement("div");
	nameEl.className = "flow-name";
	nameEl.textContent = flow.name;
	nameEl.title = "Double-click to rename";
	nameEl.addEventListener("dblclick", () => {
		const inp = document.createElement("input");
		inp.type = "text";
		inp.className = "flow-name-input";
		inp.value = flow.name;
		inp.maxLength = 80;
		nameEl.replaceWith(inp);
		inp.focus();
		inp.select();
		const done = () => {
			renameFlow(flow.id, inp.value);
			render();
		};
		inp.addEventListener("blur", done);
		inp.addEventListener("keydown", (e) => {
			if (e.key === "Enter") inp.blur();
			if (e.key === "Escape") render();
		});
	});

	const delFlowBtn = document.createElement("button");
	delFlowBtn.className = "delete-flow-btn";
	delFlowBtn.innerHTML = "&times;";
	delFlowBtn.title = "Delete flow";
	delFlowBtn.addEventListener("click", () => deleteFlow(flow.id));

	const hideFlowBtn = document.createElement("button");
	hideFlowBtn.className = "hide-flow-btn";
	hideFlowBtn.textContent = "👁";
	hideFlowBtn.title = "Hide flow";
	hideFlowBtn.addEventListener("click", () => hideFlow(flow.id));

	header.appendChild(nameEl);
	header.appendChild(hideFlowBtn);
	header.appendChild(delFlowBtn);
	col.appendChild(header);

	// Task input row
	const inputRow = document.createElement("div");
	inputRow.className = "flow-input-row";

	const emojiBtn = document.createElement("button");
	emojiBtn.className = "flow-emoji-btn";
	emojiBtn.textContent = "😊";
	emojiBtn.title = "Insert emoji";

	const taskInput = document.createElement("input");
	taskInput.type = "text";
	taskInput.className = "flow-task-input";
	taskInput.placeholder = "Add task...";
	taskInput.maxLength = 120;

	const addBtn = document.createElement("button");
	addBtn.className = "flow-add-btn";
	addBtn.textContent = "+";
	addBtn.title = "Add task";

	const doAdd = () => {
		addTask(flow.id, taskInput.value);
		taskInput.value = "";
	};
	addBtn.addEventListener("click", doAdd);
	taskInput.addEventListener("keypress", (e) => {
		if (e.key === "Enter") doAdd();
	});

	emojiBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		activeEmojiTarget = taskInput;
		const picker = document.getElementById("emojiPicker");
		const rect = emojiBtn.getBoundingClientRect();
		picker.style.top = `${rect.bottom + window.scrollY + 6}px`;
		picker.style.left = `${rect.left}px`;
		picker.classList.toggle("hidden");
	});

	inputRow.appendChild(emojiBtn);
	inputRow.appendChild(taskInput);
	inputRow.appendChild(addBtn);
	col.appendChild(inputRow);

	// Task list
	const taskList = document.createElement("div");
	taskList.className = "task-list";

	if (flow.tasks.length === 0) {
		const empty = document.createElement("div");
		empty.className = "flow-empty";
		empty.textContent = "No tasks yet";
		taskList.appendChild(empty);
	} else {
		flow.tasks.forEach((task, index) => {
			const node = document.createElement("div");
			node.className = "task-node";

			const card = document.createElement("div");
			card.className = `task-card ${task.status}`;
			card.addEventListener("click", (e) => {
				if (e.target.closest(".task-text, .task-edit-input, .delete-btn"))
					return;
				cycleStatus(flow.id, task.id);
			});

			const icon = document.createElement("div");
			icon.className = "status-icon";
			icon.textContent = STATUS_ICONS[task.status] || "📋";

			const badge = document.createElement("span");
			badge.className = `status-badge ${task.status}`;
			badge.textContent = getStatusLabel(task.status);

			const text = document.createElement("div");
			text.className = "task-text";
			text.textContent = task.description;
			text.title = "Double-click to edit";
			text.addEventListener("dblclick", (e) => {
				e.stopPropagation();
				startEditTask(flow.id, task.id, text);
			});

			const delBtn = document.createElement("button");
			delBtn.className = "delete-btn";
			delBtn.innerHTML = "&times;";
			delBtn.title = "Delete task";
			delBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				deleteTask(flow.id, task.id);
			});

			card.appendChild(icon);
			card.appendChild(badge);
			card.appendChild(text);
			card.appendChild(delBtn);
			node.appendChild(card);
			taskList.appendChild(node);

			if (index < flow.tasks.length - 1) {
				const connector = document.createElement("div");
				connector.className = "connector";
				if (task.status === STATUS.IN_PROGRESS) {
					const spinner = document.createElement("div");
					spinner.className = "spinner";
					connector.appendChild(spinner);
				} else {
					const arrow = document.createElement("div");
					arrow.className = `arrow ${task.status === STATUS.COMPLETED ? "completed" : "pending"}`;
					arrow.textContent = "↓";
					connector.appendChild(arrow);
				}
				taskList.appendChild(connector);
			}
		});
	}

	col.appendChild(taskList);

	if (isFlowComplete(flow)) {
		const doneBtn = document.createElement("button");
		doneBtn.className = "mark-done-btn";
		doneBtn.textContent = "✓ Mark as Done & Hide";
		doneBtn.title = "All tasks completed — mark flow as done and hide it";
		doneBtn.addEventListener("click", () => markFlowDone(flow.id));
		col.appendChild(doneBtn);
	}

	return col;
}

function renderHiddenSection(hiddenFlows) {
	const section = document.getElementById("hiddenFlowsSection");
	section.innerHTML = "";

	if (hiddenFlows.length === 0) {
		section.style.display = "none";
		return;
	}

	section.style.display = "flex";

	const label = document.createElement("span");
	label.className = "hidden-flows-label";
	label.textContent = `Hidden (${hiddenFlows.length}):`;
	section.appendChild(label);

	for (const flow of hiddenFlows) {
		const chip = document.createElement("div");
		chip.className = `hidden-flow-chip${flow.done ? " done" : ""}`;

		const name = document.createElement("span");
		name.className = "hidden-flow-chip-name";
		name.textContent = flow.done ? `✓ ${flow.name}` : flow.name;

		const restoreBtn = document.createElement("button");
		restoreBtn.className = "restore-flow-btn";
		restoreBtn.title = "Restore flow";
		restoreBtn.textContent = "↩";
		restoreBtn.addEventListener("click", () => restoreFlow(flow.id));

		chip.appendChild(name);
		chip.appendChild(restoreBtn);
		section.appendChild(chip);
	}
}

function render() {
	const container = document.getElementById("flowsContainer");
	const emptyState = document.getElementById("emptyState");
	container.innerHTML = "";

	const visibleFlows = flows.filter((f) => !f.hidden);
	const hiddenFlows = flows.filter((f) => f.hidden);

	if (flows.length === 0) {
		emptyState.classList.add("visible");
	} else {
		emptyState.classList.remove("visible");
	}

	for (const flow of visibleFlows) {
		container.appendChild(renderFlow(flow));
	}

	renderHiddenSection(hiddenFlows);
}

// Global emoji picker
(function () {
	const picker = document.getElementById("emojiPicker");
	for (const emoji of EMOJI_LIST) {
		const btn = document.createElement("button");
		btn.className = "emoji-item";
		btn.textContent = emoji;
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			if (activeEmojiTarget) {
				const pos =
					activeEmojiTarget.selectionStart ?? activeEmojiTarget.value.length;
				activeEmojiTarget.value =
					activeEmojiTarget.value.slice(0, pos) +
					emoji +
					activeEmojiTarget.value.slice(pos);
				activeEmojiTarget.focus();
				activeEmojiTarget.setSelectionRange(
					pos + emoji.length,
					pos + emoji.length,
				);
			}
			picker.classList.add("hidden");
		});
		picker.appendChild(btn);
	}
	document.addEventListener("click", () => picker.classList.add("hidden"));
})();

function exportFlows() {
	const json = JSON.stringify(flows, null, 2);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `task-flows-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

function importFlows(file) {
	if (!file) return;
	const reader = new FileReader();
	reader.onload = (e) => {
		try {
			const parsed = JSON.parse(e.target.result);
			if (!Array.isArray(parsed)) throw new Error("Invalid format");
			flows = parsed;
			save();
			render();
			initHistory();
		} catch {
			alert("Failed to import: invalid JSON file.");
		}
	};
	reader.readAsText(file);
}

document.getElementById("addFlowBtn").addEventListener("click", addFlow);
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", () => redo());
document
	.getElementById("historyBtn")
	.addEventListener("click", toggleHistoryPanel);
document
	.getElementById("historyPanelClose")
	.addEventListener("click", toggleHistoryPanel);
document.addEventListener("keydown", (e) => {
	if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
		e.preventDefault();
		undo();
	}
	if (
		(e.ctrlKey || e.metaKey) &&
		(e.key === "y" || (e.shiftKey && e.key === "z"))
	) {
		e.preventDefault();
		redo();
	}
});
document.getElementById("exportBtn").addEventListener("click", exportFlows);
document
	.getElementById("importBtn")
	.addEventListener("click", () =>
		document.getElementById("importFile").click(),
	);
document.getElementById("importFile").addEventListener("change", (e) => {
	importFlows(e.target.files[0]);
	e.target.value = "";
});

load();
