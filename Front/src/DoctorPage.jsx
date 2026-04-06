import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  CircleX,
  Clock3,
  FileText,
  Image,
  Search,
  ShieldAlert,
  Stethoscope,
  UserRound,
  XCircle
} from 'lucide-react';
import { loadDoctorReports, updateDoctorReportDecision } from './reportsStorage';

const getDecisionBadge = (decision) => {
  if (decision === 'approved') return 'bg-green-100 text-green-700 border-green-200';
  if (decision === 'rejected') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-yellow-100 text-yellow-700 border-yellow-200';
};

const getDecisionLabel = (decision) => {
  if (decision === 'approved') return 'Approuve';
  if (decision === 'rejected') return 'Rejete';
  return 'En attente';
};

const getPriorityBadge = (priority) => {
  if (priority === 'critical') return 'bg-red-100 text-red-700 border-red-200';
  if (priority === 'high') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (priority === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
};

const getPriorityLabel = (priority) => {
  if (priority === 'critical') return 'Critique';
  if (priority === 'high') return 'Eleve';
  if (priority === 'medium') return 'Moyen';
  return 'Faible';
};

const getMarkerStateClass = (status) => {
  if (status === 'high') return 'border-red-200 bg-red-50';
  if (status === 'low') return 'border-blue-200 bg-blue-50';
  return 'border-slate-200 bg-slate-50';
};

const DoctorPage = () => {
  const [reports, setReports] = useState(() => loadDoctorReports());
  const [selectedReportId, setSelectedReportId] = useState(reports[0]?.id || null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [doctorName, setDoctorName] = useState('Dr. Clinique');
  const [noteDraft, setNoteDraft] = useState('');

  const dashboardStats = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((report) => report.doctorDecision === 'pending').length,
      approved: reports.filter((report) => report.doctorDecision === 'approved').length,
      rejected: reports.filter((report) => report.doctorDecision === 'rejected').length,
      critical: reports.filter((report) => report.analysisSummary?.hasCritical).length
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const statusOk = statusFilter === 'all' ? true : report.doctorDecision === statusFilter;
      const searchOk = !normalizedSearch
        ? true
        : [
            report.patient?.name || '',
            report.patient?.patientId || '',
            report.patient?.complaint || '',
            report.analysisSummary?.abnormalMarkers?.join(' ') || ''
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);

      return statusOk && searchOk;
    });
  }, [reports, statusFilter, searchTerm]);

  useEffect(() => {
    if (!filteredReports.length) {
      setSelectedReportId(null);
      return;
    }
    const stillExists = filteredReports.some((report) => report.id === selectedReportId);
    if (!stillExists) {
      setSelectedReportId(filteredReports[0].id);
    }
  }, [filteredReports, selectedReportId]);

  const selectedReport = useMemo(
    () => filteredReports.find((report) => report.id === selectedReportId) || null,
    [filteredReports, selectedReportId]
  );

  const reportsByPatientRef = useMemo(() => {
    const map = new Map();
    reports.forEach((report) => {
      const key = report.patientRef || `fallback-${report.id}`;
      const current = map.get(key) || [];
      current.push(report);
      map.set(key, current);
    });
    return map;
  }, [reports]);

  const previousReports = useMemo(() => {
    if (!selectedReport?.patientRef) return [];
    return (reportsByPatientRef.get(selectedReport.patientRef) || [])
      .filter((item) => item.id !== selectedReport.id)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [reportsByPatientRef, selectedReport]);

  useEffect(() => {
    setNoteDraft(selectedReport?.doctorNote || '');
  }, [selectedReport]);

  const handleDecision = (decision) => {
    if (!selectedReport) return;
    const reviewer = doctorName.trim() || 'Dr. Clinique';
    const updated = updateDoctorReportDecision(selectedReport.id, decision, noteDraft, reviewer);
    setReports(updated);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50 to-slate-100">
      <header className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tableau Medecin - Clinique</h1>
            <p className="text-sm text-slate-600">Validation des rapports OCR et triage des patients</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nom du medecin"
            />
            <Link
              to="/"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-700"
            >
              Retour Scanner
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total rapports</p>
            <p className="text-2xl font-bold text-slate-900">{dashboardStats.total}</p>
          </div>
          <div className="rounded-xl bg-white border border-yellow-200 p-4">
            <p className="text-xs text-yellow-700">En attente</p>
            <p className="text-2xl font-bold text-yellow-800">{dashboardStats.pending}</p>
          </div>
          <div className="rounded-xl bg-white border border-green-200 p-4">
            <p className="text-xs text-green-700">Approuves</p>
            <p className="text-2xl font-bold text-green-800">{dashboardStats.approved}</p>
          </div>
          <div className="rounded-xl bg-white border border-red-200 p-4">
            <p className="text-xs text-red-700">Rejetes</p>
            <p className="text-2xl font-bold text-red-800">{dashboardStats.rejected}</p>
          </div>
          <div className="rounded-xl bg-white border border-orange-200 p-4">
            <p className="text-xs text-orange-700">Critiques</p>
            <p className="text-2xl font-bold text-orange-800">{dashboardStats.critical}</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-1 bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800">File patients ({filteredReports.length})</h2>
            </div>

            <div className="space-y-3 mb-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher nom, ID ou motif"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setStatusFilter('all')} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${statusFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}>Tous</button>
                <button onClick={() => setStatusFilter('pending')} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${statusFilter === 'pending' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-slate-700 border-slate-300'}`}>En attente</button>
                <button onClick={() => setStatusFilter('approved')} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${statusFilter === 'approved' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-700 border-slate-300'}`}>Approuves</button>
                <button onClick={() => setStatusFilter('rejected')} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${statusFilter === 'rejected' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-300'}`}>Rejetes</button>
              </div>
            </div>

            <div className="space-y-3 max-h-[62vh] overflow-auto pr-1">
              {filteredReports.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                  Aucun rapport pour ce filtre.
                </div>
              )}
              {filteredReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    selectedReportId === report.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <p className="font-semibold text-slate-800 truncate">{report.patient.name || 'Patient inconnu'}</p>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getDecisionBadge(report.doctorDecision)}`}>
                      {getDecisionLabel(report.doctorDecision)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>ID: {report.patient.patientId || '-'}</span>
                    <span className={`px-2 py-0.5 rounded-full border ${getPriorityBadge(report.analysisSummary?.triagePriority)}`}>
                      {getPriorityLabel(report.analysisSummary?.triagePriority)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {report.analysisSummary?.isExistingPatient ? `Patient suivi (${report.analysisSummary.previousReportsCount} scan(s) precedent(s))` : 'Nouveau patient'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Envoye: {new Date(report.sentAt).toLocaleString('fr-FR')}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2 bg-white rounded-2xl shadow p-6">
            {!selectedReport ? (
              <div className="h-full min-h-[360px] flex items-center justify-center text-slate-500">
                Selectionnez un patient pour voir les details.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedReport.patient.name || 'Patient inconnu'}</h2>
                    <p className="text-sm text-slate-600">
                      ID: {selectedReport.patient.patientId || '-'} | Age: {selectedReport.patient.age || '-'} | Sexe: {selectedReport.patient.gender === 'female' ? 'Femme' : 'Homme'}
                    </p>
                    <p className="text-sm text-slate-600">Poids: {selectedReport.patient.weight || '-'} kg | Taille: {selectedReport.patient.height || '-'} cm</p>
                    <p className="text-sm text-slate-600">Statut dossier: {selectedReport.analysisSummary?.isExistingPatient ? 'Patient existant' : 'Nouveau patient'}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className={`text-sm px-3 py-1 rounded-full border ${getDecisionBadge(selectedReport.doctorDecision)}`}>
                      {getDecisionLabel(selectedReport.doctorDecision)}
                    </span>
                    <span className={`text-sm px-3 py-1 rounded-full border ${getPriorityBadge(selectedReport.analysisSummary?.triagePriority)}`}>
                      Priorite: {getPriorityLabel(selectedReport.analysisSummary?.triagePriority)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">
                  <p className="font-semibold mb-1">Contexte clinique</p>
                  <p>Motif: {selectedReport.patient.complaint || 'Non renseigne'}</p>
                  <p>Source: {selectedReport.scanContext?.source === 'ocr-image' ? 'Image OCR' : 'Saisie manuelle'}{selectedReport.scanContext?.fileName ? ` | ${selectedReport.scanContext.fileName}` : ''}</p>
                </div>

                {selectedReport.scanContext?.imageDataUrl && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <Image className="w-4 h-4" />
                      Image importee
                    </div>
                    <img
                      src={selectedReport.scanContext.imageDataUrl}
                      alt="Scan importe"
                      className="w-full max-h-72 object-contain rounded-lg border border-slate-200"
                    />
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-slate-500">Total marqueurs</p>
                    <p className="font-bold text-slate-900">{selectedReport.analysisSummary.totalMarkers}</p>
                  </div>
                  <div className="rounded-xl border border-red-200 p-4 bg-red-50">
                    <p className="text-red-600">Anormaux</p>
                    <p className="font-bold text-red-700">{selectedReport.analysisSummary.abnormalCount}</p>
                  </div>
                  <div className="rounded-xl border border-yellow-200 p-4 bg-yellow-50">
                    <p className="text-yellow-700">Etat critique</p>
                    <p className="font-bold text-yellow-800">{selectedReport.analysisSummary.hasCritical ? 'Oui' : 'Non'}</p>
                  </div>
                </div>

                {!!selectedReport.analysisSummary?.abnormalMarkers?.length && (
                  <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                    <div className="flex items-center gap-2 font-semibold mb-1"><ShieldAlert className="w-4 h-4" /> Marqueurs anormaux</div>
                    <p>{selectedReport.analysisSummary.abnormalMarkers.join(', ')}</p>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedReport.electrolytesTable.map((row) => (
                    <div key={row.key} className={`rounded-lg border p-3 ${getMarkerStateClass(row.status)}`}>
                      <p className="font-semibold text-slate-800">{row.label}</p>
                      <p className="text-sm text-slate-600">Valeur: {row.value || '-'} {row.unit}</p>
                      <p className="text-sm text-slate-600">Reference: {row.referenceMin} - {row.referenceMax}</p>
                      <p className="text-sm text-slate-700 mt-1">{row.message}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2 text-slate-700 font-semibold"><Stethoscope className="w-4 h-4" /> Note du medecin</div>
                  <textarea
                    rows={3}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ecrire la conduite a tenir, examens complementaires, plan de prise en charge..."
                  />
                </div>

                {previousReports.length > 0 && (
                  <div className="mt-6 rounded-xl border border-slate-200 p-4 bg-white">
                    <p className="text-sm font-semibold text-slate-800 mb-2">Scans precedents du patient</p>
                    <div className="space-y-2">
                      {previousReports.map((report) => (
                        <button
                          key={report.id}
                          onClick={() => setSelectedReportId(report.id)}
                          className="w-full text-left rounded-lg border border-slate-200 hover:border-indigo-300 px-3 py-2"
                        >
                          <p className="text-sm text-slate-800">{new Date(report.sentAt).toLocaleString('fr-FR')}</p>
                          <p className="text-xs text-slate-500">Statut: {getDecisionLabel(report.doctorDecision)} | Anormaux: {report.analysisSummary?.abnormalCount ?? 0}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleDecision('approved')}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approuver
                  </button>
                  <button
                    onClick={() => handleDecision('rejected')}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700"
                  >
                    <CircleX className="w-4 h-4" />
                    Rejeter
                  </button>
                  <button
                    onClick={() => handleDecision('pending')}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-2 text-white font-semibold hover:bg-slate-700"
                  >
                    <XCircle className="w-4 h-4" />
                    Remettre en attente
                  </button>
                </div>

                <div className="mt-6 border-t pt-4 text-xs text-slate-500 space-y-2">
                  <div className="flex flex-wrap gap-4">
                    <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> Envoye: {new Date(selectedReport.sentAt).toLocaleString('fr-FR')}</span>
                    <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> ID rapport: {selectedReport.id}</span>
                    <span className="inline-flex items-center gap-1"><UserRound className="w-3 h-3" /> Revise: {selectedReport.reviewedAt ? new Date(selectedReport.reviewedAt).toLocaleString('fr-FR') : '-'}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="font-semibold text-slate-700 mb-1">Historique workflow</p>
                    <div className="space-y-1">
                      {(selectedReport.workflowHistory || []).slice().reverse().map((event, index) => (
                        <p key={`${event.at}-${index}`}>{new Date(event.at).toLocaleString('fr-FR')} | {event.actor} | {event.type}{event.note ? ` | ${event.note}` : ''}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default DoctorPage;
