import { addRawNote, getRawNotes } from "../services/common.js";
import { renderStreakBadge } from "./streak.js";

const DATE_KEY = "lifeos_selected_date";

const form = document.getElementById("rawNotesForm");
const messageEl = document.getElementById("rawMessage");
const listEl = document.getElementById("rawNotesList");
const dateInput = document.getElementById("rawDate");

dateInput.value = getWorkingDate_();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Saving raw note...", false);

  const payload = {
    date: document.getElementById("rawDate").value,
    section: document.getElementById("rawSection").value,
    title: document.getElementById("rawTitle").value.trim(),
    note: document.getElementById("rawNote").value.trim(),
    tags: document.getElementById("rawTags").value.trim(),
    linkedTask: document.getElementById("rawLinkedTask").value.trim()
  };

  try {
    await addRawNote(payload);
    form.reset();
    dateInput.value = getWorkingDate_();
    setMessage("Raw note saved.", false);
    await loadRawNotes();
  } catch (error) {
    setMessage(`Failed to save raw note: ${error.message}`, true);
  }
});

async function loadRawNotes() {
  setLoadingState_("Loading raw notes...");

  try {
    const selectedDate = getWorkingDate_();
    const data = await getRawNotes(selectedDate);
    const notes = data.notes || [];

    listEl.innerHTML = "";
    if (!notes.length) {
      const li = document.createElement("li");
      li.textContent = "No raw notes for this date.";
      listEl.appendChild(li);
      return;
    }

    notes.forEach((item) => {
      const li = document.createElement("li");
      const parts = [
        item.date,
        item.section,
        item.title ? `Title: ${item.title}` : "",
        item.note ? `Note: ${item.note}` : "",
        item.tags ? `Tags: ${item.tags}` : "",
        item.linkedTask ? `Task: ${item.linkedTask}` : ""
      ].filter(Boolean);
      li.textContent = parts.join(" | ");
      listEl.appendChild(li);
    });
  } catch (error) {
    setLoadingState_("Could not load raw notes.");
    setMessage(`Failed to load raw notes: ${error.message}`, true);
  }
}

function setLoadingState_(text) {
  listEl.innerHTML = "";
  const li = document.createElement("li");
  li.textContent = text;
  listEl.appendChild(li);
}

function setMessage(text, isError) {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
}

function getWorkingDate_() {
  try {
    const value = localStorage.getItem(DATE_KEY);
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  } catch (error) {
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

loadRawNotes();
renderStreakBadge();

window.addEventListener("lifeos:date-change", () => {
  dateInput.value = getWorkingDate_();
  loadRawNotes();
  renderStreakBadge();
});
