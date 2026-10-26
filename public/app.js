const $ = (selector) => document.querySelector(selector);

const searchPage = $("#searchPage");
const timetablePage = $("#timetablePage");

let selectedSchool = null;

const today = new Date();
today.setMinutes(today.getMinutes() - today.getTimezoneOffset());

$("#dateInput").value = today.toISOString().slice(0, 10);

function showMessage(text = "") {
  $("#searchMessage").textContent = text;
}

async function searchSchools() {
  const q = $("#schoolInput").value.trim();

  if (q.length < 2) {
    showMessage("학교명을 2글자 이상 입력해주세요.");
    return;
  }

  showMessage("");
  $("#schoolResults").innerHTML = "학교를 찾는 중...";

  try {
    const res = await fetch(`/api/schools?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "학교 검색 실패");

    if (!data.length) {
      $("#schoolResults").innerHTML = `<div class="loading">검색 결과가 없습니다.</div>`;
      return;
    }

    $("#schoolResults").innerHTML = data.map((school, index) => `
      <button class="school" data-index="${index}">
        <strong>${escapeHtml(school.name)}</strong>
        <span>${escapeHtml(school.kind || "")} · ${escapeHtml(school.address || "")}</span>
      </button>
    `).join("");

    document.querySelectorAll(".school").forEach((button) => {
      button.addEventListener("click", () => {
        selectedSchool = data[Number(button.dataset.index)];
        openSchool();
      });
    });
  } catch (err) {
    console.error(err);
    $("#schoolResults").innerHTML = "";
    showMessage(err.message);
  }
}

function openSchool() {
  searchPage.classList.add("hidden");
  timetablePage.classList.remove("hidden");

  $("#schoolName").textContent = selectedSchool.name;
  $("#schoolAddress").textContent =
    `${selectedSchool.kind || ""} · ${selectedSchool.address || ""}`;

  localStorage.setItem("selectedSchool", JSON.stringify(selectedSchool));

  loadTimetable();
}

function closeSchool() {
  timetablePage.classList.add("hidden");
  searchPage.classList.remove("hidden");
}

async function loadTimetable() {
  const date = $("#dateInput").value;

  if (!date || !selectedSchool) return;

  $("#loading").classList.remove("hidden");
  $("#empty").classList.add("hidden");
  $("#timetable").innerHTML = "";

  $("#dateTitle").textContent = formatDate(date);

  const params = new URLSearchParams({
    officeCode: selectedSchool.officeCode,
    schoolCode: selectedSchool.code,
    schoolKind: selectedSchool.kind || "",
    date
  });

  const grade = $("#gradeInput").value.trim();
  const className = $("#classInput").value.trim();

  if (grade) params.set("grade", grade);
  if (className) params.set("className", className);

  try {
    const res = await fetch(`/api/timetable?${params}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "시간표를 가져오지 못했습니다.");

    if (!data.length) {
      $("#empty").classList.remove("hidden");
      return;
    }

    renderTimetable(data);
  } catch (err) {
    console.error(err);
    $("#empty").textContent = err.message;
    $("#empty").classList.remove("hidden");
  } finally {
    $("#loading").classList.add("hidden");
  }
}

function renderTimetable(rows) {
  const container = $("#timetable");

  container.innerHTML = rows.map((row) => `
    <div class="period">
      <div class="periodNo">${escapeHtml(row.period)}교시</div>
      <div class="subject">
        ${escapeHtml(row.subject)}
        ${row.room ? `<span class="room">${escapeHtml(row.room)}</span>` : ""}
      </div>
    </div>
  `).join("");
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

function moveDate(amount) {
  const date = new Date(`${$("#dateInput").value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  $("#dateInput").value = date.toISOString().slice(0, 10);
  loadTimetable();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("#searchBtn").addEventListener("click", searchSchools);

$("#schoolInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchSchools();
});

$("#backBtn").addEventListener("click", closeSchool);
$("#loadBtn").addEventListener("click", loadTimetable);
$("#dateInput").addEventListener("change", loadTimetable);

$("#prevBtn").addEventListener("click", () => moveDate(-1));
$("#nextBtn").addEventListener("click", () => moveDate(1));

$("#gradeInput").addEventListener("change", loadTimetable);
$("#classInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadTimetable();
});

// 이전에 선택한 학교가 있으면 바로 복원
try {
  const saved = JSON.parse(localStorage.getItem("selectedSchool"));
  if (saved?.code && saved?.officeCode) {
    selectedSchool = saved;
    openSchool();
  }
} catch {
  localStorage.removeItem("selectedSchool");
}