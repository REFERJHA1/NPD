import { renderStreakBadge } from "./streak.js";

const STORAGE_KEY = "npd_tracker_records_v1";

const STAGES = [
	{ key: "feasibility", label: "Feasiblity", inputId: "dateFeasibility" },
	{ key: "signOff", label: "Sign Off", inputId: "dateSignOff" },
	{ key: "materialProcurement", label: "Material Procurement", inputId: "dateMaterialProcurement" },
	{ key: "materialTest", label: "Material Test", inputId: "dateMaterialTest" },
	{ key: "productionPlan", label: "Production Plan", inputId: "dateProductionPlan" },
	{ key: "ppapReredines", label: "PPAP Reredines", inputId: "datePpapReredines" },
	{ key: "delivery", label: "Delivery", inputId: "dateDelivery" },
	{ key: "feedback", label: "Feedback", inputId: "dateFeedback" }
];

const form = document.getElementById("npdTrackerForm");
const messageEl = document.getElementById("npdTrackerMessage");
const tableBody = document.getElementById("npdTrackerBody");
const checkFailedDatesBtn = document.getElementById("checkFailedDatesBtn");

form.addEventListener("submit", (event) => {
	event.preventDefault();

	const records = getRecords_();
	const nextSerial = getNextSerial_(records);
	const payload = collectFormData_(nextSerial);
	if (!payload) {
		return;
	}

	records.push(payload);
	saveRecords_(records);
	renderRecords_(records);

	form.reset();
	setMessage_("Tracker record added.", false);
});

checkFailedDatesBtn.addEventListener("click", () => {
	const records = getRecords_();
	const updates = handleFailedDates_(records, true);
	if (updates > 0) {
		saveRecords_(records);
		renderRecords_(records);
		setMessage_(`Updated ${updates} failed date(s).`, false);
		return;
	}

	setMessage_("No failed dates found.", false);
});

function collectFormData_(serialNo) {
	const partName = String(document.getElementById("partName").value || "").trim();
	const partNo = String(document.getElementById("partNo").value || "").trim();

	if (!partName || !partNo) {
		setMessage_("Part Name and Part No. are required.", true);
		return null;
	}

	const stageDates = {};
	for (const stage of STAGES) {
		const value = String(document.getElementById(stage.inputId).value || "").trim();
		if (!isIsoDate_(value)) {
			setMessage_(`Enter a valid date for ${stage.label}.`, true);
			return null;
		}

		stageDates[stage.key] = {
			current: value,
			history: []
		};
	}

	return {
		id: `npd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
		serialNo,
		partName,
		partNo,
		stageDates,
		createdAt: new Date().toISOString()
	};
}

function renderRecords_(records) {
	tableBody.innerHTML = "";

	if (!records.length) {
		const row = document.createElement("tr");
		const cell = document.createElement("td");
		cell.colSpan = 11;
		cell.textContent = "No tracker records yet.";
		row.appendChild(cell);
		tableBody.appendChild(row);
		return;
	}

	const sorted = [...records].sort((a, b) => Number(a.serialNo) - Number(b.serialNo));

	sorted.forEach((record) => {
		const row = document.createElement("tr");

		row.appendChild(createTextCell_(record.serialNo));
		row.appendChild(createTextCell_(record.partName));
		row.appendChild(createTextCell_(record.partNo));

		STAGES.forEach((stage) => {
			row.appendChild(createStageCell_(record.stageDates[stage.key] || { current: "", history: [] }));
		});

		tableBody.appendChild(row);
	});
}

function createTextCell_(value) {
	const cell = document.createElement("td");
	cell.textContent = String(value || "");
	return cell;
}

function createStageCell_(stageData) {
	const cell = document.createElement("td");
	const wrap = document.createElement("div");
	wrap.className = "stage-date-stack";

	const history = Array.isArray(stageData.history) ? stageData.history : [];
	history.forEach((oldDate) => {
		const oldDateEl = document.createElement("span");
		oldDateEl.className = "old-date";
		oldDateEl.textContent = oldDate;
		wrap.appendChild(oldDateEl);
	});

	const current = document.createElement("span");
	current.className = "current-date";
	current.textContent = stageData.current || "--";
	if (stageData.current && isPastDate_(stageData.current)) {
		current.classList.add("date-failed");
	}

	wrap.appendChild(current);
	cell.appendChild(wrap);
	return cell;
}

function handleFailedDates_(records, askUser) {
	let updateCount = 0;

	records.forEach((record) => {
		STAGES.forEach((stage) => {
			const stageData = record.stageDates && record.stageDates[stage.key];
			if (!stageData || !stageData.current || !isPastDate_(stageData.current)) {
				return;
			}

			if (!askUser) {
				return;
			}

			let nextDate = "";
			while (true) {
				const promptText = [
					`Date failed for ${record.partName} (${record.partNo})`,
					`Stage: ${stage.label}`,
					`Old date: ${stageData.current}`,
					"Enter new date (YYYY-MM-DD)"
				].join("\n");

				const input = window.prompt(promptText, "") || "";
				nextDate = input.trim();

				if (!nextDate) {
					return;
				}

				if (!isIsoDate_(nextDate)) {
					window.alert("Invalid date format. Use YYYY-MM-DD.");
					continue;
				}

				if (nextDate === stageData.current) {
					window.alert("New date must be different from old date.");
					continue;
				}

				break;
			}

			if (!Array.isArray(stageData.history)) {
				stageData.history = [];
			}

			stageData.history.push(stageData.current);
			stageData.current = nextDate;
			updateCount += 1;
		});
	});

	return updateCount;
}

function getRecords_() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return [];
		}

		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		return [];
	}
}

function saveRecords_(records) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getNextSerial_(records) {
	const maxValue = records.reduce((maxSerial, item) => {
		const serial = Number(item.serialNo || 0);
		return Number.isFinite(serial) ? Math.max(maxSerial, serial) : maxSerial;
	}, 0);

	return maxValue + 1;
}

function isIsoDate_(text) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		return false;
	}

	const date = new Date(`${text}T00:00:00`);
	if (Number.isNaN(date.getTime())) {
		return false;
	}

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}` === text;
}

function isPastDate_(text) {
	if (!isIsoDate_(text)) {
		return false;
	}

	const today = getTodayText_();
	return text < today;
}

function getTodayText_() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function setMessage_(text, isError) {
	messageEl.textContent = text;
	messageEl.classList.toggle("error", Boolean(isError));
}

const initialRecords = getRecords_();
const initialUpdates = handleFailedDates_(initialRecords, true);
if (initialUpdates > 0) {
	saveRecords_(initialRecords);
	setMessage_(`Updated ${initialUpdates} failed date(s).`, false);
}
renderRecords_(initialRecords);
renderStreakBadge();
