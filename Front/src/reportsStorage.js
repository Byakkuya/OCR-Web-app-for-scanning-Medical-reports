const STORAGE_KEY = 'doctor_reports_v1';
const PATIENTS_KEY = 'patient_registry_v1';

const slug = (text) =>
  String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildPatientRef = (patient) => {
  const idValue = String(patient?.patientId || '').trim();
  if (idValue) return `pid:${slug(idValue)}`;
  return `name:${slug(patient?.name)}|${slug(patient?.age)}|${slug(patient?.gender)}`;
};

const normalizeReport = (report) => {
  const summary = report.analysisSummary || {};
  const patient = {
    patientId: '',
    complaint: '',
    ...report.patient
  };
  const patientRef = report.patientRef || buildPatientRef(patient);
  return {
    ...report,
    patientRef,
    doctorDecision: report.doctorDecision || 'pending',
    doctorNote: report.doctorNote || '',
    patient,
    scanContext: {
      source: 'manual',
      fileName: '',
      importedAt: null,
      imageDataUrl: null,
      ...report.scanContext
    },
    analysisSummary: {
      totalMarkers: summary.totalMarkers || 0,
      abnormalCount: summary.abnormalCount || 0,
      hasCritical: Boolean(summary.hasCritical),
      abnormalMarkers: Array.isArray(summary.abnormalMarkers) ? summary.abnormalMarkers : [],
      triagePriority: summary.triagePriority || 'low',
      isExistingPatient: Boolean(summary.isExistingPatient),
      previousReportsCount: summary.previousReportsCount || 0
    },
    previousReportIds: Array.isArray(report.previousReportIds) ? report.previousReportIds : [],
    workflowHistory: Array.isArray(report.workflowHistory) ? report.workflowHistory : []
  };
};

const normalizePatientProfile = (profile) => {
  const normalized = {
    patientId: '',
    name: '',
    age: '',
    weight: '',
    height: '',
    complaint: '',
    gender: 'male',
    lastSeenAt: null,
    ...profile
  };
  return {
    ...normalized,
    patientRef: normalized.patientRef || buildPatientRef(normalized)
  };
};

export const loadDoctorReports = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeReport) : [];
  } catch {
    return [];
  }
};

export const loadPatientProfiles = () => {
  try {
    const raw = localStorage.getItem(PATIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizePatientProfile) : [];
  } catch {
    return [];
  }
};

export const savePatientProfiles = (profiles) => {
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(profiles));
};

export const upsertPatientProfile = (profile) => {
  const normalized = normalizePatientProfile(profile);
  const profiles = loadPatientProfiles();
  const existingIndex = profiles.findIndex((item) => item.patientRef === normalized.patientRef);

  if (existingIndex >= 0) {
    profiles[existingIndex] = {
      ...profiles[existingIndex],
      ...normalized,
      lastSeenAt: new Date().toISOString()
    };
  } else {
    profiles.unshift({
      ...normalized,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });
  }

  savePatientProfiles(profiles);
  return normalized;
};

export const searchPatientProfiles = (term) => {
  const normalizedTerm = String(term || '').trim().toLowerCase();
  const profiles = loadPatientProfiles();
  if (!normalizedTerm) return profiles.slice(0, 10);

  return profiles
    .filter((profile) =>
      [profile.patientId, profile.name, profile.age, profile.complaint]
        .join(' ')
        .toLowerCase()
        .includes(normalizedTerm)
    )
    .slice(0, 10);
};

export const getReportsByPatientRef = (patientRef) => {
  return loadDoctorReports().filter((report) => report.patientRef === patientRef);
};

export const saveDoctorReports = (reports) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
};

export const addDoctorReport = (report) => {
  const reports = loadDoctorReports();
  const normalized = normalizeReport(report);
  const previous = reports.filter((item) => item.patientRef === normalized.patientRef);

  const enriched = {
    ...normalized,
    previousReportIds: previous.map((item) => item.id),
    analysisSummary: {
      ...normalized.analysisSummary,
      isExistingPatient: previous.length > 0,
      previousReportsCount: previous.length
    }
  };

  saveDoctorReports([enriched, ...reports]);
  upsertPatientProfile(enriched.patient);
  return enriched;
};

export const updateDoctorReportDecision = (reportId, decision, doctorNote = '', reviewer = 'Dr. utilisateur') => {
  const reports = loadDoctorReports();
  const updated = reports.map((report) => {
    if (report.id !== reportId) return report;
    const eventLabel = decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'set_pending';
    return {
      ...report,
      doctorDecision: decision,
      doctorNote,
      reviewedAt: decision === 'pending' ? null : new Date().toISOString(),
      reviewedBy: reviewer,
      workflowHistory: [
        ...(report.workflowHistory || []),
        {
          type: eventLabel,
          at: new Date().toISOString(),
          actor: reviewer,
          note: doctorNote
        }
      ]
    };
  });
  saveDoctorReports(updated);
  return updated;
};
