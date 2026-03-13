import { addPersonalTask, completePersonalTask, getPersonalTasks, reschedulePersonalTask } from "../services/common.js";
import { renderStreakBadge } from "./streak.js";

const DATE_KEY = "lifeos_selected_date";

const form = document.getElementById("personalTaskForm");
const messageEl = document.getElementById("personalMessage");
const todayList = document.getElementById("personalTodayList");
const feedbackList = document.getElementById("personalFeedbackList");
const allList = document.getElementById("personalAllList");
const doneList = document.getElementById("personalDoneList");
const pendingCountEl = document.getElementById("personalPendingCount");
const feedbackCountEl = document.getElementById("personalFeedbackCount");
const otherCountEl = document.getElementById("personalOtherCount");
const archiveCountEl = document.getElementById("personalArchiveCount");
const dateInput = document.getElementById("personalDate");

dateInput.value = getLocalDateOffset_(1);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Saving personal task...", false);

  const payload = {
    date: document.getElementById("personalDate").value,
    task: document.getElementById("personalTask").value.trim(),
    category: document.getElementById("personalCategory").value,
    status: document.getElementById("personalStatus").value,
    hour: toNumberOrBlank_(document.getElementById("personalHour").value),
    minute: toNumberOrBlank_(document.getElementById("personalMinute").value),
    remark: document.getElementById("personalRemark").value.trim()
  };

  try {
    await addPersonalTask(payload);
    form.reset();
    dateInput.value = getLocalDateOffset_(1);
    setMessage("Personal task added successfully.", false);
    await loadPersonalSections();
  } catch (error) {
    setMessage(`Failed to save task: ${error.message}`, true);
  }
});

async function loadPersonalSections() {
  setLoadingState_([todayList, feedbackList, allList, doneList], "Loading personal tasks...");

  try {
    const data = await getPersonalTasks();
    const tasks = data.tasks || [];
    const today = getWorkingDate_();
    const pendingToday = tasks.filter((item) => normalizeStatus_(item.status) === "pending" && item.date === today);
    const feedbackPending = tasks.filter((item) => normalizeStatus_(item.status) === "feedback pending");
    const otherTasks = tasks.filter((item) => normalizeStatus_(item.status) === "other");
    const doneTasks = tasks.filter((item) => isDoneStatusValue_(item.status) && item.date === today);

    updateSectionCounts_(pendingToday.length, feedbackPending.length, otherTasks.length, doneTasks.length);

    renderList_(todayList, pendingToday, "No pending personal tasks for today.", (item) => {
      return createPersonalTaskRow_(item, true);
    });

    renderList_(feedbackList, feedbackPending, "No feedback pending personal tasks.", (item) => {
      return createPersonalTaskRow_(item, true);
    });

    renderList_(allList, otherTasks, "No other personal tasks.", (item) => {
      return createPersonalTaskRow_(item, true);
    });

    renderList_(doneList, doneTasks, "No completed personal tasks.", (item) => {
      const li = document.createElement("li");
      li.textContent = formatPersonalTaskText_(item);
      return li;
    });
  } catch (error) {
    [todayList, feedbackList, allList, doneList].forEach((list) => {
      list.innerHTML = "";
      const li = document.createElement("li");
      li.textContent = "Could not load personal tasks.";
      list.appendChild(li);
    });
    updateSectionCounts_(0, 0, 0, 0);
    setMessage(`Failed to load all tasks: ${error.message}`, true);
  }
}

function updateSectionCounts_(pendingCount, feedbackCount, otherCount, archiveCount) {
  if (pendingCountEl) pendingCountEl.textContent = String(pendingCount);
  if (feedbackCountEl) feedbackCountEl.textContent = String(feedbackCount);
  if (otherCountEl) otherCountEl.textContent = String(otherCount);
  if (archiveCountEl) archiveCountEl.textContent = String(archiveCount);
}

function setLoadingState_(lists, text) {
  lists.forEach((list) => {
    list.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = text;
    list.appendChild(li);
  });
}

function setMessage(text, isError) {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
}

