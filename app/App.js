import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from "react-native";
import { colors, spacing, type, radius, shadow, page } from "./theme";
import { Btn, Card, Badge, ProgressBar, SectionTitle, ChatBubble, LeaderRow, Screen, PageHeader, HoverCard, MenuRow, EmptyState, Field, TutorBuddy, TimerPill, PrePrompt } from "./components";
import { savePack, loadPack, queueAttempt, pendingAttempts, dropQueued, pendingCount, uuid } from "./offline";
import { logPerm, setupChannels, notifStatus, requestNotifPermission, registerToken, openAppSettings, scheduleLocalReminder, iosNeedsInstall } from "./notify";
import { CameraView } from "expo-camera";
import { cameraStatus as camStatus, requestCamera as reqCamera, setSecureScreen, watchAppState, detectImage, openAppSettings as openSysSettings } from "./proctor";

// Shows errors on screen instead of a blank page
class Boundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    if (this.state.err) {
      return (
        <View style={{ padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>Something broke:</Text>
          <Text>{String(this.state.err?.message || this.state.err)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const AUTH_ORIGIN = "https://betterme1.netlify.app";
const EXAMS = ["WAEC", "TOEFL", "SAT", "GRE"];

export default function App() {
  return (
    <Boundary>
      <AppInner />
    </Boundary>
  );
}

function AppInner() {
  const [screen, setScreen] = useState("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [exam, setExam] = useState(null);
  const [dept, setDept] = useState(null);
  const [topics, setTopics] = useState([]);
  const [userId, setUserId] = useState(null);
  const [spec, setSpec] = useState(null);
  // Home dashboard data (Phase 4: H3/H4/H5, G1-G5)
  const [dash, setDash] = useState({ progress: [], plan: [], badges: [], mocks: [], prefs: {}, eprog: {}, lastScore: null });
  const [msg, setMsg] = useState("");
  const [repeatNote, setRepeatNote] = useState("");

  // Unseen-first loader: asks the server to exclude questions this student
  // already answered. Falls back to plain random when signed out.
  const loadQuestions = async (url) => {
    setRepeatNote("");
    const sep = url.includes("?") ? "&" : "?";
    const full = userId ? `${url}${sep}user=${encodeURIComponent(userId)}&exclude_seen=1` : url;
    const res = await fetch(full);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const qs = Array.isArray(data) ? data : data.questions || [];
    if (!Array.isArray(data) && data.repeated > 0) {
      setRepeatNote(`${data.repeated} repeat${data.repeated > 1 ? "s" : ""} — question bank growing.`);
    }
    return qs;
  };
  // Diagnostic state (PRD D1–D6, adaptive D3, pause/resume D4)
  const [quiz, setQuiz] = useState([]);
  const [quizPool, setQuizPool] = useState([]);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [target, setTarget] = useState(2);
  const [streak, setStreak] = useState(0);
  const [draft, setDraft] = useState(null);

  const callAuth = async (mode) => {
    setMsg("");
    const body = JSON.stringify({ email, password, name: email });
    const headers = { "Content-Type": "application/json" };
    if (Platform.OS !== "web") headers.Origin = AUTH_ORIGIN;
    const attempt = (m) => fetch(`${API_URL}/api/auth/${m}/email`, {
      method: "POST",
      headers,
      body,
    });
    try {
      let res = await attempt(mode);
      let result = await res.json().catch(() => null);
      if (!res.ok && mode === "sign-up") {
        // Account already exists? Just sign them in instead.
        const code = result?.code || "";
        if (res.status === 422 && code.includes("EXISTS")) {
          res = await attempt("sign-in");
          result = await res.json().catch(() => null);
          if (!res.ok) return setMsg("Account exists but the password didn't match — check it and tap Sign in.");
        } else if (res.status === 422) {
          return setMsg("Check your email format and use a 8+ character password.");
        } else {
          return setMsg(`Sign-up failed (${res.status})${result?.code ? `: ${result.code}` : ""}.`);
        }
      }
      if (!res.ok) return setMsg(`Auth failed (${res.status})${result?.code ? `: ${result.code}` : ""} — check email/password and tap Sign in.`);
      if (!result?.user?.id) return setMsg("Sign-in succeeded but the account ID was missing. Please try again.");
      setUserId(result.user.id);
      setScreen("exams");
    } catch {
      setMsg("Could not reach the server. Check your internet connection and try again.");
    }
  };

  const pickExam = async (code) => {
    setExam(code);
    setDept(null);
    const [tr, sr] = await Promise.all([
      fetch(`${API_URL}/api/topics?exam=${code}`),
      fetch(`${API_URL}/api/specs/${code}`),
    ]);
    const all = tr.ok ? await tr.json() : [];
    setSpec(sr.ok ? await sr.json() : null);
    if (code === "WAEC") {
      setTopics(all);
      setScreen("dept");
    } else {
      setTopics(all);
      setScreen("home");
    }
  };

  const pickDept = (d) => {
    setDept(d);
    setTopics(topics.filter((t) => t.department === "General" || t.department === d));
    setScreen("home");
  };

  // Practice state (PRD P1–P7, N1–N2) — 10Q standard drill, timed
  const [ptopic, setPtopic] = useState(null);
  const [pq, setPq] = useState([]);
  const [pqi, setPqi] = useState(0);
  const [pans, setPans] = useState([]);
  const [practicePool, setPracticePool] = useState([]);
  const [practiceTarget, setPracticeTarget] = useState(2);
  const [practiceStreak, setPracticeStreak] = useState(0);
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (screen !== "practice" || secs <= 0) return;
    const t = setTimeout(() => {
      if (secs === 1) {
        saveAttempt("practice", ptopic?.id, pq, pans);
        setScreen("review");
      }
      else setSecs(secs - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [screen, secs, ptopic, pq, pans]);

  const startPractice = async (topic) => {
    setMsg(""); setOfflineMode(false);
    let qs = null;
    try {
      qs = await loadQuestions(`${API_URL}/api/questions?exam=${exam}&topic=${topic.id}&limit=60`);
    } catch {
      qs = packQuestions(topic.id, 60);
    }
    if (!qs || !qs.length) return setMsg(`No questions for ${topic.name} (bank growing).`);
    const first = [...qs].sort((a, b) => Math.abs(a.difficulty - 2) - Math.abs(b.difficulty - 2))[0];
    setPracticePool(qs);
    setPtopic(topic); setPq([first]); setPqi(0); setPans([]);
    setPracticeTarget(2); setPracticeStreak(0);
    setSecs(10 * 60); // standard 10Q drill, 10 min
    setStartedAt(Date.now());
    setScreen("practice");
  };

  const answerPractice = (idx) => {
    const q = pq[pqi];
    const next = [...pans, { q, picked: idx, correct: idx === q.answer_idx }];
    const updatedStreak = next[next.length - 1].correct
      ? (practiceStreak > 0 ? practiceStreak + 1 : 1)
      : (practiceStreak < 0 ? practiceStreak - 1 : -1);
    let nextTarget = practiceTarget;
    let nextStreak = updatedStreak;
    if (updatedStreak >= 2) {
      nextTarget = Math.min(3, practiceTarget + 1);
      nextStreak = 0;
    } else if (updatedStreak <= -2) {
      nextTarget = Math.max(1, practiceTarget - 1);
      nextStreak = 0;
    }
    setPracticeTarget(nextTarget);
    setPracticeStreak(nextStreak);
    setPans(next);
    const used = new Set(next.map((a) => a.q.id));
    const remaining = practicePool.filter((candidate) => !used.has(candidate.id));
    const nextQuestion = remaining.sort(
      (a, b) => Math.abs(a.difficulty - nextTarget) - Math.abs(b.difficulty - nextTarget)
    )[0];
    if (next.length >= 10 || !nextQuestion) {
      saveAttempt("practice", ptopic.id, pq, next);
      setScreen("review");
      return;
    }
    setPq([...pq, nextQuestion]);
    setPqi(pqi + 1);
  };

  const openNotes = async (topic) => {
    try {
      const res = await fetch(`${API_URL}/api/notes?topic=${topic.id}`);
      if (!res.ok) throw new Error();
      setNote(await res.json());
    } catch {
      const pack = loadPack(`pack:${exam}`);
      const n = pack?.notes?.find((x) => x.topic_id === topic.id);
      setNote(n || { body_md: "Notes for this topic are being written." });
      setOfflineMode(true);
    }
    setPtopic(topic);
    setScreen("notes");
  };

  const reportQ = async (qid) => {
    await fetch(`${API_URL}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: qid, reason: reportText || "flagged from app review" }),
    });
    setReportFor(null); setReportText("");
    setMsg("Reported — thank you. Our reviewers will check it.");
    trackEvent("report_create", { question_id: qid });
  };
  const [reportFor, setReportFor] = useState(null);
  const [reportText, setReportText] = useState("");

  // Phase 4: persist attempts, load dashboard
  const [startedAt, setStartedAt] = useState(null);
  const [pending, setPending] = useState(0);
  const [offlineMode, setOfflineMode] = useState(false);

  const trackEvent = (name, props) => {
    fetch(`${API_URL}/api/events`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, exam_code: exam, name, props: props || {} }),
    }).catch(() => {});
  };

  const saveAttempt = (kind, topicId, qs, ans) => {
    if (!userId) return;
    const score = ans.filter((a) => a.correct).length;
    const payload = {
      user_id: userId, exam_code: exam, topic_id: topicId,
      question_ids: qs.map((q) => q.id), answers: ans.map((a) => a.picked),
      score, duration_s: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      status: kind, client_uuid: uuid(),
    };
    fetch(`${API_URL}/api/attempts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((res) => {
      if (!res.ok) throw new Error(`Attempt save failed (${res.status})`);
      setPending(pendingCount());
    }).catch(() => {
      queueAttempt(payload); // O2: queue offline, sync later
      setPending(pendingCount());
      setMsg("Could not save online — result queued to retry.");
    });
    trackEvent(kind === "diagnostic" ? "diagnostic_finish" : kind === "mock" ? "mock_finish" : "quiz_finish", { score, total: qs.length });
    return score;
  };

  const downloadPack = async () => {
    setMsg("");
    try {
      const res = await fetch(`${API_URL}/api/pack?exam=${exam}`);
      if (!res.ok) throw new Error();
      const pack = await res.json();
      savePack(`pack:${exam}`, pack);
      setMsg(`Pack saved: ${pack.questions.length}Q + ${pack.notes.length} notes. Practice offline ✓`);
    } catch {
      setMsg("Download failed — connect once, then practice offline.");
    }
  };

  const syncNow = async () => {
    const items = pendingAttempts();
    let ok = 0;
    for (const p of items) {
      try {
        const res = await fetch(`${API_URL}/api/attempts`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        if (res.ok) { dropQueued(p.client_uuid); ok += 1; }
        else { break; }
      } catch { break; }
    }
    setPending(pendingCount());
    setMsg(ok ? `Synced ${ok} offline result${ok > 1 ? "s" : ""} ✓` : "Still offline — kept safely on device.");
    if (ok) loadHome();
  };

  // Pack fallback: use downloaded questions when the network fails (O1)
  const packQuestions = (topicId, limit) => {
    const pack = loadPack(`pack:${exam}`);
    if (!pack) return null;
    let qs = pack.questions;
    if (topicId) qs = qs.filter((q) => q.topic_id === topicId);
    if (exam === "WAEC" && topics.length) {
      const ids = new Set(topics.map((t) => t.id));
      qs = qs.filter((q) => ids.has(q.topic_id));
    }
    if (!qs.length) return null;
    setOfflineMode(true);
    return qs.slice(0, limit);
  };

  const loadHome = async () => {
    if (!userId || !exam) return;
    setPending(pendingCount());
    const q = `user=${encodeURIComponent(userId)}&exam=${exam}`;
    const [pr, pl, ba, mo, pf, ep] = await Promise.all([
      fetch(`${API_URL}/api/progress?${q}`), fetch(`${API_URL}/api/plan?${q}`),
      fetch(`${API_URL}/api/badges?${q}`), fetch(`${API_URL}/api/mocks?${q}`),
      fetch(`${API_URL}/api/prefs?user=${encodeURIComponent(userId)}`),
      fetch(`${API_URL}/api/exam-progress?${q}`),
    ]);
    setDash({
      progress: pr.ok ? await pr.json() : [],
      plan: pl.ok ? await pl.json() : [],
      badges: ba.ok ? await ba.json() : [],
      mocks: mo.ok ? await mo.json() : [],
      prefs: pf.ok ? await pf.json() : {},
      eprog: ep.ok ? await ep.json() : {},
      lastScore: null,
    });
  };

  useEffect(() => { if (screen === "home") loadHome(); }, [screen]);

  // Tutor state (T1–T4)
  const [tutorQ, setTutorQ] = useState(null);
  const [chat, setChat] = useState([]);
  const [tutorCtx, setTutorCtx] = useState(null);
  const [tmsg, setTmsg] = useState("");
  const [tsending, setTsending] = useState(false);
  const chatRef = useRef(null);

  const openTutor = async (question) => {
    setTutorQ(question || null);
    setChat([]); setTmsg("");
    const q = `user=${encodeURIComponent(userId)}&exam=${exam}`;
    const res = await fetch(`${API_URL}/api/tutor/context?${q}`);
    setTutorCtx(res.ok ? await res.json() : null);
    setScreen("tutor");
  };

  const askTutor = async (preset) => {
    const text = (preset || tmsg).trim();
    if (!text || tsending) return;
    setTsending(true);
    const prior = chat.slice(-6);
    setChat((c) => [...c, { from: "you", text }]);
    setTmsg("");
    const res = await fetch(`${API_URL}/api/tutor/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, exam_code: exam, question_id: tutorQ ? tutorQ.id : null, message: text, history: prior }),
    });
    const data = res.ok ? await res.json() : { answer: "Tutor is unreachable — try your notes for now.", suggestion: null, source: "error" };
    setChat((c) => [...c, { from: "tutor", text: data.answer }]);
    trackEvent("tutor_ask", { source: data.source });
    if (data.suggestion) setTutorCtx((ctx) => ({ ...(ctx || {}), suggestion: data.suggestion }));
    setTsending(false);
  };
  // Community state (C1–C3)
  const [posts, setPosts] = useState([]);
  const [postDetail, setPostDetail] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [answerBody, setAnswerBody] = useState("");
  const [board, setBoard] = useState({ board: [], me: null });

  // Part B: proctored exams (consent-gated, camera only in-session)
  const [consentInfo, setConsentInfo] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentRel, setParentRel] = useState("");
  const [camMsg, setCamMsg] = useState("");
  const [camState, setCamState] = useState(null);
  const [camReady, setCamReady] = useState(false);
  const [proctorArmed, setProctorArmed] = useState(false);
  const [proctor, setProctor] = useState(null); // {sessionId, config}
  const [camIssue, setCamIssue] = useState(false);
  const cameraRef = useRef(null);
  const watchStop = useRef(null);
  const sustain = useRef({ noFaceSince: 0, turnSince: 0 });

  // Part C: deletion requests (Q12, in-app only)
  const [delReason, setDelReason] = useState("");
  const [delMsg, setDelMsg] = useState("");

  const submitDeletion = async () => {
    setDelMsg("");
    const res = await fetch(`${API_URL}/api/deletion-requests`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, reason: delReason }),
    });
    if (res.ok) {
      setDelReason("");
      setDelMsg("Request received ✓ — the data controller will action it and confirm by email.");
    } else {
      setDelMsg("Could not send — try again later.");
    }
  };

  // Tester feedback (Option A round): bug / idea / praise + current screen.
  const [fbType, setFbType] = useState("bug");
  const [fbText, setFbText] = useState("");
  const [fbMsg, setFbMsg] = useState("");

  const submitFeedback = async () => {
    setFbMsg("");
    if (!fbText.trim()) {
      setFbMsg("Write a sentence first — even a short one helps.");
      return;
    }
    const res = await fetch(`${API_URL}/api/feedback`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, type: fbType, message: fbText.trim(), screen, app_version: "0.1.0" }),
    });
    if (res.ok) {
      setFbText("");
      setFbMsg("Thanks ✓ — your note is with the team.");
    } else {
      setFbMsg("Could not send — try again later.");
    }
  };

  const loadConsent = async () => {
    setCamMsg("");
    const res = await fetch(`${API_URL}/api/consents?user=${encodeURIComponent(userId)}`);
    const data = await res.json().catch(() => null);
    setConsentInfo(res.ok ? data : null);
    if (res.status === 503) setCamMsg("Proctored exams are unavailable until an approved camera notice is configured.");
    else if (!res.ok) setCamMsg("Could not load consent details. Check your connection and try again.");
    setScreen("consent");
  };

  const submitConsents = async () => {
    setCamMsg("");
    const post = (b) => fetch(`${API_URL}/api/consents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: userId, ...b }) });
    if (schoolName.trim()) {
      const r = await post({ consent_type: "school", notice_version: consentInfo?.notice?.version, consenter_name: schoolName.trim() });
      if (!r.ok) {
        setCamMsg("School consent failed — try again.");
        return;
      }
    }
    if (parentName.trim()) {
      const r = await post({ consent_type: "parent", notice_version: consentInfo?.notice?.version, consenter_name: parentName.trim(), relationship: parentRel.trim() });
      if (!r.ok) {
        setCamMsg(r.status === 400 ? "Parent/guardian name is required." : "Parent consent failed — try again.");
        return;
      }
    }
    await loadConsent();
    const g = await fetch(`${API_URL}/api/consents?user=${encodeURIComponent(userId)}`).then((x) => x.json()).catch(() => null);
    if (g?.complete) setScreen("camPrompt");
    else setCamMsg("Both school and parent consent are needed before a proctored exam.");
  };

  const openProctored = async () => {
    await loadConsent();
    const g = await fetch(`${API_URL}/api/consents?user=${encodeURIComponent(userId)}`).then((x) => x.json()).catch(() => null);
    if (g?.complete) setScreen("camPrompt");
  };

  const doCamEnable = async () => {
    setCamMsg("");
    await logPerm(userId, "camera", camState || "", "prompt_shown");
    const st = await reqCamera().catch(() => "denied_once");
    await logPerm(userId, "camera", camState || "", st);
    setCamState(st);
    if (st === "granted") {
      setScreen("proctorCheck");
    } else if (st === "no_camera" || st === "in_use") {
      setCamMsg(st === "no_camera" ? "No camera found on this device." : "Camera is busy in another app — close it and retry.");
    }
    // denied_once / permanently_denied handled by the camPrompt screen UI
  };

  const postFlag = async (flagType, detail, snapshot) => {
    if (!proctor) return;
    await fetch(`${API_URL}/api/proctor-flags`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: userId, session_id: proctor.sessionId, flag_type: flagType, snapshot_url: snapshot || "", detail: detail || {} }),
    }).catch(() => {});
  };

  const snapPhoto = async () => {
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.4, base64: true, skipProcessing: true });
      if (!shot?.base64) return null;
      return `data:image/jpeg;base64,${shot.base64}`;
    } catch {
      return null;
    }
  };

  // Silent detection sweep (web: MediaPipe; native: unsupported → review flag path).
  const detectionSweep = async () => {
    if (!proctor || !cameraRef.current) return;
    const cfg = proctor.config;
    let snap = null;
    try {
      snap = await snapPhoto();
    } catch {
      setCamIssue(true);
      postFlag("camera_failed", {}, null);
      return;
    }
    if (!snap) return;
    const r = await detectImage(snap).catch(() => null);
    if (!r) return; // model unavailable — session continues, no flag
    const now = Date.now();
    if (r.faces === 0) {
      if (!sustain.current.noFaceSince) sustain.current.noFaceSince = now;
      if (now - sustain.current.noFaceSince > cfg.no_face_seconds * 1000) {
        postFlag("no_face", { seconds: Math.round((now - sustain.current.noFaceSince) / 1000) }, snap);
        sustain.current.noFaceSince = 0;
      }
    } else {
      sustain.current.noFaceSince = 0;
    }
    if (r.faces > 1) {
      postFlag("multiple_faces", { faces: r.faces }, snap);
    }
    if (Math.abs(r.yawDeg) > cfg.yaw_degrees || Math.abs(r.pitchDeg) > cfg.pitch_degrees) {
      if (!sustain.current.turnSince) sustain.current.turnSince = now;
      if (now - sustain.current.turnSince > cfg.sustain_seconds * 1000) {
        postFlag("head_turned", { yaw: Math.round(r.yawDeg), pitch: Math.round(r.pitchDeg) }, snap);
        sustain.current.turnSince = 0;
      }
    } else {
      sustain.current.turnSince = 0;
    }
  };

  // Part A: notifications (pre-prompt first, system prompt only on Continue)
  const [notifMsg, setNotifMsg] = useState("");
  const [notifState, setNotifState] = useState(null);
  const [myPlans, setMyPlans] = useState([]);

  const openNotifPrompt = async () => {
    setNotifMsg("");
    if (typeof iosNeedsInstall === "function" && iosNeedsInstall()) {
      setScreen("notifPromptIos");
      return;
    }
    const st = await notifStatus().catch(() => "unknown");
    setNotifState(st);
    await logPerm(userId, "notifications", "", "prompt_shown");
    setScreen("notifPrompt");
  };

  const doNotifEnable = async () => {
    setNotifMsg("");
    try {
      await setupChannels();
    } catch {}
    const st = await requestNotifPermission().catch(() => "denied_once");
    await logPerm(userId, "notifications", notifState || "", st);
    setNotifState(st);
    if (st === "granted") {
      try {
        await registerToken(userId);
        setNotifMsg("Reminders on ✓ — check Settings to set time and quiet hours.");
      } catch (e) {
        setNotifMsg("Notifications allowed, but push needs a dev build — in-app reminders still work. (" + e.message + ")");
      }
      setScreen("home");
      return;
    }
    if (st === "permanently_denied") {
      setNotifMsg("Blocked in system settings. Open settings to allow, or use in-app reminders below.");
      return;
    }
    setNotifMsg("No problem — in-app reminders and email fallback still work.");
  };

  const loadMyReminders = async () => {
    const res = await fetch(`${API_URL}/api/curriculum/plans?user=${encodeURIComponent(userId)}`);
    setMyPlans(res.ok ? await res.json() : []);
    setScreen("myReminders");
  };

  // Curriculum syllabus (doc/WAEC_Subjects_and_Curriculum.md)
  const [currDepts, setCurrDepts] = useState([]);
  const [currDept, setCurrDept] = useState(null);
  const [currSubjects, setCurrSubjects] = useState([]);
  const [currSubject, setCurrSubject] = useState(null);
  const [currProg, setCurrProg] = useState({});
  const [planSel, setPlanSel] = useState([]);
  const [planTime, setPlanTime] = useState("18:30");
  const [planDays, setPlanDays] = useState("");
  const [adminMsg, setAdminMsg] = useState("");
  const [admSlug, setAdmSlug] = useState("");
  const [admTitle, setAdmTitle] = useState("");
  const [admNotes, setAdmNotes] = useState("");
  const [admTopicId, setAdmTopicId] = useState("");
  const [admParent, setAdmParent] = useState("");
  const [admSrcUrl, setAdmSrcUrl] = useState("");
  const [admSrcNote, setAdmSrcNote] = useState("");
  const [admEdition, setAdmEdition] = useState("");

  const loadCurrDepts = async () => {
    const res = await fetch(`${API_URL}/api/curriculum/departments`);
    setCurrDepts(res.ok ? await res.json() : []);
    setScreen("currDepts");
  };

  const openCurrDept = async (d) => {
    setCurrDept(d);
    const res = await fetch(`${API_URL}/api/curriculum/departments/${d.slug}/subjects?user=${encodeURIComponent(userId)}`);
    setCurrSubjects(res.ok ? await res.json() : []);
    setScreen("currSubjects");
  };

  const openCurrSubject = async (slug) => {
    const res = await fetch(`${API_URL}/api/curriculum/subjects/${slug}?user=${encodeURIComponent(userId)}`);
    if (!res.ok) return;
    const data = await res.json();
    setCurrSubject(data);
    setCurrProg(data.progress || {});
    setPlanSel([]);
    setScreen("currSubject");
  };

  const currFlatIds = (nodes) => nodes.reduce((a, n) => a.concat([n.id], currFlatIds(n.children || [])), []);

  const cycleCurrStatus = async (topicId) => {
    const cur = currProg[topicId] || "not_started";
    const next = cur === "not_started" ? "studying" : cur === "studying" ? "done" : "not_started";
    const res = await fetch(`${API_URL}/api/curriculum/progress`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, topic_id: topicId, status: next }),
    });
    if (res.ok) setCurrProg({ ...currProg, [topicId]: next });
  };

  const currRenderTopics = (nodes, depth) =>
    nodes.map((n) => (
      <View key={n.id}>
        <TouchableOpacity onPress={() => cycleCurrStatus(n.id)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs, paddingLeft: depth * spacing.md }}>
            <Badge label={currProg[n.id] === "done" ? "✓" : currProg[n.id] === "studying" ? "…" : "○"} color={currProg[n.id] === "done" ? colors.success : currProg[n.id] === "studying" ? colors.warning : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.body, fontWeight: depth === 0 ? "800" : "400" }}>{n.title}</Text>
              {n.notes ? <Text style={{ ...type.small, color: colors.muted }}>{n.notes}</Text> : null}
            </View>
          </View>
        </TouchableOpacity>
        {currRenderTopics(n.children || [], depth + 1)}
      </View>
    ));

  const submitCurrPlan = async () => {
    if (!currSubject || !planSel.length) {
      setMsg("Pick at least one topic for the plan.");
      return;
    }
    const res = await fetch(`${API_URL}/api/curriculum/plans`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, subject_slug: currSubject.slug, topic_ids: planSel, time_slot: planTime, days: planDays }),
    });
    setMsg(res.ok ? "Study plan saved — reminders queued ✓" : "Plan failed — check the time slot (HH:MM).");
  };

  const currAdmin = async (path, method, body) => {
    const res = await fetch(`${API_URL}${path}`, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    setAdminMsg(res.ok ? "Saved ✓" : `Failed (${res.status}): ${data.error || "see server"}`);
    if (res.ok && currSubject) openCurrSubject(currSubject.slug);
  };

  const loadPosts = async () => {
    const res = await fetch(`${API_URL}/api/posts?exam=${exam}`);
    setPosts(res.ok ? await res.json() : []);
    setScreen("community");
  };

  const openPost = async (id) => {
    const res = await fetch(`${API_URL}/api/posts/${id}`);
    if (res.ok) { setPostDetail(await res.json()); setScreen("post"); }
  };

  const submitPost = async () => {
    if (!newTitle.trim()) return;
    await fetch(`${API_URL}/api/posts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, exam_code: exam, title: newTitle, body: newBody }),
    });
    setNewTitle(""); setNewBody("");
    loadPosts();
  };

  const submitAnswer = async () => {
    if (!answerBody.trim()) return;
    await fetch(`${API_URL}/api/posts/${postDetail.id}/answers`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, body: answerBody }),
    });
    setAnswerBody("");
    openPost(postDetail.id);
  };

  const acceptAnswer = async (aid) => {
    await fetch(`${API_URL}/api/posts/${postDetail.id}/accept`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer_id: aid, user_id: userId }),
    });
    openPost(postDetail.id);
  };

  const loadBoard = async () => {
    const res = await fetch(`${API_URL}/api/leaderboard?exam=${exam}&user=${encodeURIComponent(userId)}`);
    if (res.ok) setBoard(await res.json());
    setScreen("board");
  };

  const tutorFab = <TutorBuddy onPress={() => openTutor(null)} />;
  const [mockLabel, setMockLabel] = useState("");
  const [mq, setMq] = useState([]);
  const [mqi, setMqi] = useState(0);
  const [mans, setMans] = useState([]);
  const [msecs, setMsecs] = useState(0);
  const [mprev, setMprev] = useState(null);

  useEffect(() => {
    if (screen !== "mockrun" || msecs <= 0) return;
    const t = setTimeout(() => {
      if (msecs === 1) finishMock(mans);
      else setMsecs(msecs - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [screen, msecs]);

  const startMock = async (label, count, minutes, topicId) => {
    setOfflineMode(false);
    let qs = null;
    try {
      const url = topicId
        ? `${API_URL}/api/questions?exam=${exam}&topic=${topicId}&limit=${count}`
        : `${API_URL}/api/questions?exam=${exam}&limit=${count}`;
      qs = await loadQuestions(url);
    } catch {
      qs = packQuestions(topicId, count);
    }
    if (!qs || qs.length < count) {
      const available = qs?.length || 0;
      return setMsg(`Question bank is incomplete: ${available} of ${count} standard questions are available. Try again after the bank is expanded.`);
    }
    let sessionId = null;
    let config = null;
    if (proctorArmed) {
      // Proctored start: consent already verified in flow; server re-checks.
      const sres = await fetch(`${API_URL}/api/exam-sessions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: userId, exam_code: exam }),
      }).catch(() => null);
      if (!sres || !sres.ok) {
        setProctorArmed(false);
        setMsg("Proctored start blocked — complete school + parent consent first.");
        setScreen("consent");
        loadConsent();
        return;
      }
      sessionId = (await sres.json()).id;
      config = await fetch(`${API_URL}/api/proctor-config`).then((r) => r.json()).catch(() => null)
        || { no_face_seconds: 10, yaw_degrees: 35, pitch_degrees: 25, sustain_seconds: 5 };
      // Shuffle questions + options per student (server timer stays authoritative).
      qs = [...qs].sort(() => Math.random() - 0.5).map((q) => {
        const opts = typeof q.options === "string" ? JSON.parse(q.options) : [...q.options];
        const order = opts.map((_, i) => i).sort(() => Math.random() - 0.5);
        return { ...q, options: order.map((i) => opts[i]), answer_idx: order.indexOf(q.answer_idx) };
      });
      await setSecureScreen(true).catch(() => {});
      sustain.current = { noFaceSince: 0, turnSince: 0 };
      setCamIssue(false);
      setProctor({ sessionId, config });
    }
    setMockLabel(label); setMq(qs); setMqi(0); setMans([]);
    setMsecs(minutes * 60); setStartedAt(Date.now());
    setScreen("mockrun");
  };

  // Watchers live only during a proctored run: web tab/fullscreen, native background.
  useEffect(() => {
    if (screen !== "mockrun" || !proctor) return;
    const stop = watchAppState((kind) => {
      if (kind === "backgrounded") {
        setCamIssue(true);
        setProctor((p) => (p ? { ...p, cameraOff: true } : p));
        postFlag("backgrounded", {}, null);
        fetch(`${API_URL}/api/exam-sessions/${proctor.sessionId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: userId, camera_status: "off", needs_review: true }),
        }).catch(() => {});
      } else {
        postFlag(kind, {}, null);
      }
    });
    watchStop.current = stop;
    const sweep = setInterval(() => {
      detectionSweep().catch(() => {});
    }, 4000);
    return () => {
      clearInterval(sweep);
      if (typeof stop === "function") stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, proctor?.sessionId]);

  const answerMock = (idx) => {
    const q = mq[mqi];
    const next = [...mans, { q, picked: idx, correct: idx === q.answer_idx }];
    setMans(next);
    if (mqi + 1 >= mq.length) finishMock(next);
    else setMqi(mqi + 1);
  };

  const finishMock = async (ans) => {
    const score = ans.filter((a) => a.correct).length;
    const prev = dash.mocks[0] || null;
    setMprev(prev);
    if (proctor) {
      // Camera off the moment the exam ends. Flags are review-only data.
      await setSecureScreen(false).catch(() => {});
      await fetch(`${API_URL}/api/exam-sessions/${proctor.sessionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: userId, camera_status: proctor.cameraOff ? "off" : "active", needs_review: camIssue, results_final: true }),
      }).catch(() => {});
      setProctor(null);
      setProctorArmed(false);
      setCamIssue(false);
    }
    if (userId) {
      await fetch(`${API_URL}/api/mocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId, exam_code: exam, label: mockLabel,
          score, total: ans.length,
          breakdown: { perQuestion: ans.map((a) => (a.correct ? 1 : 0)) },
        }),
      }).catch(() => {});
      saveAttempt("mock", ans[0] ? ans[0].q.topic_id : null, ans.map((a) => a.q), ans);
    }
    setScreen("mockresult");
  };

  const startDiagnostic = async () => {
    setMsg(""); setOfflineMode(false);
    let all = null;
    try {
      all = await loadQuestions(`${API_URL}/api/questions?exam=${exam}&limit=60`);
    } catch {
      all = packQuestions(null, 60);
      if (!all) return setMsg("No connection and no downloaded pack — download once to practice offline.");
    }
    if (exam === "WAEC") {
      const ids = new Set(topics.map((t) => t.id));
      all = all.filter((q) => ids.has(q.topic_id));
    }
    if (!all.length) return setMsg("No questions seeded for this exam yet.");
    const first = [...all].sort((a, b) => Math.abs(a.difficulty - 2) - Math.abs(b.difficulty - 2))[0];
    setQuizPool(all);
    setQuiz([first]); setQi(0); setAnswers([]); setTarget(2); setStreak(0);
    setStartedAt(Date.now());
    setScreen("quiz");
  };

  const answerQuiz = (idx) => {
    const q = quiz[qi];
    const correct = idx === q.answer_idx;
    const s = correct ? (streak > 0 ? streak + 1 : 1) : (streak < 0 ? streak - 1 : -1);
    let t = target;
    let nextStreak = s;
    if (s >= 2) { t = Math.min(3, t + 1); nextStreak = 0; }
    if (s <= -2) { t = Math.max(1, t - 1); nextStreak = 0; }
    setTarget(t);
    setStreak(nextStreak);
    const next = [...answers, { q, picked: idx, correct }];
    setAnswers(next);
    const used = new Set(next.map((a) => a.q.id));
    const remaining = quizPool.filter((candidate) => !used.has(candidate.id));
    const nextQuestion = remaining.sort(
      (a, b) => Math.abs(a.difficulty - t) - Math.abs(b.difficulty - t)
    )[0];
    if (next.length >= 15 || !nextQuestion) {
      saveAttempt("diagnostic", null, quiz, next);
      setScreen("results");
      return;
    }
    setQuiz([...quiz, nextQuestion]);
    setQi(qi + 1);
  };

  const pauseQuiz = () => {
    setDraft({ kind: "diagnostic", quiz, quizPool, qi, answers, target, streak });
    setScreen("home");
    setMsg("Diagnostic paused — tap Continue to resume.");
  };

  const pausePractice = () => {
    setDraft({ kind: "practice", ptopic, pq, pqi, pans, secs });
    setScreen("home");
    setMsg("Practice paused — tap Continue to resume.");
  };

  const pauseMock = () => {
    setDraft({ kind: "mock", mockLabel, mq, mqi, mans, msecs });
    setScreen("home");
    setMsg("Mock paused — tap Continue to resume.");
  };

  const resumeDraft = () => {
    if (!draft) return;
    if (draft.kind === "practice") {
      setPtopic(draft.ptopic); setPq(draft.pq); setPqi(draft.pqi); setPans(draft.pans); setSecs(draft.secs);
      setScreen("practice");
    } else if (draft.kind === "mock") {
      setMockLabel(draft.mockLabel); setMq(draft.mq); setMqi(draft.mqi); setMans(draft.mans); setMsecs(draft.msecs);
      setScreen("mockrun");
    } else {
      setQuiz(draft.quiz); setQuizPool(draft.quizPool); setQi(draft.qi); setAnswers(draft.answers); setTarget(draft.target); setStreak(draft.streak);
      setScreen("quiz");
    }
  };

  const signOut = () => {
    setUserId(null); setExam(null); setDept(null); setTopics([]);
    setDraft(null); setChat([]); setTutorCtx(null);
    setDash({ progress: [], plan: [], badges: [], mocks: [], prefs: {}, eprog: {}, lastScore: null });
    setEmail(""); setPassword(""); setMsg("");
    setScreen("auth");
  };

  if (screen === "auth") {
    return (
      <Screen>
        <PageHeader title="🎓 BetterMe" subtitle="Free WAEC · TOEFL · SAT · GRE prep" color={colors.secondary} />
        <Card>
          <Text style={{ ...type.body, color: colors.muted }}>Sign in to start your diagnostic and find your weak topics.</Text>
        </Card>
        <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
        <Btn title="Create free account" onPress={() => callAuth("sign-up")} />
        <Btn title="Sign in" variant="ghost" onPress={() => callAuth("sign-in")} />
        {msg ? <Card accent={colors.danger}><Text style={{ color: colors.danger }}>{msg}</Text></Card> : null}
        <Text style={{ ...type.tiny, color: colors.muted, textAlign: "center" }}>build 2026-09-29c · free forever · works offline</Text>
      </Screen>
    );
  }

  const EXAM_META = {
    WAEC: { icon: "📚", desc: "Secondary school · Science / Art / Commerce" },
    TOEFL: { icon: "✈️", desc: "Study abroad · Reading + Listening" },
    SAT: { icon: "🎓", desc: "US college · 98Q full paper" },
    GRE: { icon: "📊", desc: "Postgraduate · 54Q + writing excluded" },
  };

  if (screen === "exams") {
    return (
      <Screen>
        <PageHeader title="Choose your exam" subtitle="Progress is saved separately per exam" color={colors.primary} />
        {EXAMS.map((e) => (
          <MenuRow key={e} icon={EXAM_META[e].icon} title={e} subtitle={EXAM_META[e].desc} color={colors.primary} onPress={() => pickExam(e)} />
        ))}
      </Screen>
    );
  }

  const DEPT_META = {
    Science: { icon: "🔬", desc: "Physics · Chemistry · Biology + 2" },
    Art: { icon: "🎭", desc: "Literature · Government · History + 2" },
    Commerce: { icon: "💼", desc: "Economics · Accounting · Marketing + 2" },
  };

  if (screen === "dept") {
    return (
      <Screen>
        <PageHeader title="Your department?" subtitle="English, Mathematics + Civic come free with all" color={colors.primary} />
        {Object.entries(DEPT_META).map(([d, m]) => (
          <MenuRow key={d} icon={m.icon} title={d} subtitle={m.desc} color={colors.primary} onPress={() => pickDept(d)} />
        ))}
      </Screen>
    );
  }

  if (screen === "design") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="Design system" subtitle="Tokens + components" color={colors.text} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        <SectionTitle>Colors</SectionTitle>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {[colors.primary, colors.secondary, colors.accent, colors.success, colors.danger, colors.tutor].map((c) => (
            <View key={c} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, ...shadow.card }} />
          ))}
        </View>
        <SectionTitle>Hover me 👇</SectionTitle>
        <HoverCard onPress={() => {}}>
          <Text style={type.h2}>Hover card</Text>
          <Text style={{ color: colors.muted }}>Lifts + deepens shadow on hover (web).</Text>
          <ProgressBar value={0.67} />
        </HoverCard>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Badge label="NEW" />
          <Badge label="WEAK" color={colors.danger} />
          <Badge label="TUTOR" color={colors.tutor} />
        </View>
      </Screen>
    );
  }

  if (screen === "quiz" && quiz[qi]) {
    const q = quiz[qi];
    const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    const quizLength = Math.min(15, quizPool.length);
    return (
      <Screen>
        <PageHeader title={`Diagnostic ${qi + 1}/${quizLength}`} subtitle={`Adaptive · level ${q.difficulty}`} color={colors.tutor} />
        {repeatNote ? <Text style={{ ...type.small, color: colors.muted }}>{repeatNote}</Text> : null}
        <ProgressBar value={(qi + 1) / quizLength} color={colors.tutor} />
        <HoverCard>
          <Text style={{ fontSize: 17, fontWeight: "700", lineHeight: 24 }}>{q.stem}</Text>
        </HoverCard>
        {opts.map((o, i) => (
          <Btn key={i} title={o} variant="ghost" onPress={() => answerQuiz(i)} />
        ))}
        <Btn title="⏸ Pause & continue later" variant="ghost" onPress={pauseQuiz} />
      </Screen>
    );
  }

  if (screen === "results") {
    const score = answers.filter((a) => a.correct).length;
    const perTopic = {};
    answers.forEach((a) => {
      const t = topics.find((x) => x.id === a.q.topic_id);
      const name = t ? t.name : `Topic ${a.q.topic_id}`;
      perTopic[name] = perTopic[name] || { ok: 0, n: 0 };
      perTopic[name].n += 1;
      if (a.correct) perTopic[name].ok += 1;
    });
    const weak = Object.entries(perTopic).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={`Results: ${score}/${answers.length}`} subtitle={weak ? `Weakest: ${weak[0]} — practice it next` : "Diagnostic complete"} color={score / Math.max(answers.length, 1) >= 0.6 ? colors.success : colors.warning} />
        {Object.entries(perTopic).map(([name, v]) => (
          <HoverCard key={name}>
            <Text style={{ fontWeight: "800", fontSize: 15 }}>{name}: {v.ok}/{v.n}</Text>
            <ProgressBar value={v.ok / v.n} color={v.ok / v.n >= 0.6 ? colors.success : colors.danger} />
          </HoverCard>
        ))}
        <Btn title="Practice weakest topic →" onPress={() => { const t = topics.find((x) => x.name === weak[0]); if (t) startPractice(t); }} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        {msg ? <Text>{msg}</Text> : null}
      </Screen>
    );
  }

  if (screen === "practice" && pq[pqi]) {
    const q = pq[pqi];
    const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    const practiceLength = Math.min(10, practicePool.length);
    return (
      <Screen>
        <PageHeader title={`${ptopic.name} ${pqi + 1}/${practiceLength}`} subtitle="Adaptive 10Q drill" color={colors.primary} />
        {repeatNote ? <Text style={{ ...type.small, color: colors.muted }}>{repeatNote}</Text> : null}
        <TimerPill label={`${mm}:${ss}`} />
        <ProgressBar value={(pqi + 1) / practiceLength} />
        <HoverCard>
          <Text style={{ fontSize: 17, fontWeight: "700", lineHeight: 24 }}>{q.stem}</Text>
        </HoverCard>
        {opts.map((o, i) => (
          <Btn key={i} title={o} variant="ghost" onPress={() => answerPractice(i)} />
        ))}
        <Btn title="📘 Read notes first" variant="ghost" onPress={() => openNotes(ptopic)} />
        <Btn title="⏸ Pause & continue later" variant="ghost" onPress={pausePractice} />
      </Screen>
    );
  }

  if (screen === "review") {
    const score = pans.filter((a) => a.correct).length;
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={`Practice: ${score}/${pans.length}`} subtitle={score / Math.max(pans.length, 1) >= 0.7 ? "Solid work 🎉" : "Review the misses below"} color={score / Math.max(pans.length, 1) >= 0.7 ? colors.success : colors.primary} />
        {pans.map((a, i) => {
          const opts = typeof a.q.options === "string" ? JSON.parse(a.q.options) : a.q.options;
          return (
            <HoverCard key={i} accent={a.correct ? colors.success : colors.danger}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
                <Badge label={a.correct ? "✓ CORRECT" : "✗ MISSED"} color={a.correct ? colors.success : colors.danger} />
                <Text style={{ ...type.small, color: colors.muted }}>Q{i + 1}</Text>
              </View>
              <Text style={{ fontWeight: "700", fontSize: 15 }}>{a.q.stem}</Text>
              <Text style={{ ...type.small }}>You: {opts[a.picked]}</Text>
              {!a.correct ? <Text style={{ ...type.small, fontWeight: "800", color: colors.success }}>Answer: {opts[a.q.answer_idx]}</Text> : null}
              <Text style={{ ...type.small, color: colors.muted, marginTop: spacing.xs }}>{a.q.explanation}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <View style={{ flex: 1 }}><Btn title="✨ Tutor" variant="ghost" onPress={() => openTutor(a.q)} /></View>
                <View style={{ flex: 1 }}><Btn title="🚩 Report" variant="ghost" onPress={() => { setReportFor(a.q.id); setReportText(""); }} /></View>
              </View>
              {reportFor === a.q.id ? (
                <View style={{ marginTop: spacing.sm }}>
                  <Field label="What's wrong?" value={reportText} onChangeText={setReportText} placeholder="e.g. answer should be B, typo in option C" />
                  <Btn title="Send report" onPress={() => reportQ(a.q.id)} />
                </View>
              ) : null}
            </HoverCard>
          );
        })}
        {msg ? <Card accent={colors.success}><Text>{msg}</Text></Card> : null}
        <Btn title="📘 Topic notes" onPress={() => openNotes(ptopic)} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "notes") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={`📘 ${ptopic ? ptopic.name : "Notes"}`} subtitle="Key ideas & formulas" color={colors.secondary} />
        <HoverCard><Text style={{ ...type.body }}>{note ? note.body_md : "Loading…"}</Text></HoverCard>
        {ptopic ? <Btn title="Practice this topic →" onPress={() => startPractice(ptopic)} /> : null}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "tutor") {
    const sug = tutorCtx?.suggestion;
    const sugTopic = sug ? topics.find((t) => t.id === sug.topic_id) : null;
    const chips = ["Explain simply", "Give an example", "Summarize this"];
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ backgroundColor: colors.tutor, paddingTop: spacing.lg, paddingBottom: spacing.md, paddingHorizontal: spacing.lg }}>
          <View style={{ ...page }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...type.h2, color: "#fff" }}>✨ AI tutor</Text>
                <Text style={{ ...type.tiny, color: "#fff", opacity: 0.85 }}>
                  {tutorCtx ? `Knows: ${tutorCtx.weakTopics?.map((w) => w.name).join(", ") || "nothing yet — take the diagnostic"}` : "Loading what I know about you…"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <TouchableOpacity onPress={() => { setChat([]); setTutorQ(null); setTmsg(""); }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>🆕</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setScreen("home")}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        <ScrollView
          ref={chatRef}
          onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.md }}
        >
          <View style={{ ...page, gap: spacing.xs }}>
            {tutorQ ? <Card accent={colors.tutor}><Text style={{ fontWeight: "700" }}>About: {tutorQ.stem}</Text></Card> : null}
            {chat.length === 0 ? <EmptyState icon="💬" text="Ask anything study-related — I remember your weak spots and what you've mastered." /> : null}
            {chat.map((m, i) => (
              <ChatBubble key={i} from={m.from} text={m.text} />
            ))}
            {tsending ? <ChatBubble from="tutor" text="…" /> : null}
            {sug && sugTopic ? (
              <TouchableOpacity onPress={() => startPractice(sugTopic)}>
                <Card accent={colors.tutor}>
                  <Text style={{ fontWeight: "800" }}>▶ Practice next: {sugTopic.name} ›</Text>
                </Card>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xs }}>
          <View style={{ ...page, flexDirection: "row", gap: spacing.sm }}>
            {chips.map((c) => (
              <TouchableOpacity key={c} onPress={() => askTutor(c === "Explain simply" ? "explain this again in a simpler way" : c)} style={{ borderWidth: 1.5, borderColor: colors.tutor, borderRadius: radius.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: "#fff" }}>
                <Text style={{ color: colors.tutor, fontWeight: "700", fontSize: 13 }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.xs, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ ...page, flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
            <TextInput
              value={tmsg} onChangeText={setTmsg} placeholder="Message your tutor…"
              placeholderTextColor={colors.muted} multiline
              onSubmitEditing={() => askTutor()}
              style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.text, maxHeight: 100 }}
            />
            <TouchableOpacity onPress={() => askTutor()} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tsending ? colors.muted : colors.tutor, alignItems: "center", justifyContent: "center", ...shadow.card }}>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (screen === "community") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={`Community — ${exam}`} subtitle="One shared feed, filtered by exam" color={colors.warning} />
        <SectionTitle>Ask a question</SectionTitle>
        <Field label="Title" value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Why is (x−2)(x−3)=0?" />
        <Field label="Details (optional)" value={newBody} onChangeText={setNewBody} placeholder="Show your working…" />
        <Btn title="Post question" onPress={submitPost} />
        <SectionTitle>Questions</SectionTitle>
        {posts.length === 0 ? <EmptyState icon="💭" text="No questions yet — be the first." /> : null}
        {posts.map((p) => (
          <HoverCard key={p.id} onPress={() => openPost(p.id)}>
            <Text style={{ fontWeight: "800", fontSize: 15 }}>{p.title}</Text>
            <Text style={{ ...type.small, color: colors.muted }}>{p.user_id} · {p.topic_name || p.exam_code} · {p.answers} answers ›</Text>
          </HoverCard>
        ))}
        <Btn title="🏆 Leaderboard" variant="blue" onPress={loadBoard} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "post" && postDetail) {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="Question" subtitle={`${postDetail.user_id} · ${postDetail.topic_name || postDetail.exam_code}`} color={colors.warning} />
        <HoverCard><Text style={{ ...type.h2 }}>{postDetail.title}</Text>{postDetail.body ? <Text style={{ ...type.body, marginTop: spacing.xs }}>{postDetail.body}</Text> : null}</HoverCard>
        <SectionTitle>Answers ({postDetail.answers.length})</SectionTitle>
        {postDetail.answers.map((a) => (
          <HoverCard key={a.id} accent={a.is_accepted ? colors.success : colors.border}>
            <Text style={{ ...type.body }}>{a.is_accepted ? "✅ " : ""}{a.body}</Text>
            <Text style={{ ...type.small, color: colors.muted }}>— {a.user_id}</Text>
            {!a.is_accepted ? <Btn title="Accept ✓" variant="ghost" onPress={() => acceptAnswer(a.id)} /> : null}
          </HoverCard>
        ))}
        <Field label="Your answer" value={answerBody} onChangeText={setAnswerBody} placeholder="Write your answer…" />
        <Btn title="Answer" onPress={submitAnswer} />
        <Btn title="🚩 Report post" variant="ghost" onPress={() => fetch(`${API_URL}/api/posts/${postDetail.id}/report`, { method: "POST" }).then(() => setScreen("community"))} />
        <Btn title="← Back" variant="ghost" onPress={loadPosts} />
      </Screen>
    );
  }

  if (screen === "board") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={`🏆 Leaderboard`} subtitle={`${exam} · by quiz scores`} color={colors.warning} />
        {board.board.length === 0 ? <EmptyState icon="🏁" text="No quiz scores yet. Finish a quiz to rank." /> : null}
        {board.board.map((b) => (
          <LeaderRow key={b.rank} rank={b.rank} name={b.user} score={`${b.total} pts · ${b.quizzes} quizzes`} you={b.you} />
        ))}
        <Btn title="← Back" variant="ghost" onPress={() => setScreen("community")} />
      </Screen>
    );
  }

  if (screen === "currDepts") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="📖 Syllabus" subtitle="WAEC departments · track every topic" color={colors.primary} />
        {currDepts.length === 0 ? <EmptyState icon="📖" text="Could not load departments — is the server running?" /> : null}
        {currDepts.map((d) => (
          <MenuRow key={d.slug} icon={d.slug === "science" ? "🔬" : d.slug === "humanities" ? "🎭" : "💼"} title={d.name} subtitle={`${d.subject_count} subjects`} color={colors.primary} onPress={() => openCurrDept(d)} />
        ))}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "currSubjects") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={currDept?.name || "Subjects"} subtitle="Core subjects always shown" color={colors.primary} />
        {currSubjects.map((s) => (
          <View key={s.slug}>
            <MenuRow icon={s.is_core ? "⭐" : "📘"} title={`${s.name}${s.is_core ? " · core" : ""}`} subtitle={`${s.topic_count} topics${s.done_count ? ` · ${s.done_count} done` : ""}`} color={colors.primary} onPress={() => openCurrSubject(s.slug)} />
            {s.eligibility_note ? <Text style={{ ...type.small, color: colors.warning, marginBottom: spacing.sm }}>Note: {s.eligibility_note}</Text> : null}
          </View>
        ))}
        <Btn title="← Departments" variant="ghost" onPress={() => setScreen("currDepts")} />
      </Screen>
    );
  }

  if (screen === "currSubject" && currSubject) {
    const ids = currFlatIds(currSubject.topics);
    const done = ids.filter((id) => currProg[id] === "done").length;
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={currSubject.name} subtitle={currSubject.is_core ? "Core subject" : "Department subject"} color={colors.primary} />
        <Card accent={colors.success}>
          <Text style={{ fontWeight: "800" }}>{done}/{ids.length} topics done</Text>
          <ProgressBar value={ids.length ? done / ids.length : 0} color={colors.success} />
        </Card>
        <SectionTitle>Topics — tap to set status</SectionTitle>
        {ids.length === 0 ? <EmptyState icon="📝" text="No topics imported for this subject yet." /> : null}
        <Card>{currRenderTopics(currSubject.topics, 0)}</Card>
        <SectionTitle>Study plan</SectionTitle>
        <Card>
          <Text style={{ ...type.small, color: colors.muted }}>Tick topics below, set a time, save — reminders queue for the notifier.</Text>
          {currSubject.topics.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => setPlanSel(planSel.includes(t.id) ? planSel.filter((x) => x !== t.id) : [...planSel, t.id])}>
              <Text style={{ ...type.body, paddingVertical: spacing.xs }}>{planSel.includes(t.id) ? "☑" : "☐"} {t.title}</Text>
            </TouchableOpacity>
          ))}
          <Field label="Time slot (HH:MM)" value={planTime} onChangeText={setPlanTime} placeholder="18:30" />
          <Field label="Days (optional, e.g. Mon,Wed,Fri)" value={planDays} onChangeText={setPlanDays} placeholder="Mon,Wed,Fri" />
          <Btn title={`Save plan (${planSel.length} topics)`} onPress={submitCurrPlan} />
        </Card>
        <SectionTitle>Exam format</SectionTitle>
        {currSubject.exam_papers.map((p, i) => (
          <Card key={i}><Text style={{ fontWeight: "800" }}>{p.label}</Text><Text style={{ ...type.small }}>{p.format}</Text></Card>
        ))}
        <SectionTitle>Textbooks</SectionTitle>
        {currSubject.textbooks.map((b, i) => (
          <Text key={i} style={{ ...type.small, paddingVertical: spacing.xs }}>• {b}</Text>
        ))}
        {currSubject.source ? <Card accent={colors.warning}><Text style={{ ...type.small }}>Source: {currSubject.source.source_note || currSubject.source.source_url} Confirm against your school's syllabus.</Text></Card> : null}
        <Btn title="🔧 Admin corrections" variant="ghost" onPress={() => { setAdminMsg(""); setAdmSlug(currSubject.slug); setScreen("currAdmin"); }} />
        <Btn title="← Subjects" variant="ghost" onPress={() => setScreen("currSubjects")} />
        {msg ? <Text>{msg}</Text> : null}
      </Screen>
    );
  }

  if (screen === "currAdmin") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="🔧 Admin corrections" subtitle="Admins only — edits are live immediately" color={colors.text} />
        {adminMsg ? <Card><Text>{adminMsg}</Text></Card> : null}
        <SectionTitle>Add topic</SectionTitle>
        <Field label="Subject slug" value={admSlug} onChangeText={setAdmSlug} placeholder="biology" />
        <Field label="Title" value={admTitle} onChangeText={setAdmTitle} placeholder="New topic title" />
        <Field label="Notes (optional)" value={admNotes} onChangeText={setAdmNotes} placeholder="Limits…" />
        <Field label="Parent topic id (optional)" value={admParent} onChangeText={setAdmParent} placeholder="empty = top level" keyboardType="numeric" />
        <Btn title="Add topic" onPress={() => currAdmin(`/api/curriculum/admin/subjects/${admSlug}/topics`, "POST", { title: admTitle, notes: admNotes, parent_topic_id: admParent ? +admParent : null })} />
        <SectionTitle>Edit topic</SectionTitle>
        <Field label="Topic id" value={admTopicId} onChangeText={setAdmTopicId} placeholder="e.g. 12" keyboardType="numeric" />
        <Btn title="Save title + notes" onPress={() => currAdmin(`/api/curriculum/admin/topics/${admTopicId}`, "PATCH", { title: admTitle || undefined, notes: admNotes || undefined })} />
        <SectionTitle>Update source</SectionTitle>
        <Field label="Source URL" value={admSrcUrl} onChangeText={setAdmSrcUrl} placeholder="https://…" />
        <Field label="Source note" value={admSrcNote} onChangeText={setAdmSrcNote} placeholder="Where this came from" />
        <Field label="Syllabus edition" value={admEdition} onChangeText={setAdmEdition} placeholder="2026" />
        <Btn title="Verify source now" onPress={() => currAdmin(`/api/curriculum/admin/subjects/${admSlug}/source`, "PUT", { source_url: admSrcUrl || undefined, source_note: admSrcNote || undefined, syllabus_edition: admEdition || undefined, last_verified_at: new Date().toISOString() })} />
        <Btn title="← Back" variant="ghost" onPress={() => setScreen(currSubject ? "currSubject" : "currDepts")} />
      </Screen>
    );
  }

  if (screen === "notifPrompt") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="🔔 Reminders" subtitle="Only when you say yes" color={colors.warning} />
        {notifState === "permanently_denied" ? (
          <Card accent={colors.danger}>
            <Text style={{ ...type.body, fontWeight: "800" }}>Notifications are blocked in system settings.</Text>
            <Text style={{ ...type.small, color: colors.muted }}>Open settings to allow them, or keep using in-app reminders — nothing breaks.</Text>
            <Btn title="Open app settings" onPress={() => { logPerm(userId, "notifications", "permanently_denied", "settings_opened"); openAppSettings(); }} />
            <Btn title="Use in-app reminders" variant="ghost" onPress={() => setScreen("myReminders")} />
          </Card>
        ) : (
          <PrePrompt
            icon="🔔"
            title="Allow study reminders?"
            what="BetterMe sends a short reminder at your chosen study time."
            why="So you keep your streak without opening the app to check."
            whenOn="Only at your time and days, never at night if you set quiet hours."
            notDo="No ads. No spam. No selling your contact. Token is only a random address for your device."
            onContinue={doNotifEnable}
            onLater={() => setScreen("home")}
          />
        )}
        {notifMsg ? <Card><Text>{notifMsg}</Text></Card> : null}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "notifPromptIos") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="🔔 Reminders on iPhone" subtitle="Install first, then allow" color={colors.warning} />
        <Card>
          <Text style={{ ...type.body, fontWeight: "800" }}>iPhones only allow web reminders for installed sites.</Text>
          <Text style={{ ...type.body, color: colors.muted }}>1. Tap Share → Add to Home Screen.{"\n"}2. Open BetterMe from the home screen.{"\n"}3. Come back here and tap Continue.</Text>
        </Card>
        <Btn title="Continue" onPress={() => setScreen("notifPrompt")} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "battery") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="🔋 Battery tips (optional)" subtitle="Only if reminders arrive late" color={colors.text} />
        <Card>
          <Text style={{ ...type.body }}>Some phones (Tecno, Infinix, Xiaomi, Samsung) pause apps in the background, which can delay reminders.</Text>
        </Card>
        <Card>
          <Text style={{ ...type.body, fontWeight: "800" }}>If you want on-time reminders:</Text>
          <Text style={{ ...type.small, color: colors.muted }}>Settings → Battery → find BetterMe → allow background activity / remove restrictions. Steps differ per brand — search "background" in your Settings app.</Text>
        </Card>
        <Card>
          <Text style={{ ...type.small, color: colors.muted }}>Totally optional. Skipping changes nothing else — in-app reminders always work.</Text>
        </Card>
        <Btn title="Done" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "myReminders") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="🔔 My reminders" subtitle="In-app list — works with no permission" color={colors.warning} />
        {myPlans.length === 0 ? <EmptyState icon="🔕" text="No study plans yet. Create one from a subject page." /> : null}
        {myPlans.map((p) => (
          <Card key={p.id}>
            <Text style={{ fontWeight: "800" }}>{p.subject_slug} · {p.time_slot || "no time"} {p.days ? `· ${p.days}` : ""}</Text>
            <Text style={{ ...type.small, color: colors.muted }}>{p.pending} reminder{p.pending === 1 ? "" : "s"} waiting</Text>
          </Card>
        ))}
        <Btn title="Enable push reminders" onPress={openNotifPrompt} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "consent") {
    const done = !!consentInfo?.complete;
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="🛡 Proctored exam" subtitle="Consent first — both boxes required" color={colors.danger} />
        {consentInfo?.notice ? (
          <>
            <Card>
              <Text style={{ ...type.h2 }}>{consentInfo.notice.title}</Text>
              <Text style={{ ...type.body }}>{consentInfo.notice.body}</Text>
            </Card>
            <SectionTitle>School consent</SectionTitle>
            <Field label="School name" value={schoolName} onChangeText={setSchoolName} placeholder="e.g. King's College Lagos" />
            <SectionTitle>Parent / guardian consent (required for minors)</SectionTitle>
            <Field label="Parent/guardian full name" value={parentName} onChangeText={setParentName} placeholder="Full name" />
            <Field label="Relationship (e.g. mother, father, guardian)" value={parentRel} onChangeText={setParentRel} placeholder="mother" />
            <Btn title={done ? "Consent complete — continue ✓" : "Save consents"} onPress={done ? () => setScreen("camPrompt") : submitConsents} />
          </>
        ) : null}
        {camMsg ? <Card><Text>{camMsg}</Text></Card> : null}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "camPrompt") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="📷 Camera access" subtitle="Only during the exam" color={colors.danger} />
        {camState === "permanently_denied" ? (
          <Card accent={colors.danger}>
            <Text style={{ ...type.body, fontWeight: "800" }}>Camera is blocked in system settings.</Text>
            <Text style={{ ...type.small, color: colors.muted }}>Without it you cannot start a proctored exam. Ask your teacher for an unproctored alternative.</Text>
            <Btn title="Open app settings" onPress={() => { logPerm(userId, "camera", "permanently_denied", "settings_opened"); openSysSettings(); }} />
            <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
          </Card>
        ) : (
          <PrePrompt
            icon="📷"
            title="Allow camera during exams?"
            what="The front camera stays on while a proctored exam runs, with a red ● indicator on screen."
            why="Short snapshots are saved only when the system raises a flag (no face, extra face, head turned). A teacher reviews flags later."
            whenOn="Only between exam start and exam end. Off the moment you finish or leave the app."
            notDo="No continuous video. No audio, ever. No camera use outside exams."
            onContinue={doCamEnable}
            onLater={() => setScreen("home")}
          />
        )}
        {camMsg ? <Card><Text>{camMsg}</Text></Card> : null}
        {camState === "denied_once" ? <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} /> : null}
      </Screen>
    );
  }

  if (screen === "proctorCheck") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="📷 Camera check" subtitle="Face visible? Light OK? Retry freely" color={colors.danger} />
        <Card>
          <CameraView style={{ height: 260, borderRadius: 12 }} facing="front" onCameraReady={() => setCamReady(true)} ref={cameraRef} />
        </Card>
        {!camReady ? <Text style={{ ...type.small, color: colors.muted }}>Starting camera…</Text> : null}
        <Btn title="My face is visible, lighting is OK — continue" onPress={() => { setProctorArmed(true); setScreen("mocksetup"); }} />
        <Btn title="Retry camera" variant="ghost" onPress={() => { setCamReady(false); doCamEnable(); }} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "privacy") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="🔒 Privacy & data" subtitle="What we collect and why" color={colors.text} />
        <Card>
          <Text style={{ ...type.body, fontWeight: "800" }}>We collect the minimum:</Text>
          <Text style={{ ...type.small }}>• Account email + study activity (quizzes, progress, plans).{"\n"}• Device push token (only if you allow reminders).{"\n"}• Exam snapshots ONLY on proctor flags — never video, never audio.{"\n"}• Anonymous event counts (e.g. permission allowed/blocked) to fix stuck screens.</Text>
        </Card>
        <Card>
          <Text style={{ ...type.body, fontWeight: "800" }}>Camera snapshots</Text>
          <Text style={{ ...type.small }}>Short photos on flags only. Reviewers at your school can see them. Auto-deleted 30 days after results are final.</Text>
        </Card>
        <Card>
          <Text style={{ ...type.small }}>Data controller: Odetunde Olumide, odetundeolumide94@gmail.com. Ask for a copy, correction, or deletion any time.</Text>
        </Card>
        <SectionTitle>Request deletion</SectionTitle>
        <Field label="Reason (optional)" value={delReason} onChangeText={setDelReason} placeholder="Why are you leaving?" />
        <Btn title="Request deletion of my data" onPress={submitDeletion} />
        {delMsg ? <Card accent={colors.success}><Text>{delMsg}</Text></Card> : null}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "feedback") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title="💬 Send feedback" subtitle="Testing round — tell us what breaks" color={colors.warning} />
        <SectionTitle>What kind of note is this?</SectionTitle>
        {["bug", "idea", "praise"].map((t) => (
          <Btn key={t} title={`${fbType === t ? "● " : "○ "}${t === "bug" ? "🐞 Something broke" : t === "idea" ? "💡 Idea / request" : "🎉 Praise"}`} variant={fbType === t ? "primary" : "ghost"} onPress={() => setFbType(t)} />
        ))}
        <Field label="Your note" value={fbText} onChangeText={setFbText} placeholder="What happened? What were you doing?" />
        <Btn title="Send" onPress={submitFeedback} />
        {fbMsg ? <Card accent={colors.success}><Text>{fbMsg}</Text></Card> : null}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "mocksetup") {
    const mockOptions = () => {
      if (!spec) return [];
      if (exam === "WAEC") {
        const per = spec.subjects || {};
        return topics.map((t) => {
          const s = per[t.subject] || per.default || { questions: 50, minutes: 60 };
          return { label: `${t.name} · ${s.questions}Q standard`, count: s.questions, minutes: s.minutes, topicId: t.id };
        });
      }
      const total = spec.total || { questions: 20, minutes: 30 };
      return [{ label: `Full paper · ${total.questions}Q in ${total.minutes} min`, count: total.questions, minutes: total.minutes, topicId: null }];
    };
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={`Mock — ${exam}`} subtitle="Standard counts · real timing" color={colors.danger} />
        {proctorArmed ? (
          <Card accent={colors.danger}>
            <Text style={{ fontWeight: "800" }}>🛡 Proctored — camera stays on, flags go to teacher review. Never auto-fails.</Text>
          </Card>
        ) : null}
        {mockOptions().map((o) => (
          <MenuRow key={o.label} icon="📝" title={o.label} subtitle={`${o.minutes} min on the clock`} color={colors.danger} onPress={() => startMock(o.label, o.count, o.minutes, o.topicId)} />
        ))}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        {msg ? <Card accent={colors.danger}><Text style={{ color: colors.danger }}>{msg}</Text></Card> : null}
      </Screen>
    );
  }

  if (screen === "mockrun" && mq[mqi]) {
    const q = mq[mqi];
    const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    const mm = String(Math.floor(msecs / 60)).padStart(2, "0");
    const ss = String(msecs % 60).padStart(2, "0");
    return (
      <Screen>
        <PageHeader title={mockLabel} subtitle={`Q${mqi + 1}/${mq.length}`} color={colors.danger} />
        {repeatNote ? <Text style={{ ...type.small, color: colors.muted }}>{repeatNote}</Text> : null}
        {proctor ? (
          <Card accent={colors.danger}>
            <Text style={{ fontWeight: "800", color: colors.danger }}>● REC — camera on, proctored</Text>
            <Text style={{ ...type.small, color: colors.muted }}>Flags go to teacher review only. This exam cannot end itself.</Text>
            <CameraView style={{ height: 140, borderRadius: 12, marginTop: spacing.sm }} facing="front" ref={cameraRef} />
          </Card>
        ) : null}
        <TimerPill label={`${mm}:${ss}`} />
        <ProgressBar value={mqi / mq.length} color={colors.danger} />
        <HoverCard>
          <Text style={{ fontSize: 17, fontWeight: "700", lineHeight: 24 }}>{q.stem}</Text>
        </HoverCard>
        {opts.map((o, i) => (
          <Btn key={i} title={o} variant="ghost" onPress={() => answerMock(i)} />
        ))}
        <Btn title="⏸ Pause & continue later" variant="ghost" onPress={pauseMock} />
      </Screen>
    );
  }

  if (screen === "mockresult") {
    const score = mans.filter((a) => a.correct).length;
    const delta = mprev ? score / mans.length - mprev.score / Math.max(mprev.total, 1) : null;
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={`Mock: ${score}/${mans.length}`} subtitle={mprev ? "vs your last mock" : "Baseline set — beat it next time"} color={mprev && delta >= 0 ? colors.success : colors.danger} />
        {mprev ? (
          <HoverCard accent={delta >= 0 ? colors.success : colors.danger}>
            <Text style={{ ...type.small, color: colors.muted }}>Previous: {mprev.score}/{mprev.total} ({mprev.label})</Text>
            <Text style={{ ...type.h1, color: delta >= 0 ? colors.success : colors.danger }}>
              {delta >= 0 ? "▲ improving" : "▼ slipped"} ({(delta * 100).toFixed(0)} pts)
            </Text>
          </HoverCard>
        ) : <EmptyState icon="📝" text="First mock — this is your baseline." />}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "progress") {
    return (
      <Screen fab={tutorFab}>
        <PageHeader title={`Progress — ${exam}`} subtitle="Per-topic averages across all attempts" color={colors.success} />
        {dash.progress.length === 0 ? <EmptyState icon="📈" text="No attempts yet. Take the diagnostic first." /> : null}
        {dash.progress.map((p) => (
          <HoverCard key={p.topic_id}>
            <Text style={{ fontWeight: "800", fontSize: 15 }}>{p.name}</Text>
            <Text style={{ ...type.small, color: colors.muted }}>{p.attempts} tries · avg {(p.avg * 100).toFixed(0)}%</Text>
            <ProgressBar value={p.avg} color={p.avg >= 0.6 ? colors.success : colors.danger} />
          </HoverCard>
        ))}
        <SectionTitle>Mock history</SectionTitle>
        {dash.mocks.length === 0 ? <Text style={{ ...type.small, color: colors.muted }}>No mocks yet.</Text> : null}
        {dash.mocks.map((m) => (
          <Text key={m.id} style={{ ...type.small }}>• {m.label}: {m.score}/{m.total}</Text>
        ))}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "settings") {
    return <SettingsScreen api={API_URL} userId={userId} exam={exam} dash={dash} onSaved={() => setScreen("home")} onBattery={() => setScreen("battery")} onSignOut={() => { setScreen("home"); signOut(); }} />;
  }

  const daysLeft = (() => {
    if (!dash.eprog.exam_date) return null;
    return Math.ceil((new Date(dash.eprog.exam_date) - new Date()) / 86400000);
  })();
  const countdownText = daysLeft === null ? null : daysLeft < 0
    ? "📅 Exam date passed — update it in Settings"
    : `⏳ ${daysLeft} days to exam${dash.eprog.target ? ` · target ${dash.eprog.target}` : ""}`;
  const weakNote = dash.plan[0] ? topics.find((t) => t.id === dash.plan[0].topic_id) : null;

  return (
    <Screen fab={tutorFab}>
      <PageHeader title={`👋 ${exam}${exam === "WAEC" && dept ? ` · ${dept}` : ""}`} subtitle={countdownText || "Pick a drill below to keep improving"} color={colors.success} />
      {offlineMode ? <Badge label="OFFLINE MODE" color={colors.text} /> : null}
      {msg ? <Card accent={colors.primary}><Text>{msg}</Text></Card> : null}

      {draft ? (
        <HoverCard accent={colors.primary} onPress={resumeDraft}>
          <Text style={{ fontWeight: "800", fontSize: 15 }}>▶ Continue where you left off</Text>
          <Text style={{ ...type.small, color: colors.muted }}>Resume your paused {draft.kind === "mock" ? "mock" : draft.kind} ›</Text>
        </HoverCard>
      ) : null}

      <SectionTitle>Start</SectionTitle>
      <MenuRow icon="🎯" title="Diagnostic test" subtitle="15Q adaptive · find your level" color={colors.tutor} onPress={startDiagnostic} />
      <MenuRow icon="📝" title="Full mock exam" subtitle="Standard counts · real timing" color={colors.danger} onPress={() => setScreen("mocksetup")} />
      <MenuRow icon="📈" title="My progress" subtitle="Per-topic trends + mock history" color={colors.success} onPress={() => setScreen("progress")} />
      <MenuRow icon="💬" title="Send feedback" subtitle="Testing round — bugs, ideas, praise" color={colors.warning} onPress={() => { setFbMsg(""); setScreen("feedback"); }} />
      <MenuRow icon="🔔" title="My reminders" subtitle="Study plans + push setup" color={colors.warning} onPress={loadMyReminders} />

      {dash.plan.length > 0 ? (
        <HoverCard accent={colors.success}>
          <Text style={{ fontWeight: "800", fontSize: 15 }}>This week 🎯 — fix weakest</Text>
          {dash.plan.map((p) => <Text key={p.topic_id} style={{ ...type.small }}>• {p.name} ×{p.drills} drills</Text>)}
        </HoverCard>
      ) : null}

      <SectionTitle>Help & community</SectionTitle>
      <MenuRow icon="✨" title="Ask AI tutor" subtitle="Knows your weak topics" color={colors.tutor} onPress={() => openTutor(null)} />
      <MenuRow icon="💬" title="Community Q&A" subtitle="Ask peers · leaderboard inside" color={colors.warning} onPress={loadPosts} />
      <MenuRow icon="📖" title="Syllabus & progress" subtitle="Departments · subjects · topic checklist" color={colors.success} onPress={loadCurrDepts} />
      <MenuRow icon="🛡" title="Proctored exam" subtitle="Consent + camera monitored mock" color={colors.danger} onPress={openProctored} />
      <MenuRow icon="🔒" title="Privacy & data" subtitle="Notice + deletion request" color={colors.text} onPress={() => { setDelMsg(""); setScreen("privacy"); }} />
      {weakNote ? <MenuRow icon="📘" title={`Notes: ${weakNote.name}`} subtitle="Your weakest topic" color={colors.secondary} onPress={() => openNotes(weakNote)} /> : null}

      {dash.badges.length > 0 ? (
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginVertical: spacing.xs }}>
          {dash.badges.map((b) => <Badge key={b} label={b} />)}
        </View>
      ) : null}
      {dash.prefs.reminder_time ? <Text style={{ ...type.small, color: colors.muted }}>🔔 Reminder at {dash.prefs.reminder_time} ✓</Text> : null}

      <SectionTitle>Practice by topic</SectionTitle>
      {topics.map((t) => (
        <MenuRow key={t.id} icon="📖" title={t.name} subtitle={t.subject} color={colors.primary} onPress={() => startPractice(t)} />
      ))}

      <SectionTitle>Offline</SectionTitle>
      <MenuRow icon="⬇" title="Download pack" subtitle="Questions + notes for offline" color={colors.text} onPress={downloadPack} />
      {pending > 0 ? <MenuRow icon="⬆" title={`Sync ${pending} result${pending > 1 ? "s" : ""}`} subtitle="Waiting on device" color={colors.text} onPress={syncNow} /> : null}
      <MenuRow icon="🔄" title="Switch exam" subtitle={`Now: ${exam}`} color={colors.muted} onPress={() => setScreen("exams")} />
      {exam === "WAEC" ? <MenuRow icon="🏫" title="Switch department" subtitle={`Now: ${dept || "none"}`} color={colors.muted} onPress={() => pickExam("WAEC")} /> : null}
      <MenuRow icon="⚙" title="Settings" subtitle="Exam date · target · reminder" color={colors.muted} onPress={() => setScreen("settings")} />
      <MenuRow icon="🎨" title="Design system" subtitle="Tokens + components" color={colors.muted} onPress={() => setScreen("design")} />
    </Screen>
  );
}

function SettingsScreen({ api, userId, exam, dash, onSaved, onSignOut, onBattery }) {
  const [examDate, setExamDate] = useState(dash.eprog.exam_date || "");
  const [target, setTarget] = useState(dash.eprog.target || "");
  const [rem, setRem] = useState(dash.prefs.reminder_time || "");
  const [optIn, setOptIn] = useState(dash.prefs.notify_opt_in !== false);
  const [days, setDays] = useState(dash.prefs.days || "");
  const [quiet, setQuiet] = useState(
    dash.prefs.quiet_start && dash.prefs.quiet_end ? `${dash.prefs.quiet_start}-${dash.prefs.quiet_end}` : ""
  );
  const [msg, setMsg] = useState("");
  const save = async () => {
    await fetch(`${api}/exam-progress`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, exam_code: exam, exam_date: examDate || null, target }),
    });
    const [qs, qe] = quiet.split("-").map((s) => (s || "").trim());
    await fetch(`${api}/prefs`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, reminder_time: rem, notify_opt_in: optIn, days, quiet_start: qs || "", quiet_end: qe || "" }),
    });
    setMsg("Saved ✓");
    onSaved();
  };
  return (
    <Screen>
      <PageHeader title="⚙ Settings" subtitle="Exam date · target · reminder" color={colors.text} />
      <Field label="Exam date (YYYY-MM-DD, optional)" value={examDate} onChangeText={setExamDate} placeholder="2026-11-01" />
      <Field label="Target score / grade (optional)" value={target} onChangeText={setTarget} placeholder="A1 / 1300 / 320" />
      <Field label="Daily reminder time (HH:MM, optional)" value={rem} onChangeText={setRem} placeholder="18:00" />
      <Btn title={optIn ? "Reminders: ON (tap to turn off)" : "Reminders: OFF (tap to turn on)"} variant="ghost" onPress={() => setOptIn(!optIn)} />
      <Field label="Days (optional, e.g. Mon,Wed,Fri)" value={days} onChangeText={setDays} placeholder="Mon,Wed,Fri" />
      <Field label="Quiet hours (optional, e.g. 22:00-06:00)" value={quiet} onChangeText={setQuiet} placeholder="22:00-06:00" />
      <Btn title="Save" onPress={save} />
      <Btn title="🔋 Battery tips" variant="ghost" onPress={onBattery} />
      <Btn title="← Back home" variant="ghost" onPress={onSaved} />
      {msg ? <Card accent={colors.success}><Text>{msg}</Text></Card> : null}
      <SectionTitle>Account</SectionTitle>
      <MenuRow icon="🚪" title="Sign out" subtitle={userId || ""} color={colors.danger} onPress={onSignOut} />
    </Screen>
  );
}
