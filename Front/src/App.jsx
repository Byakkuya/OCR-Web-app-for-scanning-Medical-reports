import React, { useState, useRef, useEffect } from 'react';
import { Activity, Thermometer, Droplets, Zap, Heart, AlertTriangle, TrendingUp, TrendingDown, Minus, Plus, Download, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addDoctorReport, searchPatientProfiles } from './reportsStorage';

const App = () => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  const [patientData, setPatientData] = useState({
    patientId: '',
    name: '',
    age: '',
    weight: '',
    height: '',
    complaint: '',
    gender: 'male'
  });

  const [electrolytes, setElectrolytes] = useState({
    sodium: '',
    potassium: '',
    calcium: '',
    magnesium: '',
    chloride: '',
    phosphate: '',
    bicarbonate: ''
  });

  const [analysisResult, setAnalysisResult] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [doctorSendMessage, setDoctorSendMessage] = useState('');
  const [patientLookup, setPatientLookup] = useState('');
  const [patientMatches, setPatientMatches] = useState([]);
  const [scanContext, setScanContext] = useState({
    source: 'manual',
    fileName: '',
    importedAt: null,
    imageDataUrl: null
  });
  const audioContextRef = useRef(null);
  const hasPlayedSoundRef = useRef(false);
  const fileInputRef = useRef(null);

  // Fonction pour jouer un son d'alerte
  const playAlertSound = (type = 'critical') => {
    if (!hasPlayedSoundRef.current) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === 'critical') {
        oscillator.frequency.setValueAtTime(800, ctx.currentTime);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      } else {
        oscillator.frequency.setValueAtTime(500, ctx.currentTime);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      }
    } catch (error) {
      console.warn("Impossible de jouer le son d'alerte :", error);
    }
  };

  const referenceRanges = {
    sodium: { normal: [135, 145], unit: 'mmol/L' },
    potassium: { normal: [3.5, 5.0], unit: 'mmol/L' },
    calcium: { normal: [8.5, 10.5], unit: 'mg/dL' },
    magnesium: { normal: [1.7, 2.2], unit: 'mg/dL' },
    chloride: { normal: [98, 106], unit: 'mmol/L' },
    phosphate: { normal: [2.5, 4.5], unit: 'mg/dL' },
    bicarbonate: { normal: [22, 29], unit: 'mmol/L' }
  };

  const getFrenchName = (electrolyte) => {
    const names = {
      sodium: 'Sodium',
      potassium: 'Potassium',
      calcium: 'Calcium',
      magnesium: 'Magnesium',
      chloride: 'Chlorure',
      phosphate: 'Phosphate',
      bicarbonate: 'Bicarbonate'
    };
    return names[electrolyte] || electrolyte;
  };

  const getInterpretation = (value, range, electrolyte) => {
    if (!value || isNaN(value)) return { status: 'unknown', message: 'Valeur non fournie', recommendations: [], isCritical: false };
    
    const numValue = parseFloat(value);
    const [min, max] = range.normal;
    
    if (numValue < min) {
      const recommendations = getRecommendations(electrolyte, numValue, 'low');
      const isCritical = (
        (electrolyte === 'sodium' && numValue < 120) ||
        (electrolyte === 'potassium' && numValue < 2.5) ||
        (electrolyte === 'calcium' && numValue < 7.0) ||
        (electrolyte === 'magnesium' && numValue < 1.2)
      );
      const severity = isCritical ? 'critical' : 'moderate';
      return {
        status: 'low',
        severity: severity,
        isCritical,
        message: `Hyp${electrolyte === 'sodium' ? 'onatriémie' : 
                 electrolyte === 'potassium' ? 'okaliémie' : 
                 electrolyte === 'calcium' ? 'ocalcémie' : 
                 electrolyte === 'magnesium' ? 'omagnésémie' : 
                 electrolyte === 'chloride' ? 'ochlorémie' : 
                 electrolyte === 'phosphate' ? 'ophosphatémie' : 
                 'obicarbonatémie'}`,
        recommendations
      };
    } else if (numValue > max) {
      const recommendations = getRecommendations(electrolyte, numValue, 'high');
      const isCritical = (
        (electrolyte === 'sodium' && numValue > 160) ||
        (electrolyte === 'potassium' && numValue >= 6.5) ||
        (electrolyte === 'calcium' && numValue > 13.0) ||
        (electrolyte === 'magnesium' && numValue > 2.5)
      );
      const severity = isCritical ? 'critical' : 'moderate';
      return {
        status: 'high',
        severity: severity,
        isCritical,
        message: `Hyper${electrolyte === 'sodium' ? 'natrémie' : 
                  electrolyte === 'potassium' ? 'kaliémie' : 
                  electrolyte === 'calcium' ? 'calcémie' : 
                  electrolyte === 'magnesium' ? 'magnésémie' : 
                  electrolyte === 'chloride' ? 'chlorémie' : 
                  electrolyte === 'phosphate' ? 'phosphatémie' : 
                  'bicarbonatémie'}`,
        recommendations
      };
    } else {
      return { status: 'normal', message: 'Niveaux normaux', recommendations: [], isCritical: false };
    }
  };

  const getRecommendations = (electrolyte, value, type) => {
    const recommendations = [];
    
    switch (electrolyte) {
      case 'sodium':
        if (type === 'low') {
          if (value < 120) {
            recommendations.push({
              type: 'emergency',
              title: '🚨 Urgence (Na < 120)',
              content: '→ Bolus de NaCl 3% : 100 mL en 10 min (max 3 fois)\n→ Correction ≤ 8 mmol/L / 24 h'
            });
          }
          recommendations.push({
            type: 'monitoring',
            title: '🔍 Surveillance',
            content: '→ Na toutes les 2–4 h\n→ Bilan hydrique + conscience'
          });
          recommendations.push({
            type: 'alert',
            title: '⚠️ Alerte',
            content: '→ Apparition confusion / convulsion = bolus 3%'
          });
        } else if (type === 'high') {
          if (value > 160) {
            recommendations.push({
              type: 'emergency',
              title: '🚨 Urgence (Na > 160)',
              content: '→ Correction lente : –10 mmol/L/24 h\n→ Donner eau libre (G5%)'
            });
          }
          recommendations.push({
            type: 'monitoring',
            title: '🔍 Surveillance',
            content: '→ Na toutes 4 h\n→ Diurèse'
          });
          recommendations.push({
            type: 'alert',
            title: '⚠️ Alerte',
            content: '→ Na qui baisse trop vite = risque œdème cérébral'
          });
        }
        break;
        
      case 'potassium':
        if (type === 'low') {
          if (value < 2.5) {
            recommendations.push({
              type: 'emergency',
              title: '🚨 Urgence (K < 2.5)',
              content: '→ KCl IV : 20–40 mmol dans NaCl 0.9%\n→ Vitesse max 10 mmol/h (20 mmol/h en réa sous scope)'
            });
          }
          recommendations.push({
            type: 'monitoring',
            title: '🔍 Surveillance',
            content: '→ ECG continu\n→ K toutes 4 h'
          });
          recommendations.push({
            type: 'alert',
            title: '⚠️ Alerte',
            content: '→ Onde U, tachycardie, extrasystoles'
          });
        } else if (type === 'high') {
          if (value >= 6.5) {
            recommendations.push({
              type: 'emergency',
              title: '🚨 Urgence (K ≥ 6.5)',
              content: 'Calcium gluconate 10% 10 mL IV (protection cœur)\nInsuline + glucose (10 U + 25 g G30%)\nSalbutamol nébulisé\nSi persistant → dialyse'
            });
          }
          recommendations.push({
            type: 'monitoring',
            title: '🔍 Surveillance',
            content: '→ ECG continu\n→ K 1–2 h après traitement'
          });
          recommendations.push({
            type: 'alert',
            title: '⚠️ Alerte',
            content: '→ Peaked T, QRS large, bradycardie'
          });
        }
        break;
        
      case 'calcium':
        if (type === 'low') {
          recommendations.push({
            type: 'emergency',
            title: '🚨 Urgence (symptômes)',
            content: '→ Gluconate de Ca 10% : 10–20 mL IV lent'
          });
          recommendations.push({
            type: 'monitoring',
            title: '🔍 Surveillance',
            content: '→ ECG\n→ Calcium ionisé toutes 4–6 h'
          });
          recommendations.push({
            type: 'alert',
            title: '⚠️ Alerte',
            content: '→ Spasmes, fourmillements, QT long'
          });
        } else if (type === 'high') {
          if (value > 13.0) {
            recommendations.push({
              type: 'emergency',
              title: '🚨 Urgence (Ca très élevé)',
              content: '→ Hydratation NaCl 0.9% (200–300 mL/h)\n→ Furosémide après réhydratation\n→ Calcitonine si besoin'
            });
          }
          recommendations.push({
            type: 'monitoring',
            title: '🔍 Surveillance',
            content: '→ Diurèse\n→ Calcium 2x/jour'
          });
        }
        break;
        
      case 'magnesium':
        if (type === 'low') {
          if (value < 1.2) {
            recommendations.push({
              type: 'emergency',
              title: '🚨 Urgence (Mg < 0.7)',
              content: '→ MgSO4 2 g IV en 10–20 min, puis perfusion'
            });
          }
          recommendations.push({
            type: 'monitoring',
            title: '🔍 Surveillance',
            content: '→ ECG\n→ Mg toutes 6–8 h'
          });
        } else if (type === 'high') {
          if (value > 2.5) {
            recommendations.push({
              type: 'emergency',
              title: '🚨 Urgence (Mg > 2)',
              content: '→ Arrêt Mg\n→ Calcium gluconate 10% 10 mL IV\n→ Hydratation ± dialyse'
            });
          }
          recommendations.push({
            type: 'monitoring',
            title: '🔍 Surveillance',
            content: '→ TA, fréquence, ECG\n→ Mg toutes 4 h'
          });
        }
        break;
        
      default:
        break;
    }
    
    return recommendations;
  };

  const analyzeElectrolytes = (inputElectrolytes = electrolytes) => {
    hasPlayedSoundRef.current = true;

    const results = {};
    let hasAbnormalities = false;
    let hasCritical = false;

    Object.keys(inputElectrolytes).forEach(electrolyte => {
      const interpretation = getInterpretation(inputElectrolytes[electrolyte], referenceRanges[electrolyte], electrolyte);
      results[electrolyte] = interpretation;
      if (interpretation.status !== 'normal') {
        hasAbnormalities = true;
        if (interpretation.isCritical) {
          hasCritical = true;
        }
      }
    });

    

    setTimeout(() => {
      if (hasCritical) {
        playAlertSound('critical');
      } else if (hasAbnormalities) {
        playAlertSound('moderate');
      }
    }, 100);

    setAnalysisResult({
      results,
      hasAbnormalities,
      hasCritical,
      timestamp: new Date().toLocaleString('fr-FR')
    });
  };

  const resetForm = () => {
    setPatientData({ patientId: '', name: '', age: '', weight: '', height: '', complaint: '', gender: 'male' });
    setElectrolytes({ sodium: '', potassium: '', calcium: '', magnesium: '', chloride: '', phosphate: '', bicarbonate: '' });
    setAnalysisResult(null);
    setUploadError('');
    setDoctorSendMessage('');
    setScanContext({ source: 'manual', fileName: '', importedAt: null, imageDataUrl: null });
    setPatientLookup('');
    setPatientMatches([]);
    hasPlayedSoundRef.current = false;
  };

  const getStatusLabel = (status) => {
    if (status === 'high') return 'Eleve';
    if (status === 'low') return 'Bas';
    if (status === 'normal') return 'Normal';
    return 'Non renseigne';
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Impossible de lire l image importee.'));
      reader.readAsDataURL(file);
    });

  const applyPatientProfile = (profile) => {
    setPatientData((prev) => ({
      ...prev,
      patientId: profile.patientId || prev.patientId,
      name: profile.name || prev.name,
      age: profile.age || prev.age,
      weight: profile.weight || prev.weight,
      height: profile.height || prev.height,
      complaint: profile.complaint || prev.complaint,
      gender: profile.gender || prev.gender
    }));
    setPatientLookup('');
    setPatientMatches([]);
  };

  const isPatientFormComplete = [
    patientData.patientId,
    patientData.name,
    patientData.age,
    patientData.weight,
    patientData.height,
    patientData.complaint,
    patientData.gender
  ].every((value) => String(value).trim() !== '');

  const isElectrolytesComplete = Object.values(electrolytes).every((value) => String(value).trim() !== '');
  const canSendToDoctor = isPatientFormComplete && isElectrolytesComplete;

  const buildDoctorReportPayload = () => {
    const analysis = analysisResult || (() => {
      const results = {};
      let hasCritical = false;

      Object.keys(referenceRanges).forEach((electrolyte) => {
        const interpretation = getInterpretation(electrolytes[electrolyte], referenceRanges[electrolyte], electrolyte);
        results[electrolyte] = interpretation;
        if (interpretation.isCritical) hasCritical = true;
      });

      return {
        results,
        hasCritical
      };
    })();

    const electrolytesTable = Object.keys(referenceRanges).map((key) => ({
      key,
      label: getFrenchName(key),
      value: electrolytes[key] || '',
      unit: referenceRanges[key].unit,
      referenceMin: referenceRanges[key].normal[0],
      referenceMax: referenceRanges[key].normal[1],
      message: analysis.results[key]?.message || 'Valeur non fournie',
      status: analysis.results[key]?.status || 'unknown'
    }));

    const abnormalMarkers = electrolytesTable
      .filter((row) => row.status === 'high' || row.status === 'low')
      .map((row) => row.label);
    const hasCritical = analysis.hasCritical;
    const abnormalCount = abnormalMarkers.length;
    const triagePriority = hasCritical ? 'critical' : abnormalCount >= 3 ? 'high' : abnormalCount > 0 ? 'medium' : 'low';

    return {
      id: `rep-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      sentAt: new Date().toISOString(),
      reviewedAt: null,
      doctorDecision: 'pending',
      doctorNote: '',
      patient: { ...patientData },
      electrolytes: { ...electrolytes },
      scanContext: { ...scanContext },
      electrolytesTable,
      analysisSummary: {
        totalMarkers: electrolytesTable.length,
        abnormalCount,
        hasCritical,
        abnormalMarkers,
        triagePriority
      },
      workflowHistory: [
        {
          type: 'sent_to_doctor',
          at: new Date().toISOString(),
          actor: 'scanner'
        }
      ]
    };
  };

  const sendToDoctor = () => {
    setDoctorSendMessage('');
    if (!canSendToDoctor) {
      setDoctorSendMessage('Veuillez remplir toutes les informations patient et tous les electrolytes avant envoi.');
      return;
    }

    const report = buildDoctorReportPayload();
    addDoctorReport(report);
    setDoctorSendMessage('Rapport envoye au medecin avec succes.');
  };

  const exportBilan = () => {
    const doc = new jsPDF();
    const generatedAt = new Date();
    const patientName = patientData.name?.trim() || 'Patient';

    const computedResults = {};
    Object.keys(referenceRanges).forEach((electrolyte) => {
      computedResults[electrolyte] = getInterpretation(
        electrolytes[electrolyte],
        referenceRanges[electrolyte],
        electrolyte
      );
    });

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Rapport d analyse des electrolytes', 14, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Genere le ${generatedAt.toLocaleString('fr-FR')}`, 14, 22);

    doc.setTextColor(33, 37, 41);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Informations patient', 14, 44);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nom: ${patientName}`, 14, 51);
    doc.text(`Age: ${patientData.age || '-'}`, 80, 51);
    doc.text(`Sexe: ${patientData.gender === 'female' ? 'Femme' : 'Homme'}`, 130, 51);
    doc.text(`Poids (kg): ${patientData.weight || '-'}`, 14, 58);
    doc.text(`Taille (cm): ${patientData.height || '-'}`, 80, 58);

    const tableRows = Object.keys(referenceRanges).map((electrolyte) => {
      const value = electrolytes[electrolyte];
      const interpretation = computedResults[electrolyte];
      const reference = referenceRanges[electrolyte];

      return [
        getFrenchName(electrolyte),
        value || '-',
        reference.unit,
        `${reference.normal[0]} - ${reference.normal[1]}`,
        getStatusLabel(interpretation.status),
        interpretation.message
      ];
    });

    autoTable(doc, {
      startY: 66,
      head: [['Marqueur', 'Valeur', 'Unite', 'Reference', 'Statut', 'Interpretation']],
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 247, 255]
      },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 73 }
      }
    });

    const recommendationLines = [];
    Object.keys(computedResults).forEach((electrolyte) => {
      const result = computedResults[electrolyte];
      if (!result?.recommendations?.length) return;
      recommendationLines.push(`${getFrenchName(electrolyte)}: ${result.message}`);
      result.recommendations.forEach((rec) => {
        recommendationLines.push(`- ${rec.title}: ${rec.content.replace(/\n/g, ' | ')}`);
      });
      recommendationLines.push('');
    });

    let y = (doc.lastAutoTable?.finalY || 66) + 10;
    if (recommendationLines.length > 0) {
      if (y > 245) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Recommandations cliniques', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const wrapped = doc.splitTextToSize(recommendationLines.join('\n'), 182);
      doc.text(wrapped, 14, y + 7);
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Rapport medical - Page ${i}/${pageCount}`, 14, 290);
    }

    doc.save(`rapport-electrolytes-${patientName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  const mapLabResultsToElectrolytes = (labResults = []) => {
    const nextElectrolytes = {
      sodium: '',
      potassium: '',
      calcium: '',
      magnesium: '',
      chloride: '',
      phosphate: '',
      bicarbonate: ''
    };

    const canonicalToField = {
      sodium: 'sodium',
      potassium: 'potassium',
      calcium: 'calcium',
      magnesium: 'magnesium',
      chloride: 'chloride',
      phosphorus: 'phosphate',
      bicarbonate: 'bicarbonate'
    };

    labResults.forEach((row) => {
      const canonicalName = row?.canonical_name;
      const mappedField = canonicalToField[canonicalName];
      if (!mappedField) return;
      if (row?.value === null || row?.value === undefined || Number.isNaN(Number(row.value))) return;
      nextElectrolytes[mappedField] = String(row.value);
    });

    return nextElectrolytes;
  };

  const importImageAndAnalyze = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Veuillez sélectionner une image (jpg, png, bmp, tiff, webp).');
      return;
    }

    setIsUploadingImage(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const imageDataUrl = await fileToDataUrl(file);

      const response = await fetch(`${API_BASE_URL}/ocr/lab-results`, {
        method: 'POST',
        body: formData
      });

      const payload = await response.json();

      if (!response.ok) {
        const errorMessage = payload?.detail || 'Échec de l’analyse OCR.';
        throw new Error(errorMessage);
      }

      const nextElectrolytes = mapLabResultsToElectrolytes(payload?.lab_results || []);
      const hasAtLeastOneValue = Object.values(nextElectrolytes).some((v) => v !== '');

      if (!hasAtLeastOneValue) {
        throw new Error('Aucune valeur d’électrolyte détectée dans ce document.');
      }

      setElectrolytes(nextElectrolytes);
      setPatientData((prev) => ({
        ...prev,
        name: payload?.patient_info?.patient_name || prev.name,
        age: payload?.patient_info?.age ? String(payload.patient_info.age) : prev.age,
        gender: payload?.patient_info?.gender?.toLowerCase().startsWith('f') ? 'female' : prev.gender
      }));
      setScanContext({
        source: 'ocr-image',
        fileName: file.name,
        importedAt: new Date().toISOString(),
        imageDataUrl
      });

      analyzeElectrolytes(nextElectrolytes);
    } catch (error) {
      console.error(error);
      setUploadError(error.message || 'Erreur pendant l’import de l’image.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    const matches = searchPatientProfiles(patientLookup);
    setPatientMatches(matches);
  }, [patientLookup]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // ... (composants restants inchangés)

  const ElectrolyteInput = ({ label, icon: Icon, value, onChange, unit, status }) => {
    const getStatusColor = () => {
      if (status === 'normal') return 'border-green-500 bg-green-50';
      if (status === 'low') return 'border-blue-500 bg-blue-50';
      if (status === 'high') return 'border-red-500 bg-red-50';
      return 'border-gray-300';
    };

    return (
      <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${getStatusColor()}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Icon className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{label}</h3>
            <p className="text-sm text-gray-600">{unit}</p>
          </div>
        </div>
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="0.0"
        />
      </div>
    );
  };

  const RecommendationItem = ({ recommendation }) => {
    const getBgColor = () => {
      switch (recommendation.type) {
        case 'emergency': return 'bg-red-50 border-red-200';
        case 'monitoring': return 'bg-blue-50 border-blue-200';
        case 'alert': return 'bg-yellow-50 border-yellow-200';
        default: return 'bg-gray-50 border-gray-200';
      }
    };

    const getIcon = () => {
      switch (recommendation.type) {
        case 'emergency': return <AlertTriangle className="w-4 h-4 text-red-600" />;
        case 'monitoring': return <Activity className="w-4 h-4 text-blue-600" />;
        case 'alert': return <Zap className="w-4 h-4 text-yellow-600" />;
        default: return <Minus className="w-4 h-4 text-gray-600" />;
      }
    };

    return (
      <div className={`p-3 rounded-lg border ${getBgColor()}`}>
        <div className="flex items-start gap-2">
          {getIcon()}
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">{recommendation.title}</h4>
            <p className="text-xs text-gray-700 whitespace-pre-line mt-1">{recommendation.content}</p>
          </div>
        </div>
      </div>
    );
  };

  const AnalysisCard = ({ electrolyte, result, reference }) => {
    const getIcon = () => {
      if (result.status === 'normal') return <Minus className="w-4 h-4 text-green-600" />;
      if (result.status === 'low') return <TrendingDown className="w-4 h-4 text-blue-600" />;
      if (result.status === 'high') return <TrendingUp className="w-4 h-4 text-red-600" />;
      return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    };

    const getBackgroundColor = () => {
      if (result.status === 'normal') return 'bg-green-100 border-green-200';
      if (result.status === 'low') return 'bg-blue-100 border-blue-200';
      if (result.status === 'high') return 'bg-red-100 border-red-200';
      return 'bg-yellow-100 border-yellow-200';
    };

    const getSeverityBadge = () => {
      if (result.severity === 'critical') {
        return <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">Critique</span>;
      } else if (result.severity === 'moderate') {
        return <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">Modéré</span>;
      }
      return null;
    };

    return (
      <div className={`p-4 rounded-xl border ${getBackgroundColor()}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-800">{getFrenchName(electrolyte)}</h4>
          <div className="flex items-center gap-2">
            {getIcon()}
            {getSeverityBadge()}
          </div>
        </div>
        <p className="text-sm text-gray-700 mb-3">{result.message}</p>
        <p className="text-xs text-gray-600 mb-3">Ref: {reference.normal[0]} - {reference.normal[1]} {reference.unit}</p>
        
        {result.recommendations.length > 0 && (
          <div className="space-y-2">
            {result.recommendations.map((rec, index) => (
              <RecommendationItem key={index} recommendation={rec} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analyseur de Troubles Ioniques</h1>
              <p className="text-gray-600 mt-1">Système de surveillance et d'analyse des électrolytes sanguins</p>
            </div>
            <div className="flex items-center gap-2 text-indigo-600">
              <Activity className="w-8 h-8" />
              <span className="text-lg font-semibold">PFE</span>
            </div>
            <Link
              to="/doctor"
              className="px-4 py-2 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 transition-colors"
            >
              Interface Docteur
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Informations Patient</h2>

            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800 mb-2">Patient existant</p>
              <input
                type="text"
                value={patientLookup}
                onChange={(e) => setPatientLookup(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Rechercher par ID dossier, nom ou motif"
              />
              {patientLookup.trim() !== '' && (
                <div className="mt-2 max-h-36 overflow-auto space-y-2">
                  {patientMatches.length === 0 && (
                    <div className="text-xs text-slate-500">Aucun patient correspondant.</div>
                  )}
                  {patientMatches.map((profile) => (
                    <button
                      key={profile.patientRef}
                      type="button"
                      onClick={() => applyPatientProfile(profile)}
                      className="w-full text-left rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-indigo-300"
                    >
                      <p className="text-sm font-semibold text-slate-800">{profile.name || 'Patient sans nom'} ({profile.patientId || 'Sans ID'})</p>
                      <p className="text-xs text-slate-500">Age: {profile.age || '-'} | Sexe: {profile.gender === 'female' ? 'Femme' : 'Homme'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ID dossier</label>
                <input
                  type="text"
                  value={patientData.patientId}
                  onChange={(e) => setPatientData({...patientData, patientId: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="CLN-2026-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet</label>
                <input
                  type="text"
                  value={patientData.name}
                  onChange={(e) => setPatientData({...patientData, name: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Entrez le nom du patient"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Âge</label>
                <input
                  type="number"
                  value={patientData.age}
                  onChange={(e) => setPatientData({...patientData, age: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Âge en années"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Poids (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={patientData.weight}
                  onChange={(e) => setPatientData({...patientData, weight: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Poids en kg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Taille (cm)</label>
                <input
                  type="number"
                  value={patientData.height}
                  onChange={(e) => setPatientData({...patientData, height: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Taille en cm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sexe</label>
                <select
                  value={patientData.gender}
                  onChange={(e) => setPatientData({...patientData, gender: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="male">Homme</option>
                  <option value="female">Femme</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Motif clinique</label>
                <textarea
                  value={patientData.complaint}
                  onChange={(e) => setPatientData({...patientData, complaint: e.target.value})}
                  rows={2}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: faiblesse, confusion, trouble du rythme, suivi en reanimation"
                />
              </div>
            </div>

            <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
              Source de donnees: {scanContext.source === 'ocr-image' ? 'Image OCR' : 'Saisie manuelle'}
              {scanContext.fileName ? ` | Fichier: ${scanContext.fileName}` : ''}
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-6">Niveaux d'Électrolytes</h2>
            {uploadError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {uploadError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ElectrolyteInput
                label="Sodium"
                icon={Thermometer}
                value={electrolytes.sodium}
                onChange={(value) => setElectrolytes({...electrolytes, sodium: value})}
                unit={referenceRanges.sodium.unit}
                status={analysisResult?.results?.sodium?.status}
              />
              <ElectrolyteInput
                label="Potassium"
                icon={Zap}
                value={electrolytes.potassium}
                onChange={(value) => setElectrolytes({...electrolytes, potassium: value})}
                unit={referenceRanges.potassium.unit}
                status={analysisResult?.results?.potassium?.status}
              />
              <ElectrolyteInput
                label="Calcium"
                icon={Heart}
                value={electrolytes.calcium}
                onChange={(value) => setElectrolytes({...electrolytes, calcium: value})}
                unit={referenceRanges.calcium.unit}
                status={analysisResult?.results?.calcium?.status}
              />
              <ElectrolyteInput
                label="Magnésium"
                icon={Droplets}
                value={electrolytes.magnesium}
                onChange={(value) => setElectrolytes({...electrolytes, magnesium: value})}
                unit={referenceRanges.magnesium.unit}
                status={analysisResult?.results?.magnesium?.status}
              />
              <ElectrolyteInput
                label="Chlorure"
                icon={Activity}
                value={electrolytes.chloride}
                onChange={(value) => setElectrolytes({...electrolytes, chloride: value})}
                unit={referenceRanges.chloride.unit}
                status={analysisResult?.results?.chloride?.status}
              />
              <ElectrolyteInput
                label="Phosphate"
                icon={Plus}
                value={electrolytes.phosphate}
                onChange={(value) => setElectrolytes({...electrolytes, phosphate: value})}
                unit={referenceRanges.phosphate.unit}
                status={analysisResult?.results?.phosphate?.status}
              />
              <ElectrolyteInput
                label="Bicarbonate"
                icon={Minus}
                value={electrolytes.bicarbonate}
                onChange={(value) => setElectrolytes({...electrolytes, bicarbonate: value})}
                unit={referenceRanges.bicarbonate.unit}
                status={analysisResult?.results?.bicarbonate?.status}
              />
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={analyzeElectrolytes}
                className="flex-1 min-w-[180px] bg-indigo-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-indigo-700 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Activity className="w-5 h-5" />
                Analyser
              </button>
              <button
                onClick={resetForm}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors duration-200"
              >
                Réinitialiser
              </button>
              <button
                onClick={exportBilan}
                disabled={!patientData.name && !Object.values(electrolytes).some(v => v)}
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Exporter
              </button>
              <button
                onClick={sendToDoctor}
                disabled={!canSendToDoctor}
                className="px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send to doctor
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                {isUploadingImage ? 'Import en cours...' : 'Importer'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={importImageAndAnalyze}
                className="hidden"
              />
            </div>
            {doctorSendMessage && (
              <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                {doctorSendMessage}
              </div>
            )}
            {!canSendToDoctor && (
              <p className="mt-2 text-xs text-slate-500">
                Remplissez tous les champs patient et tous les electrolytes pour activer l envoi au medecin.
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Résultats de l'Analyse</h2>
            
            {analysisResult ? (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <p className="text-indigo-800 font-medium">
                    Analyse effectuée le {analysisResult.timestamp}
                  </p>
                </div>
                
                {analysisResult.hasCritical && (
                  <div className="bg-red-100 border-l-4 border-red-500 p-4">
                    <div className="flex items-center gap-2 text-red-800 font-bold">
                      <AlertTriangle className="w-5 h-5" />
                      🚨 **URGENCE CRITIQUE** – Intervention immédiate requise
                    </div>
                  </div>
                )}
                
                {analysisResult.hasAbnormalities && !analysisResult.hasCritical ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-yellow-800 font-semibold">
                      <AlertTriangle className="w-5 h-5" />
                      Anomalies détectées – Surveillance renforcée
                    </div>
                  </div>
                ) : !analysisResult.hasAbnormalities && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-800 font-semibold">
                      <Minus className="w-5 h-5" />
                      Résultats normaux
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {Object.entries(analysisResult.results).map(([electrolyte, result]) => (
                    <AnalysisCard
                      key={electrolyte}
                      electrolyte={electrolyte}
                      result={result}
                      reference={referenceRanges[electrolyte]}
                    />
                  ))}
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-800 mb-3">📝 Résumé ultra-court (à coller au poste de soins)</h3>
                  <div className="text-xs text-gray-700 space-y-2">
                    <div className="grid grid-cols-3 gap-2 font-medium border-b pb-1">
                      <span>Trouble</span>
                      <span>Urgence</span>
                      <span>Surveillance</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>Na &lt; 120</span>
                      <span>Bolus 3% 100 mL</span>
                      <span>Na 2–4 h</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>Na &gt; 160</span>
                      <span>Réhydratation lente</span>
                      <span>Na 4 h</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>K &lt; 2.5</span>
                      <span>KCl IV</span>
                      <span>K 4 h + ECG</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>K &gt; 6.5</span>
                      <span>Ca gluconate + insuline</span>
                      <span>K 1–2 h + ECG</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>Ca bas + symptômes</span>
                      <span>Ca gluconate</span>
                      <span>Ca 4 h</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>Ca très élevé</span>
                      <span>Hydratation + furosémide</span>
                      <span>Ca 2x/j</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>Mg bas sévère</span>
                      <span>MgSO4 IV</span>
                      <span>Mg 6 h</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>Mg haut sévère</span>
                      <span>Ca gluconate</span>
                      <span>Mg 4 h</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune analyse effectuée</h3>
                <p className="text-gray-600">Remplissez les données ou importez un bilan existant.</p>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-12 text-center text-gray-600">
          <p>Projet de Fin d'Études - Système d'Analyse de Troubles Ioniques</p>
          <p className="text-sm mt-2">🔔 Alertes sonores • 💾 Export/Import JSON • Outil d'assistance médicale</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