function getLocalDateOffset_(daysAhead) {
  const value = new Date();
  value.setDate(value.getDate() + Number(daysAhead || 0));

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWorkingDate_() {
  try {
    const value = localStorage.getItem(DATE_KEY);
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  } catch (error) {
  }

  return getLocalDateOffset_(0);
}

function normalizeStatus_(status) {
  return String(status || "").trim().toLowerCase();
}

function isDoneStatusValue_(status) {
  const value = normalizeStatus_(status);
  return value === "done" || value === "completed" || value === "complete";
}

function formatPersonalTaskText_(item) {
  const timeText = formatTimeText_(item.hour, item.minute);
  const remark = String(item.remark || "").trim();
  return `${item.date} | ${item.task} | ${item.status} | ${item.category}${timeText ? ` | At: ${timeText}` : ""}${remark ? ` | Remark: ${remark}` : ""}`;
}

function createPersonalTaskRow_(item, includeDoneButton) {
  const li = document.createElement("li");

  if (!includeDoneButton) {
    li.textContent = formatPersonalTaskText_(item);
    return li;
  }

  const row = document.createElement("div");
  row.className = "task-row";

  const text = document.createElement("span");
  text.textContent = formatPersonalTaskText_(item);

  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "task-done-btn";
  doneBtn.textContent = "Done";
  doneBtn.addEventListener("click", async () => {
    doneBtn.disabled = true;
    doneBtn.textContent = "...";
    try {
      await completePersonalTask({ date: item.date, task: item.task });
      await loadPersonalSections();
    } catch (error) {
      setMessage(`Failed to complete task: ${error.message}`, true);
    } finally {
      doneBtn.disabled = false;
      doneBtn.textContent = "Done";
    }
  });

  const moveBtn = document.createElement("button");
  moveBtn.type = "button";
  moveBtn.className = "task-done-btn task-move-btn";
  moveBtn.textContent = "Move";
  moveBtn.addEventListener("click", async () => {
    try {
      await rescheduleTask_(item);
      await loadPersonalSections();
    } catch (error) {
      setMessage(`Failed to reschedule task: ${error.message}`, true);
    }
  });

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.appendChild(doneBtn);
  actions.appendChild(moveBtn);

  row.appendChild(text);
  row.appendChild(actions);
  li.appendChild(row);
  return li;
}

async function rescheduleTask_(item) {
  const defaultDate = getLocalDateOffset_(1);
  const newDate = (window.prompt("Move task to date (YYYY-MM-DD)", defaultDate) || "").trim();
  if (!newDate) {
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    throw new Error("Use date format YYYY-MM-DD");
  }

  const hourDefault = item.hour == null ? "" : String(item.hour);
  const minuteDefault = item.minute == null ? "" : String(item.minute);
  const hourText = (window.prompt("Hour (0-23, optional)", hourDefault) || "").trim();
  const minuteText = (window.prompt("Minute (0-59, optional)", minuteDefault) || "").trim();

  await reschedulePersonalTask({
    date: item.date,
    task: item.task,
    newDate,
    hour: toNumberOrBlank_(hourText),
    minute: toNumberOrBlank_(minuteText)
  });
  setMessage(`Moved: ${item.task} -> ${newDate}`, false);
}

function formatTimeText_(hour, minute) {
  if (hour == null || minute == null || hour === "" || minute === "") {
    return "";
  }

  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  if (!Number.isFinite(hourNumber) || !Number.isFinite(minuteNumber)) {
    return "";
  }

  const hh = String(Math.floor(hourNumber)).padStart(2, "0");
  const mm = String(Math.floor(minuteNumber)).padStart(2, "0");
  return `${hh}:${mm}`;
}

function toNumberOrBlank_(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : "";
}

function renderList_(listElement, items, emptyText, renderItem) {
  listElement.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = emptyText;
    listElement.appendChild(li);
    return;
  }

  items.forEach((item) => {
    listElement.appendChild(renderItem(item));
  });
}

loadPersonalSections();
renderStreakBadge();

window.addEventListener("lifeos:date-change", () => {
  loadPersonalSections();
  renderStreakBadge();
});
