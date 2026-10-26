import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const KEY = process.env.NEIS_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const BASE = "https://open.neis.go.kr/hub";

const api = async (service, params = {}) => {
  const url = new URL(`${BASE}/${service}`);
  url.searchParams.set("KEY", KEY);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "1000");

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url);
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("NEIS 응답을 JSON으로 읽지 못했습니다.");
  }

  if (data.RESULT?.CODE && data.RESULT.CODE !== "INFO-000") {
    throw new Error(data.RESULT.MESSAGE || `NEIS API 오류: ${data.RESULT.CODE}`);
  }

  return data;
};

// 학교 검색
app.get("/api/schools", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (q.length < 2) {
      return res.json([]);
    }

    const data = await api("schoolInfo", {
      SCHUL_NM: q
    });

    const rows = data.schoolInfo?.[1]?.row || [];

    res.json(rows.map((s) => ({
      name: s.SCHUL_NM,
      code: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      kind: s.SCHUL_KND_SC_NM,
      address: s.ORG_RDNMA,
      homepage: s.HMPG_ADRES
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 시간표 조회
app.get("/api/timetable", async (req, res) => {
  try {
    const {
      officeCode,
      schoolCode,
      schoolKind,
      date,
      grade,
      className
    } = req.query;

    if (!officeCode || !schoolCode || !date) {
      return res.status(400).json({
        error: "officeCode, schoolCode, date는 필수입니다."
      });
    }

    let service;

    if (schoolKind?.includes("초등학교")) {
      service = "elsTimetable";
    } else if (schoolKind?.includes("중학교")) {
      service = "misTimetable";
    } else {
      service = "hisTimetable";
    }

    const params = {
      ATPT_OFCDC_SC_CODE: officeCode,
      SD_SCHUL_CODE: schoolCode,
      ALL_TI_YMD: date,
      GRADE: grade,
      CLASS_NM: className,
      CLRM_NM: className
    };

    const data = await api(service, params);
    const key = Object.keys(data).find(k => k.endsWith("Timetable"));
    const rows = key ? (data[key]?.[1]?.row || []) : [];

    rows.sort((a, b) => Number(a.PERIO || 0) - Number(b.PERIO || 0));

    res.json(rows.map((r) => ({
      date: r.ALL_TI_YMD,
      grade: r.GRADE,
      className: r.CLASS_NM,
      period: r.PERIO,
      subject: r.ITRT_CNTNT || "수업 정보 없음",
      room: r.CLRM_NM || ""
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "school-timetable" });
});

app.listen(PORT, () => {
  console.log(`학교 시간표 서버 실행: http://localhost:${PORT}`);
});